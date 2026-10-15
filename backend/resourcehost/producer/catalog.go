// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"
	"errors"
	"fmt"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
)

// ErrCatalogNotFound means the owning catalog has no such URI. Authorization
// failures must use their own error and never permit another source to answer.
// Return this sentinel directly; wrapped or joined errors remain terminal.
var ErrCatalogNotFound = errors.New("local catalog resource not found")
var ErrCatalogCollision = errors.New("local catalog resource identity collision")

// LocalCatalog is a persistent owning source for mutable inventories. Namespace
// and kind declarations are captured once at construction. List's namespace is
// a filter, never an authority input; the source scopes every request itself.
// Lookup must read one identity directly rather than listing the full catalog.
type LocalCatalog interface {
	Namespaces() []primitive.NamespaceCapabilities
	List(context.Context, identity.VerifiedActor, string, string) ([]LocalResourceBinding, error)
	Lookup(context.Context, identity.VerifiedActor, identity.ResourceURI) (LocalResourceBinding, error)
}

func (p *LocalProvider) configureCatalog(catalog LocalCatalog) error {
	if catalog == nil {
		return nil
	}
	p.catalog = catalog
	p.catalogKinds = map[string]map[string]map[int64]bool{}
	p.catalogOperations = map[string]map[string]map[string]bool{}
	for _, namespace := range catalog.Namespaces() {
		probe := identity.ResourceURI{Kind: "resource", Namespace: namespace.Namespace, Name: "catalog"}
		if !probe.Valid() || len(namespace.Kinds) == 0 || namespace.ProviderIdentity != "" && namespace.ProviderIdentity != p.identity {
			return fmt.Errorf("invalid local catalog namespace")
		}
		if p.catalogKinds[namespace.Namespace] != nil {
			return fmt.Errorf("duplicate local catalog namespace")
		}
		kinds := map[string]map[int64]bool{}
		operations := map[string]map[string]bool{}
		for _, support := range namespace.Kinds {
			if primitive.Plural(support.Kind) == "" || p.validators[support.Kind] == nil || len(support.FormatVersions) == 0 || kinds[support.Kind] != nil {
				return fmt.Errorf("invalid local catalog kind")
			}
			if support.Kind == "navigation" && p.menuActionVisibility == nil && p.menuVisibilityProjection == nil {
				return fmt.Errorf("menu catalog requires action visibility")
			}
			operations[support.Kind] = map[string]bool{}
			for _, operation := range support.Operations {
				if operations[support.Kind][operation] {
					return fmt.Errorf("duplicate local catalog operation")
				}
				if operation != "list" && operation != "get" && (!authoringOperation(operation) || p.authoring == nil) {
					return fmt.Errorf("local catalog operation requires explicit authoring backend")
				}
				operations[support.Kind][operation] = true
			}
			versions := map[int64]bool{}
			for _, version := range support.FormatVersions {
				if version < 1 || versions[version] {
					return fmt.Errorf("invalid local catalog format version")
				}
				versions[version] = true
			}
			kinds[support.Kind] = versions
		}
		p.catalogKinds[namespace.Namespace] = kinds
		p.catalogOperations[namespace.Namespace] = operations
		if _, configured := p.namespaceMetadata[namespace.Namespace]; !configured {
			metadata := namespace.NamespaceMetadata
			metadata.UseCases = append([]string(nil), metadata.UseCases...)
			p.namespaceMetadata[namespace.Namespace] = metadata
		}
	}
	if len(p.catalogKinds) == 0 {
		return fmt.Errorf("local catalog requires declared namespaces")
	}
	return nil
}

func (p *LocalProvider) catalogSupports(kind, namespace string) bool {
	for name, kinds := range p.catalogKinds {
		if (namespace == "" || namespace == name) && kinds[kind] != nil {
			return true
		}
	}
	return false
}

func (p *LocalProvider) validateCatalogBinding(binding LocalResourceBinding, kind, namespace string) error {
	uri, err := identity.ParseResourceURI(binding.URI)
	if err != nil || uri.Kind != kind || namespace != "" && uri.Namespace != namespace || binding.Resolver == nil || !p.catalogKinds[uri.Namespace][uri.Kind][binding.FormatVersion] {
		return identity.ErrResource
	}
	return nil
}

func (p *LocalProvider) listBindings(ctx context.Context, actor identity.VerifiedActor, kind, namespace string) (map[string]LocalResourceBinding, error) {
	if !p.catalogSupports(kind, namespace) {
		return p.bindings, nil
	}
	bindings := map[string]LocalResourceBinding{}
	for value, binding := range p.bindings {
		uri, _ := identity.ParseResourceURI(value)
		if uri.Kind == kind && (namespace == "" || uri.Namespace == namespace) {
			bindings[value] = binding
		}
	}
	span := p.timing(ctx, observe.SourceInventory, kind, namespace)
	dynamic, err := p.catalog.List(ctx, actor, kind, namespace)
	span.End(observe.OutcomeFor(err), observe.CacheBypass)
	if err != nil {
		return nil, err
	}
	for _, binding := range dynamic {
		if err := p.validateCatalogBinding(binding, kind, namespace); err != nil {
			return nil, err
		}
		if _, exists := bindings[binding.URI]; exists {
			return nil, ErrCatalogCollision
		}
		bindings[binding.URI] = binding
	}
	return bindings, nil
}

func (p *LocalProvider) lookupBinding(ctx context.Context, actor identity.VerifiedActor, uri identity.ResourceURI) (LocalResourceBinding, error) {
	static, exists := p.bindings[uri.String()]
	if p.catalogSupports(uri.Kind, uri.Namespace) {
		span := p.timing(ctx, observe.SourceLookup, uri.Kind, uri.Namespace)
		dynamic, err := p.catalog.Lookup(ctx, actor, uri)
		span.End(observe.OutcomeFor(err), observe.CacheBypass)
		if err == nil {
			if err = p.validateCatalogBinding(dynamic, uri.Kind, uri.Namespace); err != nil {
				return LocalResourceBinding{}, err
			}
			if dynamic.URI != uri.String() {
				return LocalResourceBinding{}, identity.ErrResource
			}
			if exists {
				return LocalResourceBinding{}, ErrCatalogCollision
			}
			return dynamic, nil
		}
		if err != ErrCatalogNotFound {
			return LocalResourceBinding{}, err
		}
	}
	if !exists {
		return LocalResourceBinding{}, ErrCatalogNotFound
	}
	return static, nil
}
