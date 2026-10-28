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
	if r == nil || r.gateway == nil || root.Name == "" || root.ProviderIdentity == "" {
		return nil, false, identity.ErrResource
	}
	g := r.gateway
	if source, ok := g.publishedByName(root.Name); ok {
		if root.ProviderIdentity != source.connection.ProviderIdentity {
			return nil, true, ErrCollision
		}
		actor, err := g.actor(ctx)
		if err != nil {
			return nil, true, err
		}
		rows, err := g.listPublished(ctx, source, "mcp", "", root)
		if err != nil {
			return nil, true, err
		}
		out := make([]Located[json.RawMessage], 0, len(rows))
		for _, row := range rows {
			out = append(out, Located[json.RawMessage]{LocatedResource: row})
		}
		if err = g.final(ctx, actor); err != nil {
			return nil, true, err
		}
		return out, true, nil
	}
	actor, err := g.actor(ctx)
	if err != nil {
		return nil, false, err
	}
	binding, err := g.resolveReadBinding(ctx, actor, root.Name)
	if err != nil {
		return nil, false, err
	}
	if binding.options.PrimitiveProviderIdentity != root.ProviderIdentity {
		return nil, false, ErrCollision
	}
	if len(binding.options.PrimitiveNamespaces) != 1 {
		return nil, false, nil
	}
	collection := binding.options.PrimitiveNamespaces[0]
	namespace, err := namespaces.ParseURI(collection)
	if err != nil || namespace == "" {
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
		listed, e := filtered.ListResourcesWithParams(ctx, params)
		if e != nil {
			return nil, true, e
		}
		if listed == nil || listed.ResultType != "" && listed.ResultType != schema.ResultTypeComplete || listed.TtlMs < 0 || len(listed.Resources) > 100 {
			return nil, true, identity.ErrResource
		}
		for _, entry := range listed.Resources {
			uri, parseErr := identity.ParseResourceURI(entry.Uri)
			if parseErr != nil || uri.Kind != "mcp" || uri.Namespace != namespace || entry.Name == "" || seen[entry.Uri] {
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
				return nil, true, err
			}
			if err = g.final(ctx, actor); err != nil {
				return nil, true, err
			}
			if g.generation(root.Name) != generation {
				return nil, true, identity.ErrResourceStale
			}
			return result, true, nil
		}
		if *listed.NextCursor == "" || seenCursor[*listed.NextCursor] {
			return nil, true, identity.ErrResource
		}
		seenCursor[*listed.NextCursor] = true
		cursor = listed.NextCursor
	}
	return nil, true, fmt.Errorf("%w: MCP definition inventory page bound", identity.ErrResource)
}
