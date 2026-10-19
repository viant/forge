// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sort"

	"golang.org/x/sync/errgroup"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	namespaces "github.com/viant/mcp-protocol/extension/namespaces"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

// A shared index has no capability/permission receipt. Its namespace URI is an
// opaque collection locator; resource URI authorities remain their own identity.
func sharedNamespaceIndex(raw json.RawMessage) bool {
	var shape map[string]json.RawMessage
	if json.Unmarshal(raw, &shape) != nil {
		return false
	}
	_, listed := shape["namespaces"]
	return listed && shape["complete"] == nil && shape["providerIdentity"] == nil
}

func decodeNamespaceIndex[T any](raw json.RawMessage, required string) (T, error) {
	var result T
	var shape map[string]json.RawMessage
	if json.Unmarshal(raw, &shape) != nil || shape[required] == nil || bytes.Equal(bytes.TrimSpace(shape[required]), []byte("null")) {
		return result, identity.ErrResource
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&result); err != nil {
		return result, err
	}
	if decoder.Decode(new(any)) != io.EOF {
		return result, identity.ErrResource
	}
	return result, nil
}

func (g *Gateway) discoverNamespaceIndex(ctx context.Context, c mcpclient.Interface, first json.RawMessage, result capabilities, allowed map[string]bool, standardRead bool, legacyOwner ...string) (capabilities, error) {
	result.sharedIndex = true
	result.standardResources = standardRead
	result.indexedResources = map[string]primitive.ResourceState{}
	if !result.installed[namespaces.ListToolName] || !result.installed[namespaces.GetToolName] && !resourceFiltersSupported(ctx, c) {
		return result, ErrUnavailable
	}
	seenNS := map[string]bool{}
	seenCursor := map[string]bool{}
	var collections []namespaces.Namespace
	for cursor, page := (*string)(nil), 0; page < 100; page++ {
		raw := first
		if page > 0 {
			var err error
			var request any = namespaces.ListRequest{Cursor: cursor}
			if len(legacyOwner) > 0 {
				request = primitive.NamespaceListRequest{Cursor: *cursor, Limit: 100}
			}
			raw, err = toolRaw(ctx, c, namespaces.ListToolName, request)
			if err != nil {
				return result, err
			}
		}
		listed, err := decodeCollectionIndex(raw, legacyOwner)
		if err != nil {
			return result, err
		}
		for _, namespace := range listed.Namespaces {
			if _, err := namespaces.ParseURI(namespace.URI); err != nil || namespace.Name == "" || seenNS[namespace.URI] {
				return result, identity.ErrResource
			}
			seenNS[namespace.URI] = true
			// Restrictions use exact collection locators in this contract, never display
			// names or guessed correspondence with resource URI authorities.
			restriction := namespace.URI
			if len(legacyOwner) > 0 {
				restriction = namespace.Name
			}
			if len(allowed) > 0 && !allowed[restriction] {
				continue
			}
			collections = append(collections, namespace)
		}
		if listed.NextCursor == nil {
			break
		}
		if *listed.NextCursor == "" || seenCursor[*listed.NextCursor] || page == 99 {
			return result, identity.ErrResource
		}
		seenCursor[*listed.NextCursor] = true
		cursor = listed.NextCursor
	}
	sort.Slice(collections, func(i, j int) bool { return collections[i].URI < collections[j].URI })
	type namespaceResult struct {
		resources map[string]primitive.ResourceState
		err       error
	}
	indexed := make([]namespaceResult, len(collections))
	group := new(errgroup.Group)
	group.SetLimit(4)
	for i, namespace := range collections {
		group.Go(func() error {
			local := map[string]primitive.ResourceState{}
			indexed[i] = namespaceResult{resources: local, err: g.readNamespaceIndex(ctx, c, namespace, local)}
			return nil
		})
	}
	_ = group.Wait()
	for _, page := range indexed {
		if page.err != nil {
			return result, page.err
		}
		for uri, resource := range page.resources {
			if _, exists := result.indexedResources[uri]; exists {
				return result, fmt.Errorf("%w: duplicate indexed resource", ErrCollision)
			}
			result.indexedResources[uri] = resource
		}
	}
	kinds := map[string]map[string]bool{}
	for _, resource := range result.indexedResources {
		if kinds[resource.Namespace] == nil {
			kinds[resource.Namespace] = map[string]bool{}
		}
		kinds[resource.Namespace][resource.Kind] = true
	}
	authorities := make([]string, 0, len(kinds))
	for namespace := range kinds {
		authorities = append(authorities, namespace)
	}
	sort.Strings(authorities)
	for _, namespace := range authorities {
		detail := primitive.NamespaceCapabilities{Namespace: namespace, ProviderIdentity: result.connection.ProviderIdentity}
		sorted := make([]string, 0, len(kinds[namespace]))
		for kind := range kinds[namespace] {
			sorted = append(sorted, kind)
		}
		sort.Strings(sorted)
		for _, kind := range sorted {
			operations := []string{"list"}
			methods := map[string]string{"list": namespaces.GetToolName}
			if resourceFiltersSupported(ctx, c) {
				methods["list"] = schema.MethodResourcesList
			}
			if standardRead {
				operations = append(operations, "get")
				methods["get"] = schema.MethodResourcesRead
			} else if result.installed[namespaces.ResourceGetToolName] {
				operations = append(operations, "get")
				methods["get"] = namespaces.ResourceGetToolName
			}
			detail.Kinds = append(detail.Kinds, primitive.KindSupport{Kind: kind, Operations: operations, Methods: methods})
		}
		result.namespaces = append(result.namespaces, detail)
	}
	return result, nil
}

func (g *Gateway) readNamespaceIndex(ctx context.Context, c mcpclient.Interface, namespace namespaces.Namespace, resources map[string]primitive.ResourceState) error {
	if resourceFiltersSupported(ctx, c) {
		return g.readFilteredNamespaceIndex(ctx, c, namespace, resources)
	}
	seenCursor := map[string]bool{}
	for cursor, page := (*string)(nil), 0; page < 100; page++ {
		raw, err := toolRaw(ctx, c, namespaces.GetToolName, namespaces.GetRequest{URI: namespace.URI, Cursor: cursor})
		if err != nil {
			return err
		}
		listed, err := decodeNamespaceIndex[namespaces.GetResult](raw, "resources")
		if err != nil {
			return err
		}
		if listed.Namespace != nil && listed.Namespace.URI != namespace.URI {
			return identity.ErrResource
		}
		for _, summary := range listed.Resources {
			uri, err := identity.ParseResourceURI(summary.URI)
			if err != nil || summary.Kind != uri.Kind || summary.Name == "" {
				return identity.ErrResource
			}
			if _, exists := resources[summary.URI]; exists {
				return fmt.Errorf("%w: duplicate indexed resource", ErrCollision)
			}
			resources[summary.URI] = primitive.ResourceState{URI: summary.URI, Kind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name, Title: summary.Name, Description: summary.Description, MimeType: summary.MimeType}
		}
		if listed.NextCursor == nil {
			return nil
		}
		if *listed.NextCursor == "" || seenCursor[*listed.NextCursor] || page == 99 {
			return identity.ErrResource
		}
		seenCursor[*listed.NextCursor] = true
		cursor = listed.NextCursor
	}
	return identity.ErrResource
}

func indexedDefinitionGet(ctx context.Context, c mcpclient.Interface, caps capabilities, ref identity.ResourceRef) (primitive.GetResult, error) {
	if ref.Revision != "" && ref.Revision != identity.WorkingCandidate {
		return primitive.GetResult{}, identity.ErrResource
	}
	resource, ok := caps.indexedResources[ref.URI]
	if !ok {
		return primitive.GetResult{}, identity.ErrResourceDenied
	}
	raw, err := toolRaw(ctx, c, namespaces.ResourceGetToolName, namespaces.ResourceGetRequest{URI: ref.URI})
	if err != nil {
		return primitive.GetResult{}, err
	}
	if !json.Valid(raw) {
		return primitive.GetResult{}, identity.ErrResource
	}
	resource.DefinitionBytes = append([]byte(nil), raw...)
	resource.Definition = resource.DefinitionBytes
	resource.FormatVersion = 1
	resource.ContentFingerprint = identity.ContentFingerprint(raw)
	resource.Lifecycle = identity.WorkingCandidate
	// This is a host metadata locator, not an owning-server authorization receipt.
	pin := &identity.ResolvedResource{URI: ref.URI, ProviderIdentity: caps.connection.ProviderIdentity, ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: resource.ContentFingerprint}}
	return primitive.GetResult{Resource: &resource, ResolvedResource: pin}, nil
}

// Legacy authoring indexes identify collections by their explicit namespace name.
// Their provider receipt remains validated even when resources/list replaces get.
func decodeCollectionIndex(raw json.RawMessage, legacyOwner []string) (namespaces.ListResult, error) {
	if len(legacyOwner) == 0 {
		return decodeNamespaceIndex[namespaces.ListResult](raw, "namespaces")
	}
	var listed struct {
		ProviderIdentity string `json:"providerIdentity"`
		Namespaces       []struct {
			primitive.Namespace
			URI string `json:"uri"`
		} `json:"namespaces"`
		NextCursor string `json:"nextCursor"`
		Complete   bool   `json:"complete"`
	}
	var shape map[string]json.RawMessage
	if json.Unmarshal(raw, &shape) != nil || shape["namespaces"] == nil || bytes.Equal(bytes.TrimSpace(shape["namespaces"]), []byte("null")) {
		return namespaces.ListResult{}, identity.ErrResource
	}
	if err := json.Unmarshal(raw, &listed); err != nil {
		return namespaces.ListResult{}, err
	}
	if listed.ProviderIdentity != "" && listed.ProviderIdentity != legacyOwner[0] {
		return namespaces.ListResult{}, ErrCollision
	}
	if listed.Complete && listed.NextCursor != "" || !listed.Complete && listed.NextCursor == "" {
		return namespaces.ListResult{}, identity.ErrResource
	}
	result := namespaces.ListResult{}
	if listed.NextCursor != "" {
		result.NextCursor = &listed.NextCursor
	}
	for _, ns := range listed.Namespaces {
		uri := ns.URI
		if uri == "" {
			var err error
			uri, err = namespaces.URI(ns.Name)
			if err != nil {
				return namespaces.ListResult{}, err
			}
		}
		if _, err := namespaces.ParseURI(uri); err != nil {
			return namespaces.ListResult{}, err
		}
		result.Namespaces = append(result.Namespaces, namespaces.Namespace{URI: uri, Name: ns.Name})
	}
	return result, nil
}
