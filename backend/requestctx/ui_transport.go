// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package requestctx

import "context"

type uiBridgeSessionKey struct{}

// WithUIBridgeSessionID carries the existing transport session for host-only
// lookup. It is neither identity facts nor an upstream MCP credential.
func WithUIBridgeSessionID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, uiBridgeSessionKey{}, id)
}
func UIBridgeSessionIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	id, _ := ctx.Value(uiBridgeSessionKey{}).(string)
	return id
}

type uiWindowRoutingKey struct{}

// WithUIWindowID selects an exact held instance only after transport ownership.
func WithUIWindowID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, uiWindowRoutingKey{}, id)
}
func UIWindowIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	id, _ := ctx.Value(uiWindowRoutingKey{}).(string)
	return id
}
