// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
)

// ResolveDefinition selects an exact URI or a unique authored alias from the
// same private manager snapshot, then freshly admits the selected definition.
// DefinitionScope contains routing expectations from an admitted parent. It grants no access.
type DefinitionScope struct {
	Namespace        string
	ProviderIdentity string
}

type definitionScopeKey struct{}

// WithDefinitionScope carries routing expectations from an admitted parent;
// it changes no provider authority or actor admission.
func WithDefinitionScope(ctx context.Context, scope DefinitionScope) context.Context {
	return context.WithValue(ctx, definitionScopeKey{}, scope)
}
func definitionScope(ctx context.Context) DefinitionScope {
	if ctx == nil {
		return DefinitionScope{}
	}
	scope, _ := ctx.Value(definitionScopeKey{}).(DefinitionScope)
	return scope
}

func ResolveDefinition[T any](ctx context.Context, g *Gateway, kind, key string, alias func(T) string, decoder ...DefinitionDecoder[T]) (*Result[T], error) {
	return ResolveDefinitionIn[T](ctx, g, kind, key, definitionScope(ctx), alias, decoder...)
}
func ResolveDefinitionIn[T any](ctx context.Context, g *Gateway, kind, key string, scope DefinitionScope, alias func(T) string, decoder ...DefinitionDecoder[T]) (*Result[T], error) {
	// Alias matching must inspect the full visible catalog for collisions. Read
	// its largest bounded in-memory page to avoid rebuilding provider discovery
	// for every 100 candidates; the owning Get below remains fresh.
	query := CatalogQuery{Limit: primitive.MaxCatalogPageSize}
	var selected *Located[json.RawMessage]
	parsed, parseErr := identity.ParseResourceURI(key)
	exactURI := parseErr == nil && parsed.Kind == kind
	if exactURI {
		// Absolute references may cross the parent's provider boundary. Resolve
		// their owner with the ordinary namespace collision checks, then read
		// only the selected definition rather than hydrating the entire catalog.
		connection, err := g.ConnectionForResource(ctx, parsed, "")
		if err != nil {
			return nil, err
		}
		return Get[T](ctx, g, connection, identity.ResourceRef{URI: key}, nil, decoder...)
	}
	if !exactURI && scope.ProviderIdentity != "" {
		// An authored relative reference belongs to its selected provider. Use
		// the existing rooted catalog/cache instead of discovering other MCPs.
		// Absolute URIs retain cross-provider resolution semantics.
		connection, found, err := g.configuredOwnerNamespaceConnection(ctx, scope.ProviderIdentity, scope.Namespace)
		if err != nil {
			return nil, err
		}
		if found {
			if !catalogRootMatches(ctx, connection) {
				return nil, identity.ErrResourceDenied
			}
			ctx = context.WithValue(ctx, catalogRootsKey{}, []Connection{connection})
		}
		query.Namespace = scope.Namespace
	}
	for {
		pageTiming := observe.Start(ctx, observe.Phase("definition.resolve.page"), observe.Labels{Kind: kind})
		page, err := ListPage[json.RawMessage](ctx, g, kind, query, true)
		pageTiming.End(observe.OutcomeFor(err), observe.CacheUnknown)
		if err != nil {
			return nil, err
		}
		for _, candidate := range page.Items {
			if !exactURI && ((scope.Namespace != "" && candidate.Resource.Namespace != scope.Namespace) || (scope.ProviderIdentity != "" && candidate.Connection.ProviderIdentity != scope.ProviderIdentity)) {
				continue
			}
			matches := candidate.Resource.URI == key
			if !exactURI && alias != nil {
				var projection T
				var decodeErr error
				if len(decoder) > 0 && decoder[0] != nil {
					projection, decodeErr = decoder[0](candidate.Definition)
				} else {
					projection, decodeErr = decodeDefinition[T](candidate.Definition)
				}
				if decodeErr != nil {
					return nil, decodeErr
				}
				matches = alias(projection) == key
			}
			if matches {
				if selected != nil {
					return nil, ErrCollision
				}
				copy := candidate
				selected = &copy
			}
		}
		if page.Complete {
			break
		}
		if page.NextCursor == "" {
			return nil, primitive.ErrCatalogCursor
		}
		query.Cursor = page.NextCursor
	}
	if selected == nil {
		return nil, identity.ErrResourceDenied
	}
	got, err := Get[T](ctx, g, selected.Connection, identity.ResourceRef{URI: selected.Resource.URI, Revision: selected.Resource.Revision}, nil, decoder...)
	if err != nil {
		return nil, err
	}
	if selected.Resource.ContentFingerprint != "" && selected.Resource.ContentFingerprint != got.Resource.ContentFingerprint {
		return nil, identity.ErrResourceStale
	}
	return got, nil
}
