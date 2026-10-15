// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"
	"errors"
	"fmt"
	"sort"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
	namespaces "github.com/viant/mcp-protocol/extension/namespaces"
	skillformat "github.com/viant/mcp-protocol/extension/skills"
	"github.com/viant/mcp-protocol/schema"
)

func cloneNativeSkills(input []*skillformat.Static) []*skillformat.Static {
	if input == nil {
		return nil
	}
	return append([]*skillformat.Static{}, input...)
}
func checkNativeSkills(input []*skillformat.Static) error {
	seen := map[string]bool{}
	for _, skill := range input {
		if skill == nil {
			return fmt.Errorf("nil native skill")
		}
		if err := skill.Validate(); err != nil {
			return err
		}
		uri := skill.Metadata().Uri
		if seen[uri] {
			return fmt.Errorf("duplicate native skill URI")
		}
		seen[uri] = true
	}
	return nil
}
func (h *localMCPHandler) registerNativeSkills() error {
	for _, skill := range h.provider.nativeSkills {
		if err := h.Registry.RegisterStaticSkill(skill); err != nil {
			return err
		}
	}
	return nil
}
func (p *LocalProvider) nativeSkill(uri string, file bool) *skillformat.Static {
	for _, skill := range p.nativeSkills {
		if file && skill.Contains(uri) || !file && skill.Metadata().Uri == uri {
			return skill
		}
	}
	return nil
}
func (h *localMCPHandler) ListSkills(ctx context.Context, request *jsonrpc.TypedRequest[*schema.ListSkillsRequest]) (*schema.ListSkillsResult, *jsonrpc.Error) {
	if h.provider.nativeSkills == nil {
		return h.DefaultHandler.ListSkills(ctx, request)
	}
	actor, err := h.provider.currentActor(ctx)
	if err != nil {
		return nil, jsonrpc.NewInvalidParamsError("skills unavailable", nil)
	}
	entries := []schema.Skill{}
	for _, skill := range h.provider.nativeSkills {
		entry := skill.Metadata()
		uri, e := identity.ParseResourceURI(entry.Uri)
		if e != nil {
			return nil, jsonrpc.NewInvalidParamsError("skills unavailable", nil)
		}
		if e = h.provider.authorize(ctx, actor, uri, "resource.list"); e != nil {
			if errors.Is(e, identity.ErrResourceDenied) {
				continue
			}
			return nil, jsonrpc.NewInvalidParamsError("skills unavailable", nil)
		}
		entries = append(entries, entry)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Uri < entries[j].Uri })
	var cursor *string
	if request != nil && request.Request != nil {
		cursor = request.Request.Params.Cursor
	}
	page, next, err := namespaces.Paginate(entries, cursor, 32)
	if err != nil {
		return nil, jsonrpc.NewInvalidParamsError("invalid skills cursor", nil)
	}
	if err = h.provider.finishActor(ctx, actor); err != nil {
		return nil, jsonrpc.NewInvalidParamsError("skills unavailable", nil)
	}
	return &schema.ListSkillsResult{ResultType: schema.ResultTypeComplete, Skills: page, NextCursor: next}, nil
}
func (h *localMCPHandler) GetSkill(ctx context.Context, request *jsonrpc.TypedRequest[*schema.GetSkillRequest]) (*schema.GetSkillResult, *jsonrpc.Error) {
	if h.provider.nativeSkills == nil {
		return h.DefaultHandler.GetSkill(ctx, request)
	}
	if request == nil || request.Request == nil {
		return nil, jsonrpc.NewInvalidParamsError("skill unavailable", nil)
	}
	skill := h.provider.nativeSkill(request.Request.Params.Uri, false)
	if skill == nil {
		return nil, jsonrpc.NewInvalidParamsError("skill unavailable", nil)
	}
	actor, err := h.provider.currentActor(ctx)
	if err != nil {
		return nil, jsonrpc.NewInvalidParamsError("skill unavailable", nil)
	}
	uri, _ := identity.ParseResourceURI(skill.Metadata().Uri)
	if err = h.provider.authorize(ctx, actor, uri, "resource.get"); err != nil {
		return nil, jsonrpc.NewInvalidParamsError("skill unavailable", nil)
	}
	if err = h.provider.finishActor(ctx, actor); err != nil {
		return nil, jsonrpc.NewInvalidParamsError("skill unavailable", nil)
	}
	return &schema.GetSkillResult{ResultType: schema.ResultTypeComplete, Skill: skill.Metadata()}, nil
}
func (h *localMCPHandler) ReadResource(ctx context.Context, request *jsonrpc.TypedRequest[*schema.ReadResourceRequest]) (*schema.ReadResourceResult, *jsonrpc.Error) {
	if request == nil || request.Request == nil {
		return nil, jsonrpc.NewInvalidParamsError("resource unavailable", nil)
	}
	skill := h.provider.nativeSkill(request.Request.Params.Uri, true)
	if skill == nil {
		if uri, err := identity.ParseResourceURI(request.Request.Params.Uri); err == nil && h.provider.ownsStandardResource(uri) {
			if _, registered := h.ResourceRegistry.Get(uri.String()); registered {
				if _, err := h.provider.Get(ctx, uri.Kind, primitive.GetRequest{URI: uri.String()}); err != nil {
					return nil, jsonrpc.NewInvalidParamsError("resource unavailable", nil)
				}
				return h.DefaultHandler.ReadResource(ctx, request)
			}
			result, err := h.provider.readStandardResource(ctx, uri)
			if err != nil {
				return nil, jsonrpc.NewInvalidParamsError("resource unavailable", nil)
			}
			return result, nil
		}
		return h.DefaultHandler.ReadResource(ctx, request)
	}
	actor, err := h.provider.currentActor(ctx)
	if err != nil {
		return nil, jsonrpc.NewInvalidParamsError("resource unavailable", nil)
	}
	uri, _ := identity.ParseResourceURI(skill.Metadata().Uri)
	if err = h.provider.authorize(ctx, actor, uri, "resource.get"); err != nil {
		return nil, jsonrpc.NewInvalidParamsError("resource unavailable", nil)
	}
	result, rpcErr := skill.ReadResource(ctx, request.Request)
	if rpcErr == nil && h.provider.finishActor(ctx, actor) != nil {
		return nil, jsonrpc.NewInvalidParamsError("resource unavailable", nil)
	}
	return result, rpcErr
}

// A skill-only publisher uses the shared namespace index as supplementary
// discovery. Native method names never double as ordinary tools.
func (p *LocalProvider) nativeSkillIndex() bool {
	if p.nativeSkills == nil || p.catalog != nil || len(p.nativeResources) > 0 {
		return false
	}
	for uri := range p.bindings {
		parsed, err := identity.ParseResourceURI(uri)
		if err != nil || parsed.Kind != "skill" {
			return false
		}
	}
	return true
}
func (h *localMCPHandler) nativeSkillIndexCall(ctx context.Context, name string, args map[string]interface{}) (any, bool, error) {
	if !h.provider.nativeSkillIndex() {
		return nil, false, nil
	}
	if name == namespaces.ResourceGetToolName {
		uri, _ := args["uri"].(string)
		request := &jsonrpc.TypedRequest[*schema.GetSkillRequest]{Request: &schema.GetSkillRequest{Params: schema.GetSkillRequestParams{Uri: uri}}}
		result, rpc := h.GetSkill(ctx, request)
		if rpc != nil {
			return nil, true, identity.ErrResourceDenied
		}
		return result, true, nil
	}
	actor, err := h.provider.currentActor(ctx)
	if err != nil {
		return nil, true, err
	}
	groups := map[string][]namespaces.Resource{}
	for _, skill := range h.provider.nativeSkills {
		entry := skill.Metadata()
		uri, e := identity.ParseResourceURI(entry.Uri)
		if e != nil {
			return nil, true, e
		}
		if e = h.provider.authorize(ctx, actor, uri, "resource.list"); e != nil {
			if errors.Is(e, identity.ErrResourceDenied) {
				continue
			}
			return nil, true, e
		}
		label, _ := entry.Frontmatter["name"].(string)
		description, _ := entry.Frontmatter["description"].(string)
		groups[uri.Namespace] = append(groups[uri.Namespace], namespaces.Resource{URI: entry.Uri, Kind: "skill", Name: label, Description: description, MimeType: "application/json"})
	}
	var cursor *string
	if value, ok := args["cursor"].(string); ok {
		cursor = &value
	}
	var result any
	switch name {
	case namespaces.ListToolName:
		rows := []namespaces.Namespace{}
		for namespace := range groups {
			uri, _ := namespaces.URI(namespace)
			rows = append(rows, namespaces.Namespace{URI: uri, Name: namespace})
		}
		sort.Slice(rows, func(i, j int) bool { return rows[i].URI < rows[j].URI })
		page, next, e := namespaces.Paginate(rows, cursor, 100)
		if e != nil {
			return nil, true, e
		}
		result = namespaces.ListResult{Namespaces: page, NextCursor: next}
	case namespaces.GetToolName:
		selected, _ := args["uri"].(string)
		rows := []namespaces.Resource{}
		found := false
		for namespace, group := range groups {
			uri, _ := namespaces.URI(namespace)
			if uri == selected {
				rows = group
				found = true
			}
		}
		if !found {
			return nil, true, identity.ErrResourceDenied
		}
		sort.Slice(rows, func(i, j int) bool { return rows[i].URI < rows[j].URI })
		page, next, e := namespaces.Paginate(rows, cursor, 100)
		if e != nil {
			return nil, true, e
		}
		result = namespaces.GetResult{Resources: page, NextCursor: next}
	default:
		return nil, false, nil
	}
	if err = h.provider.finishActor(ctx, actor); err != nil {
		return nil, true, err
	}
	return result, true, nil
}

func (h *localMCPHandler) ListResources(ctx context.Context, request *jsonrpc.TypedRequest[*schema.ListResourcesRequest]) (*schema.ListResourcesResult, *jsonrpc.Error) {
	actor, err := h.provider.currentActor(ctx)
	if err != nil {
		return nil, jsonrpc.NewInvalidParamsError("resources unavailable", nil)
	}
	resources, err := h.provider.listStandardResources(ctx)
	if err != nil {
		return nil, jsonrpc.NewInvalidParamsError("resources unavailable", nil)
	}
	seen := map[string]int{}
	for index, resource := range resources {
		seen[resource.Uri] = index
	}
	for _, registered := range h.ResourceRegistry.Values() {
		if skill := h.provider.nativeSkill(registered.Metadata.Uri, true); skill != nil {
			uri, _ := identity.ParseResourceURI(skill.Metadata().Uri)
			if e := h.provider.authorize(ctx, actor, uri, "resource.list"); e != nil {
				if errors.Is(e, identity.ErrResourceDenied) {
					continue
				}
				return nil, jsonrpc.NewInvalidParamsError("resources unavailable", nil)
			}
		}
		if index, duplicate := seen[registered.Metadata.Uri]; duplicate {
			uri, parseErr := identity.ParseResourceURI(registered.Metadata.Uri)
			if parseErr != nil || !h.provider.ownsStandardResource(uri) {
				return nil, jsonrpc.NewInvalidParamsError("resource collision", nil)
			}
			resources[index] = registered.Metadata
			continue
		}
		seen[registered.Metadata.Uri] = len(resources)
		resources = append(resources, registered.Metadata)
	}
	sort.Slice(resources, func(i, j int) bool { return resources[i].Uri < resources[j].Uri })
	var cursor *string
	if request != nil && request.Request != nil {
		cursor = request.Request.Params.Cursor
	}
	page, next, err := namespaces.Paginate(resources, cursor, 32)
	if err != nil {
		return nil, jsonrpc.NewInvalidParamsError("invalid resource cursor", nil)
	}
	if h.provider.finishActor(ctx, actor) != nil {
		return nil, jsonrpc.NewInvalidParamsError("resources unavailable", nil)
	}
	// Reuse a private catalog only when this provider also publishes list-change
	// notifications. The TTL bounds staleness if a client loses its stream.
	ttl := 0
	if h.provider.hasResourceChanges() && len(h.provider.nativeResources) > 0 {
		ttl = 30_000
	}
	return &schema.ListResourcesResult{ResultType: schema.ResultTypeComplete, CacheScope: schema.ListResourcesResultCacheScopePrivate, TtlMs: ttl, Resources: page, NextCursor: next}, nil
}
