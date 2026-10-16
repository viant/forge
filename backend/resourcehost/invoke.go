// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"strings"

	identity "github.com/viant/forge/backend/resource"
)

// Invoke dispatches one explicitly advertised resource action to its managing
// provider. The routing URI selects a namespace/kind; input is forwarded through
// the existing ordinary MCP encoding without adding or changing arguments.
// Successful actions invalidate this actor's lists for the affected kind.
func Invoke[T any](ctx context.Context, g *Gateway, connection Connection, uri identity.ResourceURI, operation string, input any) (T, error) {
	var zero T
	if !uri.Valid() || operation == "" || strings.TrimSpace(operation) != operation || connection.Name == "" || connection.ProviderIdentity == "" {
		return zero, identity.ErrResource
	}
	actor, err := g.actor(ctx)
	if err != nil {
		return zero, err
	}
	binding, err := g.resolveReadBinding(ctx, actor, connection.Name)
	if err != nil {
		return zero, err
	}
	capabilities, err := g.discover(ctx, actor, connection.Name, binding)
	if err != nil {
		return zero, err
	}
	if capabilities.connection.ProviderIdentity != connection.ProviderIdentity {
		return zero, ErrCollision
	}
	if capabilities.connection != connection {
		return zero, identity.ErrResourceDenied
	}
	if !supports(capabilities, uri.Namespace, uri.Kind, operation) {
		return zero, ErrUnavailable
	}
	partition := g.Manager.CatalogPartition(ctx, catalogPrincipalScope(actor), uri.Kind)
	if err = g.checkReadBinding(ctx, actor, binding); err != nil {
		return zero, err
	}
	if err = g.final(ctx, actor); err != nil {
		return zero, err
	}
	result, err := call[T](ctx, binding.client, operationMethod(capabilities, uri.Namespace, uri.Kind, operation), input)
	if err != nil {
		return zero, err
	}
	// Capture the original authenticated partition before dispatch. A successful
	// write must invalidate it even if the subsequent delivery check detects drift.
	g.Manager.InvalidateVisibleCatalogPartition(partition)
	if err = g.checkReadBinding(ctx, actor, binding); err != nil {
		return zero, err
	}
	if err = g.final(ctx, actor); err != nil {
		return zero, err
	}
	return result, nil
}
