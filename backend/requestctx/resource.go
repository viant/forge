// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package requestctx

import (
	"context"
	identity "github.com/viant/forge/backend/resource"
)

type resolvedResourceKey struct{}

// WithResolvedResource carries a server-resolved window/report pin. This is
// request context only, never authorization of a client-provided wire claim.
func WithResolvedResource(ctx context.Context, pin identity.ResolvedResource) context.Context {
	return context.WithValue(ctx, resolvedResourceKey{}, pin)
}
func ResolvedResourceFromContext(ctx context.Context) (*identity.ResolvedResource, bool) {
	if ctx == nil {
		return nil, false
	}
	pin, ok := ctx.Value(resolvedResourceKey{}).(identity.ResolvedResource)
	if !ok {
		return nil, false
	}
	return &pin, true
}
