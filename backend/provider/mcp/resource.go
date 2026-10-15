// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package mcp

import (
	"context"
	"encoding/json"

	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
)

func configureCanonicalResources(h *Handler) {
	if h == nil || !h.service.HasCanonicalResources() {
		return
	}
	if h.ServerCapabilities == nil {
		h.ServerCapabilities = &schema.ServerCapabilities{}
	}
	h.ServerCapabilities.Resources = &schema.ServerCapabilitiesResources{}
	h.Methods.Put(schema.MethodResourcesList, true)
	h.Methods.Put(schema.MethodResourcesRead, true)
	// Template metadata contains no private catalog data. Dynamic list/read below
	// use the same guarded provider as existing tools/call.
	for _, kind := range []string{"window", "report"} {
		h.RegisterResourceTemplate(schema.ResourceTemplate{Name: kind, UriTemplate: kind + "://{namespace}/{name}{?revision}"}, nil)
	}
}
func (h *Handler) ListResources(ctx context.Context, request *jsonrpc.TypedRequest[*schema.ListResourcesRequest]) (*schema.ListResourcesResult, *jsonrpc.Error) {
	if !h.service.HasCanonicalResources() {
		return h.DefaultHandler.ListResources(ctx, request)
	}
	input := &windowprotocol.CatalogInput{ContractVersion: windowprotocol.Version, Limit: 100}
	if request != nil && request.Request != nil {
		// Protocol releases represent optional params as either a value or a
		// pointer. Decode the standard cursor without adding extension filters.
		raw, err := json.Marshal(request.Request.Params)
		var params struct {
			Cursor string `json:"cursor"`
		}
		if err != nil || json.Unmarshal(raw, &params) != nil {
			return nil, jsonrpc.NewError(jsonrpc.InvalidParams, service.ErrProviderUnavailable.Error(), nil)
		}
		input.Cursor = params.Cursor
	}
	catalog, err := h.service.PrimitiveCatalog(ctx, input)
	if err != nil {
		return nil, jsonrpc.NewError(jsonrpc.InvalidParams, service.ErrProviderUnavailable.Error(), nil)
	}
	result := &schema.ListResourcesResult{Resources: []schema.Resource{}}
	mime := "application/json"
	for _, entry := range catalog.Windows {
		title := entry.Title
		result.Resources = append(result.Resources, schema.Resource{Uri: entry.ResourceURI, Name: entry.Name, Title: &title, MimeType: &mime})
	}
	if catalog.NextCursor != "" {
		result.NextCursor = &catalog.NextCursor
	}
	return result, nil
}
func (h *Handler) ReadResource(ctx context.Context, request *jsonrpc.TypedRequest[*schema.ReadResourceRequest]) (*schema.ReadResourceResult, *jsonrpc.Error) {
	if !h.service.HasCanonicalResources() {
		return h.DefaultHandler.ReadResource(ctx, request)
	}
	if request == nil || request.Request == nil {
		return nil, jsonrpc.NewError(jsonrpc.InvalidParams, service.ErrProviderUnavailable.Error(), nil)
	}
	ref, err := service.ResourceReadURI(request.Request.Params.Uri)
	if err != nil {
		return nil, jsonrpc.NewError(jsonrpc.InvalidParams, service.ErrProviderUnavailable.Error(), nil)
	}
	if parsed, err := identity.ParseResourceURI(ref.URI); err == nil && parsed.Kind == "report" && h.service.HasReportCatalog() {
		definition, err := h.service.ReportDefinition(ctx, &service.ReportDefinitionInput{Resource: ref})
		if err != nil {
			return nil, jsonrpc.NewError(jsonrpc.InvalidParams, service.ErrProviderUnavailable.Error(), nil)
		}
		raw, err := json.Marshal(definition)
		if err != nil {
			return nil, jsonrpc.NewError(jsonrpc.InternalError, "encode Forge report", nil)
		}
		mime := "application/json"
		return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{{Uri: request.Request.Params.Uri, MimeType: &mime, Text: string(raw)}}}, nil
	}
	definition, err := h.service.PrimitiveDefinition(ctx, &windowprotocol.DefinitionInput{ContractVersion: windowprotocol.Version, Resource: &ref})
	if err != nil {
		return nil, jsonrpc.NewError(jsonrpc.InvalidParams, service.ErrProviderUnavailable.Error(), nil)
	}
	raw, err := json.Marshal(definition)
	if err != nil {
		return nil, jsonrpc.NewError(jsonrpc.InternalError, "encode Forge resource", nil)
	}
	mime := "application/json"
	return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{{Uri: request.Request.Params.Uri, MimeType: &mime, Text: string(raw)}}}, nil
}
