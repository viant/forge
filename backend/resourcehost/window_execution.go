// SPDX-License-Identifier: Apache-2.0
// Shared primitive delivery; kept aligned with the Core compatibility boundary.
package resource

import (
	"context"
	"encoding/json"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func (g *Gateway) ConnectionForProvider(ctx context.Context, owner string) (Connection, error) {
	return g.dependencyConnection(ctx, Connection{}, owner)
}
func (g *Gateway) ConnectionForResource(ctx context.Context, uri identity.ResourceURI, owner string) (result Connection, resultErr error) {
	span := observe.Start(ctx, "gateway.routing", observe.Labels{Kind: uri.Kind})
	defer func() { span.End(observe.OutcomeFor(resultErr), observe.CacheUnknown) }()
	if connection, found, err := g.declaredOwnerConnection(ctx, owner); found || err != nil {
		if err != nil {
			return Connection{}, err
		}
		actor, err := g.actor(ctx)
		if err != nil {
			return Connection{}, err
		}
		caps, err := g.discover(ctx, actor, connection.Name)
		if err != nil {
			return Connection{}, err
		}
		if !supports(caps, uri.Namespace, uri.Kind, "get") {
			return Connection{}, identity.ErrResourceDenied
		}
		if err = g.final(ctx, actor); err != nil {
			return Connection{}, err
		}
		return connection, nil
	}
	discovered, e := g.Discover(ctx)
	if e != nil {
		return Connection{}, e
	}
	var found Connection
	for _, ns := range discovered {
		if ns.Namespace != uri.Namespace || owner != "" && ns.Connection.ProviderIdentity != owner {
			continue
		}
		caps := capabilities{namespaces: []primitive.NamespaceCapabilities{ns.NamespaceCapabilities}}
		if !supports(caps, uri.Namespace, uri.Kind, "get") {
			continue
		}
		if found.Name != "" && found != ns.Connection {
			return Connection{}, ErrCollision
		}
		found = ns.Connection
	}
	if found.Name == "" {
		return found, identity.ErrResourceDenied
	}
	return found, nil
}

// VerifyDependencies is suitable for PreparedAuthorization's explicit child
// verifier. The signed target binds the supplied pins; pins alone grant nothing.
func (c *WindowCatalog) VerifyDependencies(ctx context.Context, parent identity.ResolvedResource, target *types.WindowTarget, variant *types.WindowResourceVariant) error {
	_, err := c.verifyDependencyReads(ctx, parent, target, variant, false)
	return err
}

func (c *WindowCatalog) verifyDependencyReads(ctx context.Context, parent identity.ResolvedResource, target *types.WindowTarget, variant *types.WindowResourceVariant, collect bool) ([]selectedResourceRead, error) {
	if !c.AuthzReady() || target == nil || variant == nil || target.SelectionToken == "" {
		return nil, identity.ErrResourceDenied
	}
	if e := c.TargetProof.Verify(ctx, parent, *target, variant.Fingerprint, target.SelectionToken); e != nil {
		return nil, e
	}
	if len(variant.DataSourceResources) == 0 {
		if len(target.DependencyPins) > 0 {
			return nil, identity.ErrResourceDenied
		}
		return nil, nil
	}
	if len(target.DependencyPins) != len(variant.DataSourceResources) {
		return nil, identity.ErrResourceDenied
	}
	connection, e := c.Gateway.ConnectionForProvider(ctx, parent.ProviderIdentity)
	if e != nil {
		return nil, e
	}
	_, reads, e := c.Gateway.resolveDependencyReads(ctx, connection, parent, variant.DataSourceResources, variant.DataSources, target.DependencyPins, collect)
	return reads, e
}

func (c *WindowCatalog) ResolveDatasource(ctx context.Context, parent identity.ResolvedResource, target *types.WindowTarget, id string) (out *dsproto.DataSource, err error) {
	defer func() { poisonReadSequence(ctx, err) }()
	if !c.AuthzReady() {
		return nil, identity.ErrResourceDenied
	}
	connection, e := c.Gateway.ConnectionForProvider(ctx, parent.ProviderIdentity)
	if e != nil {
		return nil, e
	}
	definition, e := GetWithCodec[*types.CompiledWindowResource](ctx, c.Gateway, connection, identity.ResourceRef{URI: parent.URI, Revision: parent.Selector()}, &parent, DefinitionCodec[*types.CompiledWindowResource]{ID: "forge.window.resource.v1", Parse: types.CompileWindowResource})
	if e != nil {
		return nil, e
	}
	variant, e := definition.Definition.Select(target)
	if e != nil {
		return nil, e
	}
	reads, e := c.verifyDependencyReads(ctx, parent, target, variant, sequenceFromContext(ctx) != nil)
	if e != nil {
		return nil, e
	}
	raw := variant.DataSources[id]
	if raw == nil {
		return nil, identity.ErrResourceDenied
	}
	var datasource dsproto.DataSource
	if json.Unmarshal(raw, &datasource) != nil || datasource.ID != id {
		return nil, identity.ErrResourceDenied
	}
	reads = append(reads, selectedResourceRead{connection: connection, pin: parent, result: definition.GetResult, definitionCache: definition.definitionCache})
	if e = c.registerSelectedDatasource(ctx, parent, target, id, variant, reads); e != nil {
		return nil, e
	}
	if _, e = Get[json.RawMessage](ctx, c.Gateway, connection, identity.ResourceRef{URI: parent.URI}, &parent); e != nil {
		return nil, e
	}
	if e = c.VerifyDependencies(ctx, parent, target, variant); e != nil {
		return nil, e
	}
	return &datasource, nil
}
