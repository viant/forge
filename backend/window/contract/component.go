// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package window

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// ComponentDispatcher is an explicit producer-supported exact execution
// contract. Service/method are trusted descriptor identities; the producer
// resolves their native route rather than accepting ignored version arguments
// on a generic MCP tool. Observations must describe the actual selected source.
type ComponentDispatcher interface {
	IsComponentProducer(string) bool
	ObserveComponent(context.Context, string, string, ComponentBinding) (ComponentBinding, error)
	ExecuteComponent(context.Context, string, string, ComponentBinding, map[string]interface{}) (json.RawMessage, error)
}

// DeclaredComponentDispatcher classifies known native producers independently
// of whether their exact transport is available. It never invents observations
// or falls back to generic tool dispatch.
type DeclaredComponentDispatcher struct {
	services  map[string]bool
	transport ComponentDispatcher
}

func NewDeclaredComponentDispatcher(services []string, transport ComponentDispatcher) (*DeclaredComponentDispatcher, error) {
	declared := &DeclaredComponentDispatcher{services: map[string]bool{}, transport: transport}
	for _, service := range services {
		if service == "" || strings.TrimSpace(service) != service || declared.services[service] {
			return nil, ErrResourceBinding
		}
		declared.services[service] = true
	}
	return declared, nil
}
func (d *DeclaredComponentDispatcher) IsComponentProducer(service string) bool {
	return d != nil && (d.services[service] || d.transport != nil && d.transport.IsComponentProducer(service))
}
func (d *DeclaredComponentDispatcher) ObserveComponent(ctx context.Context, service, method string, pin ComponentBinding) (ComponentBinding, error) {
	if d == nil || d.transport == nil || !d.transport.IsComponentProducer(service) {
		return ComponentBinding{}, fmt.Errorf("exact component producer transport unavailable")
	}
	return d.transport.ObserveComponent(ctx, service, method, pin)
}
func (d *DeclaredComponentDispatcher) ExecuteComponent(ctx context.Context, service, method string, pin ComponentBinding, args map[string]interface{}) (json.RawMessage, error) {
	if d == nil || d.transport == nil || !d.transport.IsComponentProducer(service) {
		return nil, fmt.Errorf("exact component producer transport unavailable")
	}
	return d.transport.ExecuteComponent(ctx, service, method, pin, args)
}
