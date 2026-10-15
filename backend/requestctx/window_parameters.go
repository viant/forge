// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package requestctx

import "context"

type windowParametersKey struct{}

// WindowParameters are untrusted selectors, never identity or permission facts.
func WithWindowParameters(ctx context.Context, parameters map[string]any) context.Context {
	copy := make(map[string]any, len(parameters))
	for key, value := range parameters {
		copy[key] = value
	}
	return context.WithValue(ctx, windowParametersKey{}, copy)
}

func WindowParametersFromContext(ctx context.Context) map[string]any {
	parameters, _ := ctx.Value(windowParametersKey{}).(map[string]any)
	copy := make(map[string]any, len(parameters))
	for key, value := range parameters {
		copy[key] = value
	}
	return copy
}
