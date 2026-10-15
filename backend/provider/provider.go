// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/viant/forge/backend/reporting/forgeui"
	"regexp"

	identity "github.com/viant/forge/backend/resource"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

var portableKey = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)
var ErrProviderUnavailable = errors.New("portable Forge resource is unavailable")

// PrimitiveHost resolves published content through the host's existing report
// registry/publication services. Fetch executes only server-owned datasource
// mappings, including dynamic MCP tools and linked-in providers.
// Fetch must resolve and enforce DefinitionRevision atomically with its
// server-owned dispatch mapping. The provider also checks revision after the
// operation, but that cannot undo side effects of an incorrectly mapped tool.
type PrimitiveHost interface {
	Catalog(context.Context, *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error)
	Definition(context.Context, *windowprotocol.DefinitionInput) (*windowprotocol.Definition, error)
	Fetch(context.Context, *windowprotocol.FetchInput) (windowprotocol.FetchOutput, error)
}

// PrimitiveHostFuncs binds an embedding host without introducing a parallel
// report registry, schema, publication or connection store.
type PrimitiveHostFuncs struct {
	CatalogFunc            func(context.Context, *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error)
	DefinitionFunc         func(context.Context, *windowprotocol.DefinitionInput) (*windowprotocol.Definition, error)
	FetchFunc              func(context.Context, *windowprotocol.FetchInput) (windowprotocol.FetchOutput, error)
	DefinitionResolvedFunc func(context.Context, identity.ResolvedResource, json.RawMessage) (*windowprotocol.Definition, error)
	FetchResolvedFunc      func(context.Context, *windowprotocol.FetchInput, *windowprotocol.DataSource) (windowprotocol.FetchOutput, error)
	ResourceRefFunc        func(context.Context, string) (identity.ResourceRef, error)
}

// PrimitiveResolvedHost assembles only the exact approved bytes. Its datasource
// dispatch must use the same resolved resource and explicit component pins.
type PrimitiveResolvedHost interface {
	DefinitionResolved(context.Context, identity.ResolvedResource, json.RawMessage) (*windowprotocol.Definition, error)
}
type PrimitiveResolvedFetcher interface {
	// The descriptor comes from the approved document, never request inputs.
	FetchResolved(context.Context, *windowprotocol.FetchInput, *windowprotocol.DataSource) (windowprotocol.FetchOutput, error)
}

func (h PrimitiveHostFuncs) FetchResolved(ctx context.Context, input *windowprotocol.FetchInput, source *windowprotocol.DataSource) (windowprotocol.FetchOutput, error) {
	if h.FetchResolvedFunc == nil {
		return nil, ErrProviderUnavailable
	}
	return h.FetchResolvedFunc(ctx, input, source)
}

type PrimitiveResourceMapper interface {
	ResourceRef(context.Context, string) (identity.ResourceRef, error)
}

func (h PrimitiveHostFuncs) DefinitionResolved(ctx context.Context, pin identity.ResolvedResource, raw json.RawMessage) (*windowprotocol.Definition, error) {
	if h.DefinitionResolvedFunc == nil {
		return nil, ErrProviderUnavailable
	}
	return h.DefinitionResolvedFunc(ctx, pin, raw)
}
func (h PrimitiveHostFuncs) ResourceRef(ctx context.Context, key string) (identity.ResourceRef, error) {
	if h.ResourceRefFunc == nil {
		return identity.ResourceRef{}, ErrProviderUnavailable
	}
	return h.ResourceRefFunc(ctx, key)
}

func (h PrimitiveHostFuncs) Catalog(ctx context.Context, in *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error) {
	if h.CatalogFunc == nil {
		return nil, ErrProviderUnavailable
	}
	return h.CatalogFunc(ctx, in)
}
func (h PrimitiveHostFuncs) Definition(ctx context.Context, in *windowprotocol.DefinitionInput) (*windowprotocol.Definition, error) {
	if h.DefinitionFunc == nil {
		return nil, ErrProviderUnavailable
	}
	return h.DefinitionFunc(ctx, in)
}
func (h PrimitiveHostFuncs) Fetch(ctx context.Context, in *windowprotocol.FetchInput) (windowprotocol.FetchOutput, error) {
	if h.FetchFunc == nil {
		return nil, ErrProviderUnavailable
	}
	return h.FetchFunc(ctx, in)
}

type PrimitiveAuthorityFuncs struct {
	AuthenticateFunc func(context.Context) (string, error)
	AuthorizeFunc    func(context.Context, string, string, string, string) error
	// AuthorizeFetchFunc performs selected-input admission. A nil callback is
	// explicitly legacy host-owned enforcement; it is never an implicit grant
	// from the caller's inputs. Shared authz hosts must configure this callback.
	AuthorizeFetchFunc func(context.Context, string, *windowprotocol.FetchInput) error
}

// PrimitiveFetchAuthority admits the actual datasource inputs using verified
// identity bound by Authenticate. It must resolve selected IDs against trusted
// authority; no identity/facts claims inside Inputs are authoritative.
type PrimitiveFetchAuthority interface {
	AuthorizeFetch(context.Context, string, *windowprotocol.FetchInput) error
}

func (a PrimitiveAuthorityFuncs) AuthorizeFetch(ctx context.Context, binding string, input *windowprotocol.FetchInput) error {
	if a.AuthorizeFetchFunc == nil {
		return nil
	} // explicit legacy Host.Fetch enforcement
	return a.AuthorizeFetchFunc(ctx, binding, input)
}

func (a PrimitiveAuthorityFuncs) Authenticate(ctx context.Context) (string, error) {
	if a.AuthenticateFunc == nil {
		return "", ErrProviderUnavailable
	}
	return a.AuthenticateFunc(ctx)
}
func (a PrimitiveAuthorityFuncs) Authorize(ctx context.Context, binding, action, key, source string) error {
	if a.AuthorizeFunc == nil {
		return ErrProviderUnavailable
	}
	return a.AuthorizeFunc(ctx, binding, action, key, source)
}

// PrimitiveAuthority must validate credentials on each invocation. Binding is an
// opaque identity/account/policy lease binding; it must change on expiry,
// account switch or policy revision. Request applicationId is never identity.
type PrimitiveAuthority interface {
	Authenticate(context.Context) (binding string, err error)
	Authorize(context.Context, string, string, string, string) error
}

type PrimitiveProvider struct {
	Host      PrimitiveHost
	Authority PrimitiveAuthority
	// ResourceResolver is configured by the trusted host for the current
	// verified request partition/action. Enabling it makes all existing tools
	// use canonical resolution; legacy fingerprints cannot bypass it.
	ResourceResolver func(context.Context) (*identity.ResourceResolver, error)
	HostBindings     map[string]string
}

func (p *PrimitiveProvider) admitFetch(ctx context.Context, binding string, input *windowprotocol.FetchInput) error {
	if authority, ok := p.Authority.(PrimitiveFetchAuthority); ok {
		if err := authority.AuthorizeFetch(ctx, binding, input); err != nil || ctx.Err() != nil {
			return ErrProviderUnavailable
		}
	}
	return p.finish(ctx, binding, "resource.execute", input.WindowKey, input.DataSourceID)
}

func (p *PrimitiveProvider) admit(ctx context.Context, action, key, source string) (string, error) {
	if p == nil || p.Host == nil || p.Authority == nil || ctx == nil || ctx.Err() != nil {
		return "", ErrProviderUnavailable
	}
	binding, err := p.Authority.Authenticate(ctx)
	if err != nil || binding == "" {
		return "", ErrProviderUnavailable
	}
	if err = p.Authority.Authorize(ctx, binding, action, key, source); err != nil || ctx.Err() != nil {
		return "", ErrProviderUnavailable
	}
	return binding, nil
}
func (p *PrimitiveProvider) finish(ctx context.Context, binding, action, key, source string) error {
	current, err := p.admit(ctx, action, key, source)
	if err != nil || binding != current {
		return ErrProviderUnavailable
	}
	return nil
}
func (p *PrimitiveProvider) Catalog(ctx context.Context, in *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error) {
	if p != nil && p.ResourceResolver != nil {
		return p.canonicalCatalog(ctx, in)
	}
	if in == nil || in.ContractVersion != windowprotocol.Version || in.Limit < 0 || in.Limit > 100 {
		return nil, ErrProviderUnavailable
	}
	binding, err := p.admit(ctx, "resource.discover", "", "")
	if err != nil {
		return nil, err
	}
	out, err := p.Host.Catalog(ctx, in)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	if out == nil || out.ContractVersion != windowprotocol.Version || out.CatalogRevision == "" || len(out.Windows) > 100 || len(out.Groups) > 100 {
		return nil, ErrProviderUnavailable
	}
	seen := map[string]bool{}
	for _, win := range out.Windows {
		if !portableKey.MatchString(win.Key) || win.Title == "" || seen[win.Key] {
			return nil, ErrProviderUnavailable
		}
		seen[win.Key] = true
		// Host filters before paging; this final check prevents an adapter from
		// accidentally publishing entries it did not admit.
		if current, err := p.admit(ctx, "resource.describe", win.Key, ""); err != nil || current != binding {
			return nil, ErrProviderUnavailable
		}
	}
	groups := map[string]bool{}
	for _, group := range out.Groups {
		if !portableKey.MatchString(group.ID) || group.Title == "" || groups[group.ID] {
			return nil, ErrProviderUnavailable
		}
		groups[group.ID] = true
	}
	for _, win := range out.Windows {
		if win.GroupID != "" && !groups[win.GroupID] {
			return nil, ErrProviderUnavailable
		}
		if err := p.finish(ctx, binding, "resource.describe", win.Key, ""); err != nil {
			return nil, err
		}
	}
	if err = p.finish(ctx, binding, "resource.discover", "", ""); err != nil {
		return nil, err
	}
	return out, nil
}
func (p *PrimitiveProvider) Definition(ctx context.Context, in *windowprotocol.DefinitionInput) (*windowprotocol.Definition, error) {
	if p != nil && p.ResourceResolver != nil {
		return p.canonicalDefinition(ctx, in, nil)
	}
	if in == nil || in.ContractVersion != windowprotocol.Version || !portableKey.MatchString(in.WindowKey) {
		return nil, ErrProviderUnavailable
	}
	binding, err := p.admit(ctx, "resource.describe", in.WindowKey, "")
	if err != nil {
		return nil, err
	}
	out, err := p.Host.Definition(ctx, in)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	if out == nil || out.ContractVersion != windowprotocol.Version || out.DefinitionRevision == "" || out.Window == nil || out.Window.View.Content == nil {
		return nil, ErrProviderUnavailable
	}
	for id, source := range out.DataSources {
		if _, duplicate := out.Window.DataSource[id]; duplicate {
			return nil, ErrProviderUnavailable
		}
		if !portableKey.MatchString(id) || source == nil || source.ID != id || source.Service != nil || source.Backend == nil {
			return nil, ErrProviderUnavailable
		}
		switch source.Backend.Kind {
		case "provider":
			if source.Backend.Service != "" || source.Backend.Method != windowprotocol.FetchTool || source.Backend.Pinned["windowKey"] != in.WindowKey || source.Backend.Pinned["dataSourceId"] != id || source.Backend.Pinned["definitionRevision"] != out.DefinitionRevision {
				return nil, ErrProviderUnavailable
			}
		case "mcp_tool":
			if !portableKey.MatchString(source.Backend.Service) || !portableKey.MatchString(source.Backend.Method) {
				return nil, ErrProviderUnavailable
			}
		default:
			return nil, ErrProviderUnavailable
		}
	}
	// Service endpoints must be expressed by the portable datasource contract.
	for _, source := range out.Window.DataSource {
		if source.Service != nil {
			return nil, ErrProviderUnavailable
		}
	}
	if out.Report != nil {
		ids := map[string]bool{}
		for id := range out.DataSources {
			ids[id] = true
		}
		if err := forgeui.ValidateReport(out.Report, ids); err != nil {
			return nil, ErrProviderUnavailable
		}
	}
	if err = p.finish(ctx, binding, "resource.describe", in.WindowKey, ""); err != nil {
		return nil, err
	}
	return out, nil
}
func (p *PrimitiveProvider) Fetch(ctx context.Context, in *windowprotocol.FetchInput) (windowprotocol.FetchOutput, error) {
	if p != nil && p.ResourceResolver != nil {
		return p.canonicalFetch(ctx, in)
	}
	if in == nil || in.ContractVersion != windowprotocol.Version || !portableKey.MatchString(in.WindowKey) || !portableKey.MatchString(in.DataSourceID) || in.DefinitionRevision == "" {
		return nil, ErrProviderUnavailable
	}
	binding, err := p.admit(ctx, "resource.execute", in.WindowKey, in.DataSourceID)
	if err != nil {
		return nil, err
	}
	definition, err := p.Definition(ctx, &windowprotocol.DefinitionInput{ContractVersion: windowprotocol.Version, WindowKey: in.WindowKey})
	if err != nil || definition.DefinitionRevision != in.DefinitionRevision || definition.DataSources[in.DataSourceID] == nil || definition.DataSources[in.DataSourceID].Backend.Kind != "provider" {
		return nil, ErrProviderUnavailable
	}
	if err = p.finish(ctx, binding, "resource.execute", in.WindowKey, in.DataSourceID); err != nil {
		return nil, err
	}
	if err = p.admitFetch(ctx, binding, in); err != nil {
		return nil, err
	}
	out, err := p.Host.Fetch(ctx, in)
	if err != nil {
		return nil, ErrProviderUnavailable
	}
	var object map[string]json.RawMessage
	if !json.Valid(out) || json.Unmarshal(out, &object) != nil || object == nil {
		return nil, ErrProviderUnavailable
	}
	if err = p.finish(ctx, binding, "resource.execute", in.WindowKey, in.DataSourceID); err != nil {
		return nil, err
	}
	if err = p.admitFetch(ctx, binding, in); err != nil {
		return nil, err
	}
	current, err := p.Definition(ctx, &windowprotocol.DefinitionInput{ContractVersion: windowprotocol.Version, WindowKey: in.WindowKey})
	if err != nil || current.DefinitionRevision != in.DefinitionRevision {
		return nil, ErrProviderUnavailable
	}
	if err = p.finish(ctx, binding, "resource.execute", in.WindowKey, in.DataSourceID); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Service) HasPrimitiveProvider() bool {
	return s != nil && s.cfg != nil && s.cfg.PrimitiveProvider != nil
}
func (s *Service) PrimitiveCatalog(ctx context.Context, in *windowprotocol.CatalogInput) (*windowprotocol.Catalog, error) {
	return s.cfg.PrimitiveProvider.Catalog(ctx, in)
}
func (s *Service) PrimitiveDefinition(ctx context.Context, in *windowprotocol.DefinitionInput) (*windowprotocol.Definition, error) {
	return s.cfg.PrimitiveProvider.Definition(ctx, in)
}
func (s *Service) PrimitiveFetch(ctx context.Context, in *windowprotocol.FetchInput) (*windowprotocol.FetchOutput, error) {
	out, err := s.cfg.PrimitiveProvider.Fetch(ctx, in)
	return &out, err
}
