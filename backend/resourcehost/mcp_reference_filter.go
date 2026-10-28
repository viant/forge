package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	namespaces "github.com/viant/mcp-protocol/extension/namespaces"
	"github.com/viant/mcp-protocol/schema"
)

// mcpReferenceProof is issued only after this reader saw the exact URI in the
// owning provider's authenticated, mcp-kind-only resource inventory. It is
// never exposed to callers or installed in the gateway's full namespace index.
type mcpReferenceProofKey struct{}
type mcpReferenceProof struct {
	connection Connection
	uri        string
}

func (r *MCPReferenceReader) filteredMCPRows(ctx context.Context, root Connection) (result []Located[json.RawMessage], supported bool, resultErr error) {
	diagnostic := mcpReferenceDiagnosticFromContext(ctx)
	diagnostic.begin("actor")
	if r == nil || r.gateway == nil || root.Name == "" || root.ProviderIdentity == "" {
		markMCPReferenceFailure(ctx, "connection_binding", "invalid_root", identity.ErrResource)
		return nil, false, identity.ErrResource
	}
	g := r.gateway
	actor, err := g.actor(ctx)
	if err != nil {
		markMCPReferenceFailure(ctx, "actor", "actor_failed", err)
		return nil, false, err
	}
	diagnostic.begin("connection_binding")
	binding, err := g.resolveReadBinding(ctx, actor, root.Name)
	if err != nil {
		markMCPReferenceFailure(ctx, "connection_binding", "connection_binding_failed", err)
		return nil, false, err
	}
	if binding.options.PrimitiveProviderIdentity != root.ProviderIdentity {
		markMCPReferenceFailure(ctx, "connection_binding", "provider_identity_mismatch", ErrCollision)
		return nil, false, ErrCollision
	}
	if len(binding.options.PrimitiveNamespaces) != 1 {
		return nil, false, nil
	}
	collection := binding.options.PrimitiveNamespaces[0]
	namespace, err := namespaces.ParseURI(collection)
	if err != nil || namespace == "" {
		markMCPReferenceFailure(ctx, "connection_binding", "invalid_namespace", identity.ErrResource)
		return nil, false, identity.ErrResource
	}
	if !resourceFiltersSupported(ctx, binding.client) || !standardResourceReadSupported(ctx, binding.client) {
		return nil, false, nil
	}
	filtered, ok := binding.client.(filteredResourceClient)
	if !ok {
		return nil, false, nil
	}
	supported = true
	generation := g.generation(root.Name)
	seen := map[string]bool{}
	seenCursor := map[string]bool{}
	var cursor *string
	for page := 0; page < 100; page++ {
		params := &schema.ListResourcesRequestParams{Cursor: cursor}
		params.Meta.AdditionalProperties = map[string]any{resourceFilterExtension: map[string]any{"namespace": collection, "kind": "mcp", "limit": 100}}
		diagnostic.begin("outbound_request")
		listed, e := filtered.ListResourcesWithParams(ctx, params)
		if e != nil {
			markMCPReferenceFailure(ctx, "outbound_request", "resource_list_failed", e)
			return nil, true, e
		}
		diagnostic.begin("postcheck")
		if listed == nil || listed.ResultType != "" && listed.ResultType != schema.ResultTypeComplete || listed.TtlMs < 0 || len(listed.Resources) > 100 {
			markMCPReferenceFailure(ctx, "postcheck", "invalid_list_response", identity.ErrResource)
			return nil, true, identity.ErrResource
		}
		for _, entry := range listed.Resources {
			uri, parseErr := identity.ParseResourceURI(entry.Uri)
			if parseErr != nil || uri.Kind != "mcp" || uri.Namespace != namespace || entry.Name == "" || seen[entry.Uri] {
				markMCPReferenceFailure(ctx, "postcheck", "invalid_list_entry", identity.ErrResource)
				return nil, true, identity.ErrResource
			}
			seen[entry.Uri] = true
			state := primitive.ResourceState{URI: entry.Uri, Kind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name, Title: entry.Name}
			if entry.Title != nil && strings.TrimSpace(*entry.Title) != "" {
				state.Title = *entry.Title
			}
			result = append(result, Located[json.RawMessage]{LocatedResource: LocatedResource{Connection: Connection{Name: root.Name, ProviderIdentity: root.ProviderIdentity, Generation: generation}, Resource: state}})
		}
		if listed.NextCursor == nil {
			if err = g.checkReadBinding(ctx, actor, binding); err != nil {
				markMCPReferenceFailure(ctx, "postcheck", "binding_changed", err)
				return nil, true, err
			}
			if err = g.final(ctx, actor); err != nil {
				markMCPReferenceFailure(ctx, "postcheck", "actor_recheck_failed", err)
				return nil, true, err
			}
			if g.generation(root.Name) != generation {
				markMCPReferenceFailure(ctx, "postcheck", "generation_changed", identity.ErrResourceStale)
				return nil, true, identity.ErrResourceStale
			}
			return result, true, nil
		}
		if *listed.NextCursor == "" || seenCursor[*listed.NextCursor] {
			markMCPReferenceFailure(ctx, "postcheck", "invalid_cursor", identity.ErrResource)
			return nil, true, identity.ErrResource
		}
		seenCursor[*listed.NextCursor] = true
		cursor = listed.NextCursor
	}
	err = fmt.Errorf("%w: MCP definition inventory page bound", identity.ErrResource)
	markMCPReferenceFailure(ctx, "postcheck", "page_limit_exceeded", err)
	return nil, true, err
}
