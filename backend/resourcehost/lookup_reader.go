package resource

import (
	"context"
	"encoding/json"
	"fmt"

	lookup "github.com/viant/forge/backend/lookup/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

type LookupReader struct{ Gateway *Gateway }

func NewLookupReader(g *Gateway) *LookupReader { return &LookupReader{Gateway: g} }

// LoadAll consumes the existing metadata catalog and exact typed Get slots.
// It never scans a workspace or reconstructs the managing provider.
func (r *LookupReader) LoadAll(ctx context.Context, scope DefinitionScope) ([]*lookup.Overlay, error) {
	var definitions []*lookup.Overlay
	query := CatalogQuery{Namespace: scope.Namespace, Limit: 1000}
	ids := map[string]string{}
	var roots []Connection
	if scope.ProviderIdentity != "" {
		root, err := r.Gateway.ConnectionForProvider(ctx, scope.ProviderIdentity)
		if err != nil {
			return nil, err
		}
		roots = []Connection{root}
	}

	for {
		var page *primitive.CatalogPage[Located[json.RawMessage]]
		var err error
		if len(roots) > 0 {
			page, err = ListPageFrom[json.RawMessage](ctx, r.Gateway, roots, "lookup", query)
		} else {
			page, err = ListPage[json.RawMessage](ctx, r.Gateway, "lookup", query)
		}
		if err != nil {
			return nil, err
		}
		for _, row := range page.Items {
			if scope.ProviderIdentity != "" && scope.ProviderIdentity != row.Connection.ProviderIdentity {
				continue
			}
			result, err := Get[*lookup.Overlay](ctx, r.Gateway, row.Connection, identity.ResourceRef{URI: row.Resource.URI, Revision: row.Resource.Revision}, nil, func(raw json.RawMessage) (*lookup.Overlay, error) { return DecodeLookupDefinition(1, raw) })
			if err != nil {
				return nil, err
			}
			if original := ids[result.Definition.ID]; original != "" && original != row.Resource.URI+"\x00"+row.Connection.ProviderIdentity {
				return nil, fmt.Errorf("%w: ambiguous lookup overlay id", ErrCollision)
			}
			ids[result.Definition.ID] = row.Resource.URI + "\x00" + row.Connection.ProviderIdentity
			definition := *result.Definition
			definition.Resource = result.ResolvedResource
			definition.Bindings = append([]lookup.Binding(nil), definition.Bindings...)
			for i := range definition.Bindings {
				projected, e := definition.Bindings[i].Lookup.WithResourceScope(result.ResolvedResource)
				if e != nil {
					return nil, e
				}
				definition.Bindings[i].Lookup = projected
			}

			definitions = append(definitions, &definition)
		}
		if page.Complete {
			return definitions, nil
		}
		if page.NextCursor == "" {
			return nil, identity.ErrResource
		}
		query.Cursor = page.NextCursor
	}
}
