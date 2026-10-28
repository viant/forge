// SPDX-License-Identifier: Apache-2.0
// Shared primitive delivery; kept aligned with the Core compatibility boundary.
package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"gopkg.in/yaml.v3"
)

// discoverStandardResources treats MCP's resource catalog as the normal
// read-only primitive catalog. Domain-specific catalog tools are optional.
func (g *Gateway) discoverStandardResources(ctx context.Context, actor identity.VerifiedActor, name string, binding *resourceReadBinding, options *cfg.MCPClient, client mcpclient.Interface, generation uint64, resourceVersion [2]uint64) (capabilities, bool, error) {
	owner := options.PrimitiveProviderIdentity
	if owner == "" {
		owner = name
	}
	if owner == g.GatewayProviderIdentity {
		return capabilities{}, true, ErrCollision
	}
	allowed := map[string]bool{}
	for _, namespace := range options.PrimitiveNamespaces {
		allowed[namespace] = true
	}
	result := capabilities{sharedIndex: true, standardResources: true, actor: actor,
		connection:       Connection{Name: name, ProviderIdentity: owner, Generation: generation},
		indexedResources: map[string]primitive.ResourceState{},
		installed:        map[string]bool{schema.MethodResourcesList: true, schema.MethodResourcesRead: true},
		bindingKey:       binding.capabilityKey(), resourceVersion: resourceVersion, expires: actor.ValidUntil}
	minTTL := int(^uint(0) >> 1)
	allPublic := true
	seenCursor := map[string]bool{}
	diagnostic := mcpReferenceDiagnosticFromContext(ctx)
	for cursor, page := (*string)(nil), 0; page < 100; page++ {
		listTiming := observe.Start(ctx, "gateway.resource.list", observe.Labels{Provider: name})
		diagnostic.begin("outbound_request")
		listed, err := client.ListResources(ctx, cursor)
		listTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
		if err != nil {
			var rpc *jsonrpc.Error
			if page == 0 && errors.As(err, &rpc) && rpc.Code == -32601 {
				return capabilities{}, false, nil
			}
			markMCPReferenceFailure(ctx, "outbound_request", "resource_list_failed", err)
			return capabilities{}, true, err
		}
		diagnostic.begin("postcheck")
		if listed == nil || listed.ResultType != "" && listed.ResultType != schema.ResultTypeComplete || listed.TtlMs < 0 {
			markMCPReferenceFailure(ctx, "postcheck", "invalid_list_response", identity.ErrResource)
			return capabilities{}, true, identity.ErrResource
		}
		if listed.TtlMs < minTTL {
			minTTL = listed.TtlMs
		}
		if listed.CacheScope != schema.ListResourcesResultCacheScopePublic {
			allPublic = false
		}
		for _, entry := range listed.Resources {
			uri, err := identity.ParseResourceURI(entry.Uri)
			if err != nil || uri.Kind == "skill" || primitive.Plural(uri.Kind) == "" {
				continue // Ordinary MCP resources need not be Agently primitives.
			}
			if len(allowed) > 0 && !allowed[uri.Namespace] && !allowed["ns://"+uri.Namespace] {
				continue
			}
			if entry.Name == "" || result.indexedResources[entry.Uri].URI != "" {
				markMCPReferenceFailure(ctx, "postcheck", "invalid_list_entry", identity.ErrResource)
				return capabilities{}, true, identity.ErrResource
			}
			state := primitive.ResourceState{URI: entry.Uri, Kind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name, Title: entry.Name}
			if entry.Title != nil && *entry.Title != "" {
				state.Title = *entry.Title
			}
			if entry.Description != nil {
				state.Description = *entry.Description
			}
			if entry.MimeType != nil {
				state.MimeType = *entry.MimeType
			}
			result.indexedResources[entry.Uri] = state
		}
		if listed.NextCursor == nil {
			break
		}
		if *listed.NextCursor == "" || seenCursor[*listed.NextCursor] || page == 99 {
			markMCPReferenceFailure(ctx, "postcheck", "invalid_cursor", identity.ErrResource)
			return capabilities{}, true, identity.ErrResource
		}
		seenCursor[*listed.NextCursor] = true
		cursor = listed.NextCursor
	}
	if len(result.indexedResources) == 0 {
		// An ordinary MCP with no supported primitives is a stable empty
		// discovery result. Retain it until scoped connection/catalog events.
		result.cacheUntil = result.expires
	} else if minTTL == 0 {
		result.cacheUntil = g.now()
	} else if minTTL != int(^uint(0)>>1) {
		until := g.now().Add(time.Duration(minTTL) * time.Millisecond)
		result.cacheUntil = identity.MinimumMetadataExpiry(result.expires, until)
	}
	result.publicResourceMetadata = allPublic
	kinds := map[string]map[string]bool{}
	for _, resource := range result.indexedResources {
		if kinds[resource.Namespace] == nil {
			kinds[resource.Namespace] = map[string]bool{}
		}
		kinds[resource.Namespace][resource.Kind] = true
	}
	for namespace, entries := range kinds {
		detail := primitive.NamespaceCapabilities{Namespace: namespace, ProviderIdentity: owner}
		for kind := range entries {
			detail.Kinds = append(detail.Kinds, primitive.KindSupport{Kind: kind, Operations: []string{"list", "get"}, Methods: map[string]string{"list": schema.MethodResourcesList, "get": schema.MethodResourcesRead}})
		}
		sort.Slice(detail.Kinds, func(i, j int) bool { return detail.Kinds[i].Kind < detail.Kinds[j].Kind })
		result.namespaces = append(result.namespaces, detail)
	}
	sort.Slice(result.namespaces, func(i, j int) bool { return result.namespaces[i].Namespace < result.namespaces[j].Namespace })
	return result, true, nil
}

func standardResourceReadSupported(ctx context.Context, client mcpclient.Interface) bool {
	if negotiated, ok := client.(interface {
		NegotiatedServer() (*schema.InitializeResult, error)
	}); ok {
		if result, err := negotiated.NegotiatedServer(); err == nil && result != nil && result.Capabilities.Resources != nil {
			return true
		}
	}
	if discovery, ok := client.(mcpclient.DiscoveryInterface); ok {
		if result, err := discovery.Discover(ctx); err == nil && result != nil && result.Capabilities.Resources != nil {
			return true
		}
	}
	result, err := client.Initialize(ctx)
	return err == nil && result != nil && result.Capabilities.Resources != nil
}

func standardDefinitionGet(ctx context.Context, client mcpclient.Interface, caps capabilities, ref identity.ResourceRef) (result primitive.GetResult, resultErr error) {
	resource, ok := caps.indexedResources[ref.URI]
	if !ok {
		return primitive.GetResult{}, identity.ErrResourceDenied
	}
	labels := observe.Labels{Kind: resource.Kind, Provider: caps.connection.Name}
	prepareTiming := observe.Start(ctx, "gateway.resource.prepare", labels)
	params := &schema.ReadResourceRequestParams{Uri: ref.URI}
	metadata := map[string]any{}
	if ref.Revision != "" {
		metadata[primitive.RevisionMeta] = ref.Revision
	}
	if resource.Kind == "window" {
		references, targetSupported := windowResourceCapabilities(ctx, client)
		if references {
			metadata[types.WindowDeliveryExtension] = "references"
		}
		if target := presentationWindowTarget(ctx); target != nil && targetSupported {
			metadata[windowTargetExtension] = target
		}
	}
	if len(metadata) > 0 {
		params.Meta.AdditionalProperties = metadata
	}
	prepareTiming.End(observe.OK, observe.CacheUnknown)
	readTiming := observe.Start(ctx, "gateway.resource.read", labels)
	read, err := client.ReadResource(ctx, params)
	readTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return primitive.GetResult{}, err
	}
	decodeTiming := observe.Start(ctx, "gateway.resource.decode", labels)
	defer func() { decodeTiming.End(observe.OutcomeFor(resultErr), observe.CacheUnknown) }()
	if read == nil || read.ResultType != "" && read.ResultType != schema.ResultTypeComplete || len(read.Contents) != 1 || read.Contents[0].Uri != ref.URI || read.Contents[0].Blob != "" || len(read.Contents[0].Text) == 0 || len(read.Contents[0].Text) > 4<<20 {
		return primitive.GetResult{}, identity.ErrResource
	}
	raw := []byte(read.Contents[0].Text)
	if !json.Valid(raw) {
		var decoded any
		if err := yaml.Unmarshal(raw, &decoded); err != nil {
			return primitive.GetResult{}, identity.ErrResource
		}
		raw, err = json.Marshal(decoded)
		if err != nil {
			return primitive.GetResult{}, identity.ErrResource
		}
	}
	if !json.Valid(raw) {
		return primitive.GetResult{}, fmt.Errorf("%w: resource definition is not JSON", identity.ErrResource)
	}
	resource.DefinitionBytes = append([]byte(nil), raw...)
	resource.Definition = resource.DefinitionBytes
	resource.FormatVersion = 1
	resource.ContentFingerprint = identity.ContentFingerprint(raw)
	resource.Lifecycle = identity.WorkingCandidate
	pin := &identity.ResolvedResource{URI: ref.URI, ProviderIdentity: caps.connection.ProviderIdentity, ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: resource.ContentFingerprint}}
	if supplied, ok := read.Contents[0].Meta["resource"]; ok {
		encoded, err := json.Marshal(supplied)
		var returned identity.ResolvedResource
		if err != nil || json.Unmarshal(encoded, &returned) != nil || returned.URI != ref.URI || returned.ProviderIdentity != caps.connection.ProviderIdentity || !returned.ResourceCandidate.Valid() {
			return primitive.GetResult{}, identity.ErrResource
		}
		pin = &returned
		resource.ContentFingerprint = pin.ContentFingerprint
		resource.Revision = pin.Selector()
		resource.Lifecycle = pin.Kind
	}
	if ref.Revision != "" && ref.Revision != pin.Selector() {
		return primitive.GetResult{}, identity.ErrResourceStale
	}
	return primitive.GetResult{Resource: &resource, ResolvedResource: pin}, nil
}
