// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/viant/forge/backend/reporting/forgeui"
	"net/url"
	"strings"

	identity "github.com/viant/forge/backend/resource"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

func (p *PrimitiveProvider) resolver(ctx context.Context) (*identity.ResourceResolver, error) {
	if p == nil || p.ResourceResolver == nil {
		return nil, ErrProviderUnavailable
	}
	resolver, err := p.ResourceResolver(ctx)
	if err != nil || resolver == nil || resolver.Policy == nil || resolver.Source == nil {
		return nil, ErrProviderUnavailable
	}
	return resolver, nil
}
func (p *PrimitiveProvider) canonicalRef(ctx context.Context, in *windowprotocol.DefinitionInput) (identity.ResourceRef, error) {
	if in == nil || in.ContractVersion != windowprotocol.Version {
		return identity.ResourceRef{}, ErrProviderUnavailable
	}
	if in.Resource != nil {
		if _, err := identity.ParseResourceURI(in.Resource.URI); err != nil {
			return identity.ResourceRef{}, ErrProviderUnavailable
		}
		return *in.Resource, nil
	}
	if mapper, ok := p.Host.(PrimitiveResourceMapper); ok && portableKey.MatchString(in.WindowKey) {
		return mapper.ResourceRef(ctx, in.WindowKey)
	}
	return identity.ResourceRef{}, ErrProviderUnavailable
}
func (p *PrimitiveProvider) canonicalCatalog(ctx context.Context, in *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error) {
	if in == nil || in.ContractVersion != windowprotocol.Version || in.Limit < 0 || in.Limit > 100 {
		return nil, ErrProviderUnavailable
	}
	binding, err := p.admit(ctx, "resource.discover", "", "")
	if err != nil {
		return nil, err
	}
	out, err := p.Host.Catalog(ctx, in)
	if err != nil || out == nil || out.ContractVersion != windowprotocol.Version || out.CatalogRevision == "" || len(out.Windows) > 100 || len(out.Groups) > 100 {
		return nil, ErrProviderUnavailable
	}
	resolver, err := p.resolver(ctx)
	if err != nil {
		return nil, err
	}
	result := *out
	result.Windows = nil
	result.Groups = nil
	seen := map[string]bool{}
	usedGroups := map[string]bool{}
	for _, summary := range out.Windows {
		uri, err := identity.ParseResourceURI(summary.ResourceURI)
		if err != nil || summary.Title == "" || !portableKey.MatchString(summary.Key) || seen[summary.ResourceURI] || summary.Namespace != "" && summary.Namespace != uri.Namespace || summary.Name != "" && summary.Name != uri.Name {
			return nil, ErrProviderUnavailable
		}
		seen[summary.ResourceURI] = true
		pinned, err := resolver.Resolve(ctx, identity.ResourceRef{URI: summary.ResourceURI})
		if errors.Is(err, identity.ErrResourceDenied) {
			continue
		}
		if err != nil {
			return nil, ErrProviderUnavailable
		}
		// Discovery and read share policy selection and exact content checks.
		if _, _, err := resolver.ReadResolved(ctx, *pinned); err != nil {
			return nil, ErrProviderUnavailable
		}
		if err := p.finish(ctx, binding, "resource.describe", summary.ResourceURI, ""); err != nil {
			return nil, err
		}
		summary.Namespace, summary.Name = uri.Namespace, uri.Name
		result.Windows = append(result.Windows, summary)
		usedGroups[summary.GroupID] = true
	}
	for _, group := range out.Groups {
		if usedGroups[group.ID] {
			result.Groups = append(result.Groups, group)
		}
	}
	if err := p.finish(ctx, binding, "resource.discover", "", ""); err != nil {
		return nil, err
	}
	return &result, nil
}
func (p *PrimitiveProvider) canonicalDefinition(ctx context.Context, in *windowprotocol.DefinitionInput, pinned *identity.ResolvedResource) (*windowprotocol.Definition, error) {
	ref, err := p.canonicalRef(ctx, in)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	binding, err := p.admit(ctx, "resource.describe", ref.URI, "")
	if err != nil {
		return nil, err
	}
	resolver, err := p.resolver(ctx)
	if err != nil {
		return nil, err
	}
	if pinned == nil {
		pinned, err = resolver.Resolve(ctx, ref)
		if err != nil {
			return nil, ErrProviderUnavailable
		}
	}
	if pinned.URI != ref.URI || ref.Revision != "" && ref.Revision != pinned.Selector() {
		return nil, ErrProviderUnavailable
	}
	raw, fresh, err := resolver.ReadResolved(ctx, *pinned)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	host, ok := p.Host.(PrimitiveResolvedHost)
	if !ok {
		return nil, ErrProviderUnavailable
	}
	out, err := host.DefinitionResolved(ctx, *fresh, raw)
	if err != nil || out == nil || out.ContractVersion != windowprotocol.Version || out.Window == nil || out.Window.View.Content == nil {
		return nil, ErrProviderUnavailable
	}
	// Isolate caller-owned host values. Never mutate a registry's shared document.
	encoded, err := json.Marshal(out)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	var result windowprotocol.Definition
	if json.Unmarshal(encoded, &result) != nil {
		return nil, ErrProviderUnavailable
	}
	result.Resource = fresh
	result.Window.Resource = fresh
	// This field remains only a compatibility stale-content fingerprint. The
	// resolved candidate Kind/Revision is the sole execution revision identity.
	result.DefinitionRevision = fresh.ContentFingerprint
	if err := windowprotocol.ValidateResourceBindings(&result, p.HostBindings); err != nil {
		return nil, ErrProviderUnavailable
	}
	for id, source := range result.DataSources {
		if !portableKey.MatchString(id) || source.Service != nil {
			return nil, ErrProviderUnavailable
		}
		if _, duplicate := result.Window.DataSource[id]; duplicate {
			return nil, ErrProviderUnavailable
		}
	}
	for _, source := range result.Window.DataSource {
		if source.Service != nil {
			return nil, ErrProviderUnavailable
		}
	}
	if result.Report != nil {
		ids := map[string]bool{}
		for id := range result.DataSources {
			ids[id] = true
		}
		if err := forgeui.ValidateReport(result.Report, ids); err != nil {
			return nil, ErrProviderUnavailable
		}
	}
	// Host assembly may perform I/O; reauthorize the exact pin before release.
	if _, _, err := resolver.ReadResolved(ctx, *fresh); err != nil {
		return nil, ErrProviderUnavailable
	}
	if err := p.finish(ctx, binding, "resource.describe", ref.URI, ""); err != nil {
		return nil, err
	}
	return &result, nil
}
func (p *PrimitiveProvider) canonicalFetch(ctx context.Context, in *windowprotocol.FetchInput) (windowprotocol.FetchOutput, error) {
	if in == nil || in.ContractVersion != windowprotocol.Version || in.Resource == nil || !portableKey.MatchString(in.DataSourceID) {
		return nil, ErrProviderUnavailable
	}
	binding, err := p.admit(ctx, "resource.execute", in.Resource.URI, in.DataSourceID)
	if err != nil {
		return nil, err
	}
	pin := *in.Resource
	definition, err := p.canonicalDefinition(ctx, &windowprotocol.DefinitionInput{ContractVersion: windowprotocol.Version, Resource: &identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}, WindowKey: in.WindowKey}, &pin)
	if err != nil || windowprotocol.ValidateFetchResource(definition, *in) != nil {
		return nil, ErrProviderUnavailable
	}
	source := definition.DataSources[in.DataSourceID]
	if source == nil || source.Backend == nil || source.Backend.Ownership != "provider" {
		return nil, ErrProviderUnavailable
	}
	input := *in
	input.Resource = definition.Resource
	input.WindowKey = definition.Window.WindowKey
	input.DefinitionRevision = definition.Resource.ContentFingerprint
	if err := p.authorizeCanonicalFetch(ctx, binding, &input); err != nil {
		return nil, ErrProviderUnavailable
	}
	if err := p.finish(ctx, binding, "resource.execute", pin.URI, input.DataSourceID); err != nil {
		return nil, err
	}
	resolver, err := p.resolver(ctx)
	if err != nil {
		return nil, err
	}
	if _, _, err := resolver.ReadResolved(ctx, pin); err != nil {
		return nil, ErrProviderUnavailable
	}
	fetcher, ok := p.Host.(PrimitiveResolvedFetcher)
	if !ok {
		return nil, ErrProviderUnavailable
	}
	out, err := fetcher.FetchResolved(ctx, &input, source)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	var object map[string]json.RawMessage
	if json.Unmarshal(out, &object) != nil || object == nil {
		return nil, ErrProviderUnavailable
	}
	if _, _, err := resolver.ReadResolved(ctx, pin); err != nil {
		return nil, ErrProviderUnavailable
	}
	if err := p.authorizeCanonicalFetch(ctx, binding, &input); err != nil {
		return nil, ErrProviderUnavailable
	}
	if err := p.finish(ctx, binding, "resource.execute", pin.URI, input.DataSourceID); err != nil {
		return nil, err
	}
	return out, nil
}

func (p *PrimitiveProvider) authorizeCanonicalFetch(ctx context.Context, binding string, input *windowprotocol.FetchInput) error {
	// The funcs adapter's nil callback explicitly belongs only to its legacy
	// host-owned enforcement path. It cannot become a canonical implicit grant.
	switch authority := p.Authority.(type) {
	case PrimitiveAuthorityFuncs:
		if authority.AuthorizeFetchFunc == nil {
			return ErrProviderUnavailable
		}
	case *PrimitiveAuthorityFuncs:
		if authority == nil || authority.AuthorizeFetchFunc == nil {
			return ErrProviderUnavailable
		}
	}
	authority, ok := p.Authority.(PrimitiveFetchAuthority)
	if !ok || authority.AuthorizeFetch(ctx, binding, input) != nil || ctx.Err() != nil {
		return ErrProviderUnavailable
	}
	return nil
}
func (s *Service) HasCanonicalResources() bool {
	return s != nil && s.cfg != nil && s.cfg.PrimitiveProvider != nil && s.cfg.PrimitiveProvider.ResourceResolver != nil
}

// ResourceReadURI uses the standard MCP URI field for an optional revision
// selector. Namespace stays logical; arbitrary URL transport parts are rejected.
func ResourceReadURI(value string) (identity.ResourceRef, error) {
	base, query, hasQuery := strings.Cut(value, "?")
	if _, err := identity.ParseResourceURI(base); err != nil {
		return identity.ResourceRef{}, err
	}
	result := identity.ResourceRef{URI: base}
	if hasQuery {
		values, err := url.ParseQuery(query)
		if err != nil || len(values) != 1 || len(values["revision"]) != 1 || values.Get("revision") == "" {
			return identity.ResourceRef{}, identity.ErrResource
		}
		result.Revision = values.Get("revision")
	}
	return result, nil
}
