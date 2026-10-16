// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package requestctx

import (
	"context"
	"sync/atomic"
)

type windowReadDecisionKey struct{}
type windowReadDecisionState struct{ closed atomic.Bool }

// WithWindowReadDecision marks a trusted, explicitly bounded pure read phase.
// It carries no identity, grant or permission result and is never decoded from
// request arguments. The returned closer invalidates every derived context.
func WithWindowReadDecision(ctx context.Context) (context.Context, func()) {
	state := &windowReadDecisionState{}
	return context.WithValue(ctx, windowReadDecisionKey{}, state), func() { state.closed.Store(true) }
}
func WindowReadDecisionActive(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	state, _ := ctx.Value(windowReadDecisionKey{}).(*windowReadDecisionState)
	return state != nil && !state.closed.Load()
}
func WithoutWindowReadDecision(ctx context.Context) context.Context {
	if ctx == nil {
		return nil
	}
	return context.WithValue(ctx, windowReadDecisionKey{}, (*windowReadDecisionState)(nil))
}
