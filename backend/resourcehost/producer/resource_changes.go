// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"
	"sync"

	"github.com/viant/jsonrpc"
	"github.com/viant/jsonrpc/transport"
)

// ResourceChangeSource is a source-owned standard MCP notification subscription.
// Shared static source changes are broadcast; authenticated private stores retain
// their own transport scope instead of placing identity in notification bodies.
type ResourceChangeSource interface {
	SubscribeResources(transport.Notifier) func()
}

// ResourceChanges publishes only after its owner has committed a new generation.
// It is not a cache and never reads resources or performs refresh work.
type ResourceChanges struct {
	mu    sync.Mutex
	next  uint64
	sinks map[uint64]transport.Notifier
}

func (p *ResourceChanges) SubscribeResources(sink transport.Notifier) func() {
	if sink == nil {
		return func() {}
	}
	p.mu.Lock()
	p.next++
	id := p.next
	if p.sinks == nil {
		p.sinks = map[uint64]transport.Notifier{}
	}
	p.sinks[id] = sink
	p.mu.Unlock()
	var once sync.Once
	return func() { once.Do(func() { p.mu.Lock(); delete(p.sinks, id); p.mu.Unlock() }) }
}
func (p *ResourceChanges) Publish(ctx context.Context) {
	p.mu.Lock()
	sinks := make([]transport.Notifier, 0, len(p.sinks))
	for _, sink := range p.sinks {
		sinks = append(sinks, sink)
	}
	p.mu.Unlock()
	for _, sink := range sinks {
		_ = sink.Notify(ctx, &jsonrpc.Notification{Jsonrpc: jsonrpc.Version, Method: "notifications/resources/list_changed"})
	}
}

// subscribeResourceChanges deduplicates one snapshot shared by many bindings.
func (p *LocalProvider) subscribeResourceChanges(sink transport.Notifier) func() {
	seen := map[ResourceChangeSource]bool{}
	var stops []func()
	if source, ok := p.catalog.(ResourceChangeSource); ok {
		seen[source] = true
		stops = append(stops, source.SubscribeResources(sink))
	}
	for _, binding := range p.bindings {
		if source := binding.Changes; source != nil && !seen[source] {
			seen[source] = true
			stops = append(stops, source.SubscribeResources(sink))
		}
	}
	var once sync.Once
	return func() {
		once.Do(func() {
			for _, stop := range stops {
				stop()
			}
		})
	}
}

func (p *LocalProvider) hasResourceChanges() bool {
	if _, ok := p.catalog.(ResourceChangeSource); ok {
		return true
	}
	for _, b := range p.bindings {
		if b.Changes != nil {
			return true
		}
	}
	return false
}
