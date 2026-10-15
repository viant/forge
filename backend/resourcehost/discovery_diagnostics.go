package resource

import (
	"context"
	primitive "github.com/viant/forge/backend/provider/contract"
)

// DiscoverConnection resolves one configured connection through the shared cache.
func (g *Gateway) DiscoverConnection(ctx context.Context, name string) ([]primitive.NamespaceCapabilities, error) {
	actor, err := g.actor(ctx)
	if err != nil {
		return nil, err
	}
	caps, err := g.discover(ctx, actor, name)
	if err != nil {
		return nil, err
	}
	return cloneCapabilities(caps).namespaces, nil
}

// ReadSelectionCount exposes operation-local selection count for diagnostics.
func ReadSelectionCount(ctx context.Context) int {
	s := sequenceFromContext(ctx)
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.reads)
}
