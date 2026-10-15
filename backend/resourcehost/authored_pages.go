// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package resource

import (
	"context"

	identity "github.com/viant/forge/backend/resource"
)

func authoredPages[T any](ctx context.Context, g *Gateway, kind string) ([]Located[T], error) {
	var out []Located[T]
	q := CatalogQuery{Limit: 100}
	for {
		p, err := ListPage[T](ctx, g, kind, q, true)
		if err != nil {
			return nil, err
		}
		scope := definitionScope(ctx)
		for _, row := range p.Items {
			if (scope.Namespace == "" || row.Resource.Namespace == scope.Namespace) && (scope.ProviderIdentity == "" || row.Connection.ProviderIdentity == scope.ProviderIdentity) {
				out = append(out, row)
			}
		}
		if p.Complete {
			return out, nil
		}
		if p.NextCursor == "" {
			return nil, identity.ErrResource
		}
		q.Cursor = p.NextCursor
	}
}
