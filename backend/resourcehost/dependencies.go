// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	"fmt"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"strings"
)

func (g *Gateway) dependencyConnection(ctx context.Context, parent Connection, owner, namespace string) (Connection, error) {
	if owner == parent.ProviderIdentity && namespace == "" {
		return parent, nil
	}
	if connection, found, err := g.declaredOwnerNamespaceConnection(ctx, owner, namespace); found || err != nil {
		return connection, err
	}
	discovered, e := g.Discover(ctx)
	if e != nil {
		return Connection{}, e
	}
	var found Connection
	for _, ns := range discovered {
		if ns.Connection.ProviderIdentity == owner && (namespace == "" || ns.Namespace == namespace) {
			if found.Name != "" && found != ns.Connection {
				return Connection{}, ErrCollision
			}
			found = ns.Connection
		}
	}
	if found.Name == "" {
		return found, identity.ErrResourceDenied
	}
	return found, nil
}

// An explicit configured owner is a routing claim, never an authorization
// grant. Validate all configured claims without contacting unrelated endpoints,
// then verify the selected provider's live identity under the current actor.
func (g *Gateway) declaredOwnerConnection(ctx context.Context, owner string) (Connection, bool, error) {
	return g.declaredOwnerNamespaceConnection(ctx, owner, "")
}
func (g *Gateway) declaredOwnerNamespaceConnection(ctx context.Context, owner, namespace string) (Connection, bool, error) {
	if owner == "" {
		return Connection{}, false, nil
	}
	actor, err := g.actor(ctx)
	if err != nil {
		return Connection{}, true, err
	}
	connection, found, err := g.configuredOwnerNamespaceConnection(ctx, owner, namespace)
	if !found || err != nil {
		return connection, found, err
	}
	caps, err := g.discover(ctx, actor, connection.Name)
	if err != nil {
		return Connection{}, true, err
	}
	if caps.connection != connection {
		return Connection{}, true, ErrCollision
	}
	if err = g.final(ctx, actor); err != nil {
		return Connection{}, true, err
	}
	return caps.connection, true, nil
}

// configuredOwnerConnection resolves only trusted routing claims. Its caller
// must perform a fresh provider operation before using any resource or facts.
func (g *Gateway) configuredOwnerConnection(ctx context.Context, owner string) (Connection, bool, error) {
	return g.configuredOwnerNamespaceConnection(ctx, owner, "")
}

// A provider may expose separate namespace endpoints. Unscoped lookups must
// remain ambiguous when more than one connection claims the same owner.
func (g *Gateway) configuredOwnerNamespaceConnection(ctx context.Context, owner, namespace string) (Connection, bool, error) {
	if g == nil || g.Manager == nil || owner == "" || ctx == nil || ctx.Err() != nil {
		return Connection{}, true, identity.ErrResourceDenied
	}
	names, err := g.catalogConnectionNames(ctx)
	if err != nil {
		return Connection{}, true, err
	}
	var selected Connection
	for _, name := range names {
		candidate := Connection{Name: name, ProviderIdentity: owner, Generation: g.generation(name)}
		if source, ok := g.publishedByName(name); ok {
			if source.connection.ProviderIdentity != owner || namespace != "" && !source.namespaces[namespace] {
				continue
			}
		} else {
			options, err := g.Manager.Options(ctx, name)
			if err != nil {
				return Connection{}, true, err
			}
			if options == nil || options.PrimitiveProviderIdentity != owner {
				continue
			}
			if namespace != "" && len(options.PrimitiveNamespaces) > 0 {
				matches := false
				for _, claim := range options.PrimitiveNamespaces {
					if claim == namespace || claim == "ns://"+namespace {
						matches = true
						break
					}
				}
				if !matches {
					continue
				}
			}
		}
		if selected.Name != "" && selected.Name != name {
			return Connection{}, true, fmt.Errorf("%w: owner %q namespace %q configured by multiple connections", ErrCollision, owner, namespace)
		}
		selected = candidate
	}
	return selected, selected.Name != "", nil
}

// ResolveDependencyPins authorizes each explicit child candidate and compares
// the server materialized attachment with the exact child descriptor. Existing
// pins are mandatory on execution/re-read; omitted pins only start a new open.
func (g *Gateway) ResolveDependencyPins(ctx context.Context, parent Connection, parentPin identity.ResolvedResource, refs map[string]primitive.DataSourceReference, descriptors map[string]json.RawMessage, existing map[string]identity.ResolvedResource) (map[string]identity.ResolvedResource, error) {
	pins, _, err := g.resolveDependencyReads(ctx, parent, parentPin, refs, descriptors, existing, false)
	return pins, err
}

func (g *Gateway) resolveDependencyReads(ctx context.Context, parent Connection, parentPin identity.ResolvedResource, refs map[string]primitive.DataSourceReference, descriptors map[string]json.RawMessage, existing map[string]identity.ResolvedResource, collect bool) (map[string]identity.ResolvedResource, []selectedResourceRead, error) {
	if existing != nil && len(existing) != len(refs) {
		return nil, nil, identity.ErrResourceDenied
	}
	result := make(map[string]identity.ResolvedResource, len(refs))
	reads := []selectedResourceRead{}
	reportSequence := sequenceFromContext(ctx) != nil && strings.HasPrefix(parentPin.URI, "report://")
	for id, ref := range refs {
		if ref.Validate(parentPin.Kind == identity.StampedCandidate) != nil || descriptors[id] == nil {
			return nil, nil, identity.ErrResourceDenied
		}
		connection, e := g.dependencyConnection(ctx, parent, ref.ProviderIdentity, resourceNamespace(ref.Resource.URI))
		if e != nil {
			return nil, nil, e
		}
		var original *identity.ResolvedResource
		if existing != nil {
			pin, ok := existing[id]
			if !ok || !ref.MatchesResolved(pin) {
				return nil, nil, identity.ErrResourceDenied
			}
			original = &pin
		}
		child, e := Get[json.RawMessage](ctx, g, connection, ref.Resource, original)
		if e != nil {
			return nil, nil, fmt.Errorf("dependency %q (%s): %w", id, ref.Resource.URI, e)
		}
		if !ref.MatchesResolved(*child.ResolvedResource) {
			return nil, nil, identity.ErrResourceDenied
		}
		var envelope struct {
			SchemaVersion int64           `json:"schemaVersion"`
			DataSource    json.RawMessage `json:"dataSource"`
		}
		decoder := json.NewDecoder(strings.NewReader(string(child.Resource.Definition)))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&envelope) != nil || envelope.SchemaVersion != 1 || !json.Valid(envelope.DataSource) {
			return nil, nil, identity.ErrResourceDenied
		}
		canonical, e := types.CanonicalWindowDescriptor(envelope.DataSource)
		if e != nil {
			return nil, nil, e
		}
		var descriptor map[string]json.RawMessage
		if json.Unmarshal(canonical, &descriptor) != nil || descriptor == nil {
			return nil, nil, identity.ErrResourceDenied
		}
		var sourceID string
		if json.Unmarshal(descriptor["id"], &sourceID) != nil || sourceID == "" {
			return nil, nil, identity.ErrResourceDenied
		}
		encodedID, _ := json.Marshal(id)
		descriptor["id"] = encodedID
		derived, e := json.Marshal(descriptor)
		if e != nil {
			return nil, nil, e
		}
		expected, e := types.WindowDescriptorFingerprint(descriptors[id])
		if e != nil {
			return nil, nil, e
		}
		actual, e := types.WindowDescriptorFingerprint(derived)
		if e != nil || actual != expected {
			return nil, nil, identity.ErrResourceDenied
		}
		result[id] = *child.ResolvedResource
		if collect || reportSequence {
			if collect && original == nil {
				return nil, nil, identity.ErrResourceDenied
			}
			selected := *child.ResolvedResource
			if original != nil {
				selected = *original
			}
			reads = append(reads, selectedResourceRead{connection: connection, pin: selected, result: child.GetResult, definitionCache: child.definitionCache})
		}
	}
	if reportSequence {
		if err := g.recordReportDependencies(ctx, parentPin, reads); err != nil {
			return nil, nil, err
		}
	}
	return result, reads, nil
}

func resourceNamespace(value string) string {
	uri, err := identity.ParseResourceURI(value)
	if err != nil {
		return ""
	}
	return uri.Namespace
}
