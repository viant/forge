// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package requestctx

import (
	"context"
	identity "github.com/viant/forge/backend/resource"
)

type resourceDependenciesKey struct{}
type resourceDependencies struct {
	parent identity.ResolvedResource
	pins   map[string]identity.ResolvedResource
}

// WithResourceDependencies is installed only after the host verifies the
// parent's original dependency selection token. Pins are source expectations,
// not grants; each owning provider still authorizes its exact child.
func WithResourceDependencies(ctx context.Context, parent identity.ResolvedResource, pins map[string]identity.ResolvedResource) context.Context {
	copy := make(map[string]identity.ResolvedResource, len(pins))
	for key, pin := range pins {
		copy[key] = pin
	}
	return context.WithValue(ctx, resourceDependenciesKey{}, resourceDependencies{parent: parent, pins: copy})
}
func ResourceDependencyFromContext(ctx context.Context, id string) (*identity.ResolvedResource, bool) {
	if ctx == nil {
		return nil, false
	}
	state, ok := ctx.Value(resourceDependenciesKey{}).(resourceDependencies)
	if !ok {
		return nil, false
	}
	parent, ok := ResolvedResourceFromContext(ctx)
	if !ok || *parent != state.parent {
		return nil, false
	}
	pin, ok := state.pins[id]
	if !ok {
		return nil, false
	}
	return &pin, true
}
