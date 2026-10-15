// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"
	"encoding/json"
	"errors"
	"sort"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
)

type resourceGroup struct{ kind, namespace string }

func (p *LocalProvider) resourceGroups() []resourceGroup {
	seen := map[resourceGroup]bool{}
	for value := range p.bindings {
		uri, err := identity.ParseResourceURI(value)
		if err == nil {
			seen[resourceGroup{uri.Kind, uri.Namespace}] = true
		}
	}
	for namespace, kinds := range p.catalogKinds {
		for kind := range kinds {
			seen[resourceGroup{kind, namespace}] = true
		}
	}
	groups := make([]resourceGroup, 0, len(seen))
	for group := range seen {
		groups = append(groups, group)
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].namespace != groups[j].namespace {
			return groups[i].namespace < groups[j].namespace
		}
		return groups[i].kind < groups[j].kind
	})
	return groups
}

// listStandardResources delegates visibility to the same provider List used by
// the optional domain tools. The MCP resource catalog is the required read path.
func (p *LocalProvider) listStandardResources(ctx context.Context) ([]schema.Resource, error) {
	result := []schema.Resource{}
	seen := map[string]bool{}
	for _, group := range p.resourceGroups() {
		cursor := ""
		for page := 0; page < 100; page++ {
			listed, err := p.List(ctx, group.kind, primitive.ListRequest{Namespace: group.namespace, Cursor: cursor, Limit: 100})
			if errors.Is(err, identity.ErrResourceDenied) {
				break
			}
			if err != nil {
				return nil, err
			}
			for _, resource := range listed.Resources {
				if resource == nil || resource.URI == "" || seen[resource.URI] {
					return nil, identity.ErrResource
				}
				seen[resource.URI] = true
				entry := schema.Resource{Uri: resource.URI, Name: resource.Name}
				if resource.Title != "" {
					entry.Title = &resource.Title
				}
				if resource.Description != "" {
					entry.Description = &resource.Description
				}
				mime := "application/json"
				entry.MimeType = &mime
				result = append(result, entry)
			}
			if listed.Complete {
				break
			}
			if listed.NextCursor == "" || listed.NextCursor == cursor || page == 99 {
				return nil, identity.ErrResource
			}
			cursor = listed.NextCursor
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Uri < result[j].Uri })
	return result, nil
}

func (p *LocalProvider) ownsStandardResource(uri identity.ResourceURI) bool {
	if _, ok := p.bindings[uri.String()]; ok {
		return true
	}
	return p.catalogSupports(uri.Kind, uri.Namespace)
}

func (p *LocalProvider) readStandardResource(ctx context.Context, uri identity.ResourceURI) (*schema.ReadResourceResult, error) {
	got, err := p.Get(ctx, uri.Kind, primitive.GetRequest{URI: uri.String()})
	if err != nil || got == nil || got.Resource == nil {
		return nil, identity.ErrResourceDenied
	}
	var raw json.RawMessage
	if got.MenuProjection != nil {
		raw = got.MenuProjection.DefinitionBytes
	} else if len(got.Resource.DefinitionBytes) > 0 {
		raw = got.Resource.DefinitionBytes
	} else {
		raw = got.Resource.Definition
	}
	if len(raw) == 0 || !json.Valid(raw) {
		return nil, identity.ErrResource
	}
	mime := "application/json"
	return &schema.ReadResourceResult{
		ResultType: schema.ResultTypeComplete,
		CacheScope: schema.ReadResourceResultCacheScopePrivate,
		Contents:   []schema.ReadResourceResultContentsElem{{Uri: uri.String(), MimeType: &mime, Text: string(raw)}},
	}, nil
}
