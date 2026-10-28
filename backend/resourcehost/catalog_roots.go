// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"sort"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

type catalogRootsKey struct{}

// ListPageFrom uses the same generic catalog/cache with explicit host-selected
// roots. It never expands those roots through Manager.Names; actor and credential
// context remain intact. Roots are routing restrictions, never authorization.
func ListPageFrom[T any](ctx context.Context, g *Gateway, roots []Connection, kind string, query CatalogQuery, hydrate ...bool) (*primitive.CatalogPage[Located[T]], error) {
	if ctx == nil || g == nil || g.Manager == nil || len(roots) == 0 {
		return nil, identity.ErrResource
	}
	return ListPage[T](context.WithValue(ctx, catalogRootsKey{}, append([]Connection(nil), roots...)), g, kind, query, hydrate...)
}
func (g *Gateway) catalogConnectionNames(ctx context.Context) ([]string, error) {
	roots, ok := ctx.Value(catalogRootsKey{}).([]Connection)
	if !ok {
		var names []string
		var err error
		sources := g.publishedRegistrations()
		if len(sources) > 0 {
			excluded := make([]string, 0, len(sources))
			for _, source := range sources {
				for alias := range source.aliases {
					excluded = append(excluded, alias)
				}
			}
			names, err = g.Manager.CatalogNamesExcluding(ctx, excluded)
		} else {
			names, err = g.Manager.CatalogNames(ctx)
		}
		if err != nil {
			return nil, err
		}
		seen := map[string]bool{}
		for _, name := range names {
			seen[name] = true
		}
		for _, source := range g.publishedRegistrations() {
			if !seen[source.connection.Name] {
				names = append(names, source.connection.Name)
			}
		}
		sort.Strings(names)
		return names, nil
	}
	seen := map[string]bool{}
	names := make([]string, 0, len(roots))
	for _, root := range roots {
		if root.Name == "" || seen[root.Name] {
			return nil, ErrCollision
		}
		if source, ok := g.publishedByName(root.Name); ok {
			if root.ProviderIdentity != "" && root.ProviderIdentity != source.connection.ProviderIdentity {
				return nil, ErrCollision
			}
			names = append(names, root.Name)
			seen[root.Name] = true
			continue
		}
		options, err := g.Manager.Options(ctx, root.Name)
		if err != nil {
			return nil, err
		}
		if options == nil || root.ProviderIdentity != "" && options.PrimitiveProviderIdentity != "" && options.PrimitiveProviderIdentity != root.ProviderIdentity {
			return nil, ErrCollision
		}
		names = append(names, root.Name)
		seen[root.Name] = true
	}
	sort.Strings(names)
	return names, nil
}
func catalogRootMatches(ctx context.Context, connection Connection) bool {
	roots, ok := ctx.Value(catalogRootsKey{}).([]Connection)
	if !ok {
		return true
	}
	for _, root := range roots {
		if root.Name == connection.Name {
			return root.ProviderIdentity == "" || root.ProviderIdentity == connection.ProviderIdentity
		}
	}
	return false
}

// GetFrom resolves the current generation of one exact configured connection
// without global inventory, then uses the ordinary generic Get/cache.
func GetFrom[T any](ctx context.Context, g *Gateway, root Connection, ref identity.ResourceRef, decode DefinitionDecoder[T]) (*Result[T], error) {
	if ctx == nil || g == nil || g.Manager == nil || root.Name == "" {
		return nil, identity.ErrResourceDenied
	}
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil {
		return nil, err
	}
	if source, covered := g.publishedNamespace(uri.Namespace); covered {
		if !source.matchesName(root.Name) || root.ProviderIdentity != "" && root.ProviderIdentity != source.connection.ProviderIdentity {
			return nil, ErrCollision
		}
		connection := source.connection
		connection.Name = root.Name
		connection.Generation = g.generation(connection.Name)
		return Get[T](ctx, g, connection, ref, nil, decode)
	}
	actor, err := g.actor(ctx)
	if err != nil {
		return nil, err
	}
	capabilities, err := g.discover(ctx, actor, root.Name)
	if err != nil {
		return nil, err
	}
	if root.ProviderIdentity != "" && capabilities.connection.ProviderIdentity != root.ProviderIdentity {
		return nil, ErrCollision
	}
	return Get[T](ctx, g, capabilities.connection, ref, nil, decode)
}
