// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package mcp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
)

type endpointPolicy struct {
	binding string
	allowed bool
}

func (p *endpointPolicy) SelectRevision(_ context.Context, ref identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
	if p.allowed && ref.URI == "window://planning/overview" && (ref.Revision == "" || ref.Revision == "1") {
		for _, candidate := range c {
			if candidate.Revision == "1" {
				return identity.ResourceDecision{Candidate: candidate, AuthorityBinding: p.binding, ValidUntil: time.Now().Add(time.Minute)}, nil
			}
		}
	}
	return identity.ResourceDecision{}, identity.ErrResourceDenied
}

type endpointSource struct{ raw json.RawMessage }

func (s *endpointSource) Candidates(context.Context, identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	hash := identity.ContentFingerprint(s.raw)
	return []identity.ResourceCandidate{{Kind: identity.StampedCandidate, Revision: "1", ContentFingerprint: hash}, {Kind: identity.StampedCandidate, Revision: "2", ContentFingerprint: hash}}, nil
}
func (s *endpointSource) ReadCandidate(context.Context, identity.ResourceURI, identity.ResourceCandidate) (json.RawMessage, error) {
	return s.raw, nil
}
func TestNativeResourcesAndExistingToolsSharePinnedResolution(t *testing.T) {
	ctx := context.Background()
	policy := &endpointPolicy{binding: "alice/account/identity-1", allowed: true}
	definition := windowprotocol.Definition{ContractVersion: windowprotocol.Version, Window: &types.Window{WindowKey: "overview", View: types.View{Content: &types.Container{ID: "approved"}}}, DataSources: map[string]*windowprotocol.DataSource{"rows": {ID: "rows", Backend: &windowprotocol.Backend{Kind: "mcp", Ownership: "provider", Method: "arbitraryProvider/query", SchemaFingerprint: identity.ContentFingerprint([]byte("schema"))}}}}
	raw, err := json.Marshal(definition)
	if err != nil {
		t.Fatal(err)
	}
	source := &endpointSource{raw: raw}
	resolver := &identity.ResourceResolver{Source: source, Policy: policy}
	dispatches := 0
	provider := &service.PrimitiveProvider{ResourceResolver: func(context.Context) (*identity.ResourceResolver, error) { return resolver, nil }, Authority: service.PrimitiveAuthorityFuncs{AuthenticateFunc: func(context.Context) (string, error) { return policy.binding, nil }, AuthorizeFunc: func(context.Context, string, string, string, string) error { return nil }, AuthorizeFetchFunc: func(context.Context, string, *windowprotocol.FetchInput) error { return nil }}, Host: service.PrimitiveHostFuncs{
		CatalogFunc: func(context.Context, *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error) {
			return &windowprotocol.Catalog{ContractVersion: windowprotocol.Version, CatalogRevision: "catalog-1", Windows: []windowprotocol.WindowSummary{{Key: "overview", Title: "Overview", ResourceURI: "window://planning/overview"}, {Key: "hidden", Title: "Hidden", ResourceURI: "window://planning/hidden"}}}, nil
		},
		DefinitionResolvedFunc: func(_ context.Context, _ identity.ResolvedResource, raw json.RawMessage) (*windowprotocol.Definition, error) {
			var result windowprotocol.Definition
			err := json.Unmarshal(raw, &result)
			return &result, err
		},
		FetchResolvedFunc: func(_ context.Context, in *windowprotocol.FetchInput, descriptor *windowprotocol.DataSource) (windowprotocol.FetchOutput, error) {
			if in.Resource.Revision != "1" || descriptor.ID != "rows" {
				return nil, service.ErrProviderUnavailable
			}
			dispatches++
			return json.RawMessage(`{"rows":[{"synthetic":1}]}`), nil
		},
	}}
	value, err := NewProviderHandler(service.NewService(&service.Config{PrimitiveProvider: provider}))(ctx, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	handler := value.(*Handler)
	handler.ClientInitialize = &schema.InitializeRequestParams{ProtocolVersion: "2025-06-18"}
	listed, jerr := handler.ListResources(ctx, &jsonrpc.TypedRequest[*schema.ListResourcesRequest]{Request: &schema.ListResourcesRequest{}})
	if jerr != nil || len(listed.Resources) != 1 || listed.Resources[0].Uri != "window://planning/overview" {
		t.Fatalf("native list=%+v %v", listed, jerr)
	}
	read, jerr := handler.ReadResource(ctx, &jsonrpc.TypedRequest[*schema.ReadResourceRequest]{Request: &schema.ReadResourceRequest{Params: schema.ReadResourceRequestParams{Uri: "window://planning/overview"}}})
	if jerr != nil {
		t.Fatal(jerr)
	}
	var loaded windowprotocol.Definition
	if err := json.Unmarshal([]byte(read.Contents[0].Text), &loaded); err != nil || loaded.Resource.Revision != "1" {
		t.Fatalf("native pinned definition=%+v %v", loaded, err)
	}
	if _, jerr := handler.ReadResource(ctx, &jsonrpc.TypedRequest[*schema.ReadResourceRequest]{Request: &schema.ReadResourceRequest{Params: schema.ReadResourceRequestParams{Uri: "window://planning/overview?revision=2"}}}); jerr == nil {
		t.Fatal("native explicit forbidden revision served")
	}
	input := windowprotocol.FetchInput{ContractVersion: windowprotocol.Version, Resource: loaded.Resource, DataSourceID: "rows"}
	inputRaw, _ := json.Marshal(input)
	var args map[string]any
	json.Unmarshal(inputRaw, &args)
	result, jerr := handler.CallTool(ctx, &jsonrpc.TypedRequest[*schema.CallToolRequest]{Request: &schema.CallToolRequest{Params: schema.CallToolRequestParams{Name: windowprotocol.FetchTool, Arguments: args}}})
	if jerr != nil || dispatches != 1 || !strings.Contains(result.Content[0].(schema.TextContent).Text, "synthetic") {
		t.Fatalf("tools/call pinned run=%+v dispatches=%d %v", result, dispatches, jerr)
	}
	policy.binding = "alice/other-account/identity-1"
	if _, jerr := handler.CallTool(ctx, &jsonrpc.TypedRequest[*schema.CallToolRequest]{Request: &schema.CallToolRequest{Params: schema.CallToolRequestParams{Name: windowprotocol.FetchTool, Arguments: args}}}); jerr == nil {
		t.Fatal("changed-account resource executed")
	}
	policy.allowed = false
	listed, jerr = handler.ListResources(ctx, &jsonrpc.TypedRequest[*schema.ListResourcesRequest]{Request: &schema.ListResourcesRequest{}})
	if jerr != nil || len(listed.Resources) != 0 {
		t.Fatalf("revoked native list=%+v %v", listed, jerr)
	}
	if _, jerr := handler.ReadResource(ctx, &jsonrpc.TypedRequest[*schema.ReadResourceRequest]{Request: &schema.ReadResourceRequest{Params: schema.ReadResourceRequestParams{Uri: "window://planning/overview"}}}); jerr == nil {
		t.Fatal("revoked native read served")
	}
}
