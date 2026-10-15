// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package requestctx

import (
	"context"
	"github.com/viant/forge/backend/types"
)

type windowTargetKey struct{}

func WithWindowTarget(ctx context.Context, target *types.WindowTarget) context.Context {
	if target == nil {
		return ctx
	}
	normalized, err := target.Normalize()
	if err != nil {
		return ctx
	}
	return context.WithValue(ctx, windowTargetKey{}, normalized)
}
func WindowTargetFromContext(ctx context.Context) (*types.WindowTarget, bool) {
	if ctx == nil {
		return nil, false
	}
	target, ok := ctx.Value(windowTargetKey{}).(types.WindowTarget)
	if !ok {
		return nil, false
	}
	normalized, err := target.Normalize()
	if err != nil {
		return nil, false
	}
	return &normalized, true
}
