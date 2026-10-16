// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
	"github.com/viant/jsonrpc/transport"
	"github.com/viant/mcp-protocol/client"
	skillformat "github.com/viant/mcp-protocol/extension/skills"
	"github.com/viant/mcp-protocol/logger"
	"github.com/viant/mcp-protocol/schema"
	protocol "github.com/viant/mcp-protocol/server"
	mcp "github.com/viant/mcp/server"
)

// LocalResourceBinding gives a trusted host an explicit logical identity and
// source. The loader must read the configured local YAML/JSON asset, never a
// path or URI selected by a tool caller.
type ActorResolver func(context.Context) (identity.VerifiedActor, error)
type ActorVerifier func(context.Context, identity.VerifiedActor) error

var ErrUnavailable = errors.New("primitive producer unavailable")

type LocalResourceBinding struct {
	Changes       ResourceChangeSource
	OwnerID       string
	URI           string
	Title         string
	Description   string
	FormatVersion int64
	Resolver      func(context.Context, identity.VerifiedActor, string) (*identity.ResourceResolver, error)
}

type LocalResourceValidator func(int64, json.RawMessage) error
type LocalResourceAuthorizer func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error
type LocalRevisionPolicyFactory func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) (identity.ResourceRevisionPolicy, error)
type LocalWindowListVisibility func(context.Context, identity.VerifiedActor, LocalResourceBinding) (bool, error)
type LocalWindowIndex func(context.Context) ([]primitive.ResourceState, error)

// DefinitionValidationCache is an optional trusted optimization. Exact source
// hashing and current-candidate checks still run before and after validation.
type DefinitionValidationCache func(identity.ResourceSource, string, int64, string, LocalResourceValidator) bool

// LocalConfig installs one authoritative owning catalog. Lifecycle operations
// require an explicit Authoring backend and namespace operation declarations.
type LocalConfig struct {
	Catalog                   LocalCatalog
	Authoring                 primitive.ResourceAuthoring
	NativeSkills              []*skillformat.Static
	NativeResources           []NativeResource
	NamespaceMetadata         map[string]primitive.NamespaceMetadata
	ProviderIdentity          string
	Actor                     ActorResolver
	Verify                    ActorVerifier
	Authorize                 LocalResourceAuthorizer
	Bindings                  []LocalResourceBinding
	Validators                map[string]LocalResourceValidator
	DefinitionValidationCache DefinitionValidationCache
	WindowListVisibility      LocalWindowListVisibility
	MenuActionVisibility      MenuActionVisibility
	MenuVisibilityProjection  MenuVisibilityProjection
	WindowIndex               LocalWindowIndex
	Now                       func() time.Time
}

type LocalProvider struct {
	catalog                   LocalCatalog
	observedNamespaces        map[string]bool
	authoring                 primitive.ResourceAuthoring
	catalogOperations         map[string]map[string]map[string]bool
	catalogKinds              map[string]map[string]map[int64]bool
	nativeSkills              []*skillformat.Static
	nativeResources           []NativeResource
	namespaceMetadata         map[string]primitive.NamespaceMetadata
	identity                  string
	actor                     ActorResolver
	verify                    ActorVerifier
	authorizer                LocalResourceAuthorizer
	bindings                  map[string]LocalResourceBinding
	validators                map[string]LocalResourceValidator
	definitionValidationCache DefinitionValidationCache
	windowListVisibility      LocalWindowListVisibility
	menuActionVisibility      MenuActionVisibility
	menuVisibilityProjection  MenuVisibilityProjection
	windowIndex               LocalWindowIndex
	now                       func() time.Time
}

// ProviderIdentity is immutable provenance configured by the trusted host.
func (p *LocalProvider) ProviderIdentity() string {
	if p == nil {
		return ""
	}
	return p.identity
}

func NewLocalProvider(config LocalConfig) (*LocalProvider, error) {
	if strings.TrimSpace(config.ProviderIdentity) == "" || strings.TrimSpace(config.ProviderIdentity) != config.ProviderIdentity || config.Actor == nil || config.Verify == nil || config.Authorize == nil || len(config.Bindings) == 0 && len(config.NativeResources) == 0 && config.Catalog == nil && config.NativeSkills == nil {
		return nil, fmt.Errorf("local resource provider requires identity, verified actor, namespace authorizer, and bindings")
	}
	if config.WindowListVisibility != nil && config.WindowIndex == nil {
		return nil, fmt.Errorf("window list visibility requires a trusted static window index")
	}
	if err := checkNativeSkills(config.NativeSkills); err != nil {
		return nil, err
	}
	if err := checkNativeResources(config.NativeResources); err != nil {
		return nil, err
	}
	p := &LocalProvider{observedNamespaces: map[string]bool{}, authoring: config.Authoring, nativeSkills: cloneNativeSkills(config.NativeSkills), nativeResources: append([]NativeResource(nil), config.NativeResources...), namespaceMetadata: cloneNamespaceMetadata(config.NamespaceMetadata), identity: config.ProviderIdentity, actor: config.Actor, verify: config.Verify, authorizer: config.Authorize, bindings: map[string]LocalResourceBinding{}, validators: map[string]LocalResourceValidator{}, definitionValidationCache: config.DefinitionValidationCache, windowListVisibility: config.WindowListVisibility, windowIndex: config.WindowIndex, menuActionVisibility: config.MenuActionVisibility, menuVisibilityProjection: config.MenuVisibilityProjection, now: config.Now}
	if p.now == nil {
		p.now = time.Now
	}
	for kind, validator := range config.Validators {
		if !identity.ValidResourceKind(kind) || validator == nil {
			return nil, fmt.Errorf("invalid local resource validator")
		}
		p.validators[kind] = validator
	}
	if err := p.configureCatalog(config.Catalog); err != nil {
		return nil, err
	}
	for _, binding := range config.Bindings {
		uri, err := identity.ParseResourceURI(binding.URI)
		if err != nil || primitive.Plural(uri.Kind) == "" || binding.Resolver == nil || binding.FormatVersion < 1 || p.validators[uri.Kind] == nil {
			return nil, fmt.Errorf("local resource binding requires an explicit resolver, format version, and kind validator")
		}
		if uri.Kind == "navigation" && config.MenuActionVisibility == nil && config.MenuVisibilityProjection == nil {
			return nil, fmt.Errorf("menu binding requires action visibility")
		}
		if _, exists := p.bindings[binding.URI]; exists {
			return nil, fmt.Errorf("duplicate local resource binding")
		}
		p.bindings[binding.URI] = binding
		p.observedNamespaces[uri.Namespace] = true
	}
	return p, nil
}

// ConfigurationSnapshot returns owned catalog containers for trusted host
// recomposition. It captures configuration only, never request actors, grants,
// resolved resources or source bytes. Existing handlers retain their generation.
func (p *LocalProvider) ConfigurationSnapshot() LocalConfig {
	if p == nil {
		return LocalConfig{}
	}
	config := LocalConfig{
		Catalog:           p.catalog,
		Authoring:         p.authoring,
		NativeSkills:      cloneNativeSkills(p.nativeSkills),
		NativeResources:   append([]NativeResource(nil), p.nativeResources...),
		NamespaceMetadata: cloneNamespaceMetadata(p.namespaceMetadata),
		ProviderIdentity:  p.identity, Actor: p.actor, Verify: p.verify,
		Authorize: p.authorizer, Validators: make(map[string]LocalResourceValidator, len(p.validators)),
		DefinitionValidationCache: p.definitionValidationCache,
		WindowListVisibility:      p.windowListVisibility, WindowIndex: p.windowIndex,
		MenuActionVisibility: p.menuActionVisibility, MenuVisibilityProjection: p.menuVisibilityProjection,
		Now: p.now,
	}
	for _, binding := range p.bindings {
		config.Bindings = append(config.Bindings, binding)
	}
	sort.Slice(config.Bindings, func(i, j int) bool { return config.Bindings[i].URI < config.Bindings[j].URI })
	for kind, validator := range p.validators {
		config.Validators[kind] = validator
	}
	return config
}

func cloneNamespaceMetadata(metadata map[string]primitive.NamespaceMetadata) map[string]primitive.NamespaceMetadata {
	out := make(map[string]primitive.NamespaceMetadata, len(metadata))
	for namespace, value := range metadata {
		value.UseCases = append([]string(nil), value.UseCases...)
		out[namespace] = value
	}
	return out
}

func (p *LocalProvider) nowTime() time.Time {
	if p != nil && p.now != nil {
		return p.now()
	}
	return time.Now()
}

func (p *LocalProvider) currentActor(ctx context.Context) (timingActor identity.VerifiedActor, timingErr error) {
	if p != nil && observe.Enabled(ctx) {
		span := p.timing(ctx, observe.Identity, "resource", "")
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheBypass) }()
	}
	if p == nil || p.actor == nil || p.verify == nil || ctx == nil || ctx.Err() != nil {
		return identity.VerifiedActor{}, identity.ErrResourceDenied
	}
	actor, err := p.actor(ctx)
	if err != nil {
		return identity.VerifiedActor{}, err
	}
	if !actor.ReadValid(p.nowTime()) || ctx.Err() != nil {
		return identity.VerifiedActor{}, identity.ErrResourceDenied
	}
	if err := p.verify(ctx, actor); err != nil {
		return identity.VerifiedActor{}, err
	}
	return actor, nil
}

func (p *LocalProvider) finishActor(ctx context.Context, actor identity.VerifiedActor) (timingErr error) {
	if p != nil && observe.Enabled(ctx) {
		span := p.timing(ctx, observe.Identity, "resource", "")
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheBypass) }()
	}
	if p == nil || p.actor == nil || p.verify == nil || ctx == nil || ctx.Err() != nil || !actor.ReadValid(p.nowTime()) {
		return identity.ErrResourceDenied
	}
	fresh, err := p.actor(ctx)
	if err != nil {
		return err
	}
	if !fresh.ReadValid(p.nowTime()) || !sameLocalActor(actor, fresh) {
		return identity.ErrResourceDenied
	}
	return p.verify(ctx, fresh)
}

func sameLocalActor(left, right identity.VerifiedActor) bool {
	return left.PublicRead == right.PublicRead && left.Subject == right.Subject && left.Issuer == right.Issuer && left.TenantID == right.TenantID && left.AccountID == right.AccountID && left.IdentityRevision == right.IdentityRevision
}

func (p *LocalProvider) authorize(ctx context.Context, actor identity.VerifiedActor, uri identity.ResourceURI, action string) (timingErr error) {
	if p != nil && observe.Enabled(ctx) {
		span := p.timing(ctx, observe.Authorization, uri.Kind, uri.Namespace)
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheBypass) }()
	}
	if p == nil || p.authorizer == nil || !uri.Valid() {
		return identity.ErrResourceDenied
	}
	if err := p.authorizer(ctx, actor, uri, action); err != nil {
		return err
	}
	return nil
}

func (p *LocalProvider) checkedRead(ctx context.Context, actor identity.VerifiedActor, binding LocalResourceBinding, uri identity.ResourceURI, action string, requested string) (json.RawMessage, *identity.ResolvedResource, error) {
	if err := p.authorize(ctx, actor, uri, action); err != nil {
		return nil, nil, err
	}
	resolverSpan := p.timing(ctx, observe.BindingResolver, uri.Kind, uri.Namespace)
	resolver, err := binding.Resolver(ctx, actor, action)
	resolverSpan.End(observe.OutcomeFor(err), observe.CacheBypass)
	if err != nil {
		return nil, nil, err
	}
	if resolver == nil || resolver.ProviderIdentity != p.identity {
		return nil, nil, identity.ErrResourceDenied
	}
	if uri.Kind != "navigation" && requested != "" && requested != identity.WorkingCandidate {
		return nil, nil, identity.ErrResourceDenied
	}
	// Preserve omission so host policy can honor an authorized main/exposure
	// selection. Explicit working is supported; stamped selectors are not.
	resolveSpan := p.timing(ctx, observe.RevisionResolve, uri.Kind, uri.Namespace)
	pin, err := resolver.Resolve(ctx, identity.ResourceRef{URI: uri.String(), Revision: requested})
	resolveSpan.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, nil, err
	}
	if pin == nil || pin.ProviderIdentity != p.identity || pin.URI != uri.String() || !pin.ResourceCandidate.Valid() || (uri.Kind != "navigation" && (pin.Kind != identity.WorkingCandidate || pin.Revision != "")) || !identity.MetadataExpiryValid(pin.ValidUntil, p.nowTime()) {
		return nil, nil, identity.ErrResourceDenied
	}
	readSpan := p.timing(ctx, observe.RevisionRead, uri.Kind, uri.Namespace)
	raw, fresh, err := resolver.ReadResolved(ctx, *pin)
	readSpan.End(observe.OutcomeFor(err), observe.CacheUnknown)
	if err != nil {
		return nil, nil, err
	}
	if fresh == nil || fresh.ProviderIdentity != p.identity || fresh.URI != pin.URI || fresh.ResourceCandidate != pin.ResourceCandidate || fresh.AuthorityBinding != pin.AuthorityBinding {
		return nil, nil, identity.ErrResourceDenied
	}
	validationSpan := p.timing(ctx, observe.Validation, uri.Kind, uri.Namespace)
	validator := p.validators[uri.Kind]
	validated := p.definitionValidationCache != nil && p.definitionValidationCache(resolver.Source, uri.Kind, binding.FormatVersion, fresh.ContentFingerprint, validator)
	cache := observe.CacheBypass
	if p.definitionValidationCache != nil {
		cache = observe.CacheMiss
	}
	if validated {
		cache = observe.CacheHit
	}
	if validator == nil || !validated && validator(binding.FormatVersion, raw) != nil {
		validationSpan.End(observe.Error, cache)
		return nil, nil, fmt.Errorf("invalid local %s definition", uri.Kind)
	}
	validationSpan.End(observe.OK, cache)
	if err := p.authorize(ctx, actor, uri, action); err != nil {
		return nil, nil, err
	}
	if err := p.finishActor(ctx, actor); err != nil {
		return nil, nil, err
	}
	if cached, ok := resolver.Source.(interface {
		CheckCandidate(context.Context, identity.ResourceURI, identity.ResourceCandidate) error
	}); ok {
		if err := cached.CheckCandidate(ctx, uri, fresh.ResourceCandidate); err != nil {
			return nil, nil, err
		}
	}
	if ctx.Err() != nil || !identity.MetadataExpiryValid(fresh.ValidUntil, p.nowTime()) {
		return nil, nil, identity.ErrResourceDenied
	}
	return append(json.RawMessage(nil), raw...), fresh, nil
}

func (p *LocalProvider) NamespaceList(ctx context.Context, input primitive.NamespaceListRequest) (timingResult *primitive.NamespaceListResult, timingErr error) {
	if observe.Enabled(ctx) {
		span := p.timing(ctx, observe.ProviderNamespaceList, "resource", "")
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheUnknown) }()
	}
	offset, limit, err := pageRequest(input.Cursor, input.Limit)
	if err != nil {
		return nil, err
	}
	actor, err := p.currentActor(ctx)
	if err != nil {
		return nil, err
	}
	names := map[string]map[string]bool{}
	for _, binding := range p.bindings {
		u, _ := identity.ParseResourceURI(binding.URI)
		if names[u.Namespace] == nil {
			names[u.Namespace] = map[string]bool{}
		}
		names[u.Namespace][u.Kind] = true
	}
	for namespace, kinds := range p.catalogKinds {
		if names[namespace] == nil {
			names[namespace] = map[string]bool{}
		}
		for kind := range kinds {
			names[namespace][kind] = true
		}
	}
	ordered := make([]string, 0, len(names))
	for n := range names {
		ordered = append(ordered, n)
	}
	sort.Strings(ordered)
	visible := make([]primitive.Namespace, 0, len(ordered))
	for _, name := range ordered {
		probe := identity.ResourceURI{Kind: "resource", Namespace: name, Name: "catalog"}
		if err := p.authorize(ctx, actor, probe, "namespace.list"); err != nil {
			if errors.Is(err, identity.ErrResourceDenied) {
				continue
			}
			return nil, err
		}
		kinds := make([]string, 0, len(names[name]))
		for kind := range names[name] {
			kinds = append(kinds, kind)
		}
		sort.Strings(kinds)
		summary := primitive.Namespace{NamespaceMetadata: p.namespaceMetadata[name], Name: name, Kinds: kinds}
		if _, published := p.namespaceMetadata[name]; published {
			summary.SupportedKinds = p.namespaceKinds(name)
		}
		visible = append(visible, summary)
	}
	if err := p.finishActor(ctx, actor); err != nil {
		return nil, err
	}
	start, end, next, complete, err := pageBounds(offset, limit, len(visible))
	if err != nil {
		return nil, err
	}
	out := &primitive.NamespaceListResult{ProviderIdentity: p.identity, Namespaces: visible[start:end], NextCursor: next, Complete: complete}
	return out, nil
}

func (p *LocalProvider) NamespaceGet(ctx context.Context, input primitive.NamespaceGetRequest) (timingResult *primitive.NamespaceCapabilities, timingErr error) {
	if observe.Enabled(ctx) {
		span := p.timing(ctx, observe.ProviderNamespaceGet, "resource", input.Namespace)
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheUnknown) }()
	}
	if strings.TrimSpace(input.Namespace) == "" || strings.TrimSpace(input.Namespace) != input.Namespace {
		return nil, identity.ErrResource
	}
	actor, err := p.currentActor(ctx)
	if err != nil {
		return nil, err
	}
	probe := identity.ResourceURI{Kind: "resource", Namespace: input.Namespace, Name: "catalog"}
	if err := p.authorize(ctx, actor, probe, "namespace.get"); err != nil {
		return nil, err
	}
	kinds := p.namespaceKinds(input.Namespace)
	if len(kinds) == 0 {
		return nil, identity.ErrResourceDenied
	}
	out := &primitive.NamespaceCapabilities{NamespaceMetadata: p.namespaceMetadata[input.Namespace], ProviderIdentity: p.identity, Namespace: input.Namespace, Kinds: kinds}
	if err := p.authorize(ctx, actor, probe, "namespace.get"); err != nil {
		return nil, err
	}
	if err := p.finishActor(ctx, actor); err != nil {
		return nil, err
	}
	return out, nil
}

func (p *LocalProvider) List(ctx context.Context, kind string, input primitive.ListRequest) (timingResult *primitive.ListResult, timingErr error) {
	if observe.Enabled(ctx) {
		span := p.timing(ctx, observe.ProviderList, kind, input.Namespace)
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheUnknown) }()
	}
	plural := primitive.Plural(kind)
	offset, limit, pageErr := pageRequest(input.Cursor, input.Limit)
	if plural == "" || pageErr != nil {
		return nil, identity.ErrResource
	}
	if kind == "window" && p.windowIndex != nil && !p.catalogSupports(kind, input.Namespace) {
		return p.listIndexedWindows(ctx, input, offset, limit)
	}
	actor, err := p.currentActor(ctx)
	if err != nil {
		return nil, err
	}
	bindings, err := p.listBindings(ctx, actor, kind, input.Namespace)
	if err != nil {
		return nil, err
	}
	uris := make([]string, 0, len(bindings))
	for value := range bindings {
		uri, _ := identity.ParseResourceURI(value)
		if uri.Kind == kind && (input.Namespace == "" || uri.Namespace == input.Namespace) {
			uris = append(uris, value)
		}
	}
	sort.Strings(uris)
	out := &primitive.ListResult{Resources: []*primitive.ResourceState{}, Complete: true}
	for _, value := range uris {
		binding := bindings[value]
		uri, _ := identity.ParseResourceURI(value)
		selector := identity.WorkingCandidate
		if kind == "navigation" {
			selector = ""
		}
		raw, pin, e := p.checkedRead(ctx, actor, binding, uri, "resource.list", selector)
		if e != nil {
			if errors.Is(e, identity.ErrResourceDenied) {
				continue
			}
			return nil, e
		}
		if kind == "navigation" {
			projection, err := p.getMenuProjection(ctx, actor, binding, uri, raw, pin)
			if err != nil {
				if errors.Is(err, identity.ErrResourceDenied) {
					continue
				}
				return nil, err
			}
			var envelope struct {
				Applications []json.RawMessage `json:"applications"`
			}
			if json.Unmarshal(projection.MenuProjection.DefinitionBytes, &envelope) != nil {
				return nil, identity.ErrResource
			}
			if len(envelope.Applications) == 0 {
				continue
			}
		}
		out.Resources = append(out.Resources, &primitive.ResourceState{OwnerID: binding.OwnerID, Description: binding.Description, Kind: kind, Namespace: uri.Namespace, Name: uri.Name, URI: value, Title: binding.Title, Lifecycle: pin.Kind, Revision: pin.Selector(), FormatVersion: binding.FormatVersion, ContentFingerprint: pin.ContentFingerprint})
	}
	if err := p.finishActor(ctx, actor); err != nil {
		return nil, err
	}
	start, end, next, complete, err := pageBounds(offset, limit, len(out.Resources))
	if err != nil {
		return nil, err
	}
	out.Resources, out.NextCursor, out.Complete = out.Resources[start:end], next, complete
	return out, nil
}

// listIndexedWindows exposes only static snapshot metadata. It deliberately
// avoids resolver selection and definition reads; Get remains the authorized
// exact-pin path for full definitions.
func (p *LocalProvider) listIndexedWindows(ctx context.Context, input primitive.ListRequest, offset, limit int) (*primitive.ListResult, error) {
	actor, err := p.currentActor(ctx)
	if err != nil {
		return nil, err
	}
	configuredNamespaces := map[string]bool{}
	for value := range p.bindings {
		uri, parseErr := identity.ParseResourceURI(value)
		if parseErr == nil && uri.Kind == "window" {
			configuredNamespaces[uri.Namespace] = true
		}
	}
	if input.Namespace != "" && !configuredNamespaces[input.Namespace] {
		return nil, identity.ErrResourceDenied
	}
	before, err := p.windowIndex(ctx)
	if err != nil {
		return nil, err
	}
	beforeByURI, err := localWindowIndexMap(before)
	if err != nil {
		return nil, err
	}
	uris := make([]string, 0, len(beforeByURI))
	for uri := range beforeByURI {
		uris = append(uris, uri)
	}
	sort.Strings(uris)
	visible := make([]*primitive.ResourceState, 0, len(uris))
	for _, value := range uris {
		state := beforeByURI[value]
		uri, _ := identity.ParseResourceURI(value)
		binding, configured := p.bindings[value]
		if !configured || input.Namespace != "" && uri.Namespace != input.Namespace {
			continue
		}
		if state.FormatVersion != binding.FormatVersion || binding.Title != "" && state.Title != binding.Title {
			return nil, identity.ErrResourceStale
		}
		if err := p.authorize(ctx, actor, uri, "resource.list"); err != nil {
			if errors.Is(err, identity.ErrResourceDenied) {
				continue
			}
			return nil, err
		}
		if p.windowListVisibility != nil {
			allowed, err := p.windowListVisibility(ctx, actor, binding)
			if err != nil {
				if errors.Is(err, identity.ErrResourceDenied) {
					continue
				}
				return nil, err
			}
			if !allowed {
				continue
			}
		}
		copy := state
		visible = append(visible, &copy)
	}
	filtered := make([]*primitive.ResourceState, 0, len(visible))
	for _, state := range visible {
		uri, _ := identity.ParseResourceURI(state.URI)
		if err := p.authorize(ctx, actor, uri, "resource.list"); err != nil {
			if errors.Is(err, identity.ErrResourceDenied) {
				continue
			}
			return nil, err
		}
		if p.windowListVisibility != nil {
			binding, ok := p.bindings[state.URI]
			if !ok {
				return nil, identity.ErrResourceStale
			}
			allowed, err := p.windowListVisibility(ctx, actor, binding)
			if err != nil {
				if errors.Is(err, identity.ErrResourceDenied) {
					continue
				}
				return nil, err
			}
			if !allowed {
				continue
			}
		}
		filtered = append(filtered, state)
	}
	after, err := p.windowIndex(ctx)
	if err != nil {
		return nil, err
	}
	afterByURI, err := localWindowIndexMap(after)
	if err != nil {
		return nil, err
	}
	if !reflect.DeepEqual(beforeByURI, afterByURI) {
		return nil, identity.ErrResourceStale
	}
	if err := p.finishActor(ctx, actor); err != nil {
		return nil, err
	}
	start, end, next, complete, err := pageBounds(offset, limit, len(filtered))
	if err != nil {
		return nil, err
	}
	return &primitive.ListResult{Resources: filtered[start:end], NextCursor: next, Complete: complete}, nil
}

func localWindowIndexMap(values []primitive.ResourceState) (map[string]primitive.ResourceState, error) {
	if len(values) > 10000 {
		return nil, identity.ErrResourceDenied
	}
	result := make(map[string]primitive.ResourceState, len(values))
	for _, value := range values {
		uri, err := identity.ParseResourceURI(value.URI)
		candidate := identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: value.ContentFingerprint}
		if err != nil || uri.Kind != "window" || value.Kind != "window" || value.Namespace != uri.Namespace || value.Name != uri.Name || value.Lifecycle != identity.WorkingCandidate || value.Revision != identity.WorkingCandidate || value.Stamp != 0 || value.DraftRevision != 0 || value.LatestStamp != 0 || value.FormatVersion < 1 || !candidate.Valid() || len(value.Definition) != 0 || len(value.DefinitionBytes) != 0 || len(value.Dependencies) != 0 || value.Replay {
			return nil, identity.ErrResource
		}
		if _, duplicate := result[value.URI]; duplicate {
			return nil, identity.ErrResource
		}
		result[value.URI] = value
	}
	return result, nil
}

func pageRequest(cursor string, limit int) (int, int, error) {
	if limit < 0 || limit > 100 {
		return 0, 0, identity.ErrResource
	}
	offset := 0
	if cursor != "" {
		value, err := strconv.Atoi(cursor)
		if err != nil || value < 0 || strconv.Itoa(value) != cursor {
			return 0, 0, identity.ErrResource
		}
		offset = value
	}
	if limit == 0 {
		limit = 100
	}
	return offset, limit, nil
}
func pageBounds(offset, limit, total int) (int, int, string, bool, error) {
	if offset > total {
		return 0, 0, "", false, identity.ErrResource
	}
	end := offset + limit
	if end > total {
		end = total
	}
	complete := end == total
	next := ""
	if !complete {
		next = strconv.Itoa(end)
	}
	return offset, end, next, complete, nil
}

func (p *LocalProvider) Get(ctx context.Context, kind string, input primitive.GetRequest) (timingResult *primitive.GetResult, timingErr error) {
	if observe.Enabled(ctx) {
		span := p.timing(ctx, observe.ProviderGet, kind, "")
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheUnknown) }()
	}
	uri, err := identity.ParseResourceURI(input.URI)
	if err != nil || uri.Kind != kind || input.WorkspaceID != "" {
		return nil, identity.ErrResource
	}
	actor, err := p.currentActor(ctx)
	if err != nil {
		return nil, err
	}
	binding, err := p.lookupBinding(ctx, actor, uri)
	if err == ErrCatalogNotFound {
		return nil, identity.ErrResourceDenied
	}
	if err != nil {
		return nil, err
	}
	raw, pin, err := p.checkedRead(ctx, actor, binding, uri, "resource.get", input.Revision)
	if err != nil {
		return nil, err
	}
	if kind == "navigation" {
		return p.getMenuProjection(ctx, actor, binding, uri, raw, pin)
	}
	result := &primitive.GetResult{Resource: &primitive.ResourceState{OwnerID: binding.OwnerID, Description: binding.Description, Kind: kind, Namespace: uri.Namespace, Name: uri.Name, URI: input.URI, Title: binding.Title, Lifecycle: "working", Revision: identity.WorkingCandidate, FormatVersion: binding.FormatVersion, ContentFingerprint: pin.ContentFingerprint, Definition: raw, DefinitionBytes: append([]byte(nil), raw...)}, ResolvedResource: pin}
	if err := p.mergeAuthoringMetadata(ctx, actor, result); err != nil {
		return nil, err
	}
	return result, nil
}

func (p *LocalProvider) InstalledTools() []string {
	if p.nativeSkillIndex() {
		return []string{"namespaces/list", "namespaces/get", "resource/get"}
	}
	tools := []string{"namespaces/list", "namespaces/get"}
	kinds := map[string]bool{}
	for _, b := range p.bindings {
		u, _ := identity.ParseResourceURI(b.URI)
		kinds[u.Kind] = true
	}
	for _, declared := range p.catalogKinds {
		for kind := range declared {
			kinds[kind] = true
		}
	}
	ordered := make([]string, 0, len(kinds))
	for k := range kinds {
		ordered = append(ordered, k)
	}
	sort.Strings(ordered)
	for _, kind := range ordered {
		plural := primitive.Plural(kind)
		tools = append(tools, plural+"/list", plural+"/get")
		operations := map[string]bool{}
		for namespace := range p.catalogOperations {
			for operation := range p.catalogOperations[namespace][kind] {
				if p.canAuthor(kind, namespace, operation) {
					operations[operation] = true
				}
			}
		}
		orderedOps := make([]string, 0, len(operations))
		for operation := range operations {
			orderedOps = append(orderedOps, operation)
		}
		sort.Strings(orderedOps)
		for _, operation := range orderedOps {
			tools = append(tools, plural+"/"+operation)
		}
	}
	return tools
}

func (p *LocalProvider) Call(ctx context.Context, method string, raw json.RawMessage) (timingValue any, timingErr error) {
	if observe.Enabled(ctx) {
		prefix, _, _ := strings.Cut(method, "/")
		span := p.timing(ctx, observe.MCPDispatch, primitive.Kind(prefix), "")
		defer func() { span.End(observe.OutcomeFor(timingErr), observe.CacheUnknown) }()
	}
	switch method {
	case "namespaces/list":
		var in primitive.NamespaceListRequest
		if err := strictDecode(raw, &in); err != nil {
			return nil, err
		}
		return p.NamespaceList(ctx, in)
	case "namespaces/get":
		var in primitive.NamespaceGetRequest
		if err := strictDecode(raw, &in); err != nil {
			return nil, err
		}
		return p.NamespaceGet(ctx, in)
	}
	parts := strings.Split(method, "/")
	if len(parts) != 2 {
		return nil, identity.ErrResource
	}
	kind := primitive.Kind(parts[0])
	if kind == "" {
		return nil, identity.ErrResource
	}
	if authoringOperation(parts[1]) {
		return p.callAuthoring(ctx, kind, parts[1], raw)
	}
	if parts[1] != "list" && parts[1] != "get" {
		return nil, identity.ErrResource
	}
	if parts[1] == "list" {
		var in primitive.ListRequest
		if err := strictDecode(raw, &in); err != nil {
			return nil, err
		}
		listed, err := p.List(ctx, kind, in)
		if err != nil {
			return nil, err
		}
		out := map[string]any{parts[0]: listed.Resources, "complete": listed.Complete}
		if listed.NextCursor != "" {
			out["nextCursor"] = listed.NextCursor
		}
		return out, nil
	}
	var in primitive.GetRequest
	if err := strictDecode(raw, &in); err != nil {
		return nil, err
	}
	return p.Get(ctx, kind, in)
}

func strictDecode(raw json.RawMessage, value any) error {
	if len(raw) == 0 {
		raw = json.RawMessage(`{}`)
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(value); err != nil {
		return identity.ErrResource
	}
	if d.Decode(new(any)) != io.EOF {
		return identity.ErrResource
	}
	return nil
}

func inputSchema(v any) (schema.ToolInputSchema, error) {
	var result schema.ToolInputSchema
	err := result.Load(v)
	return result, err
}

type localMCPHandler struct {
	*protocol.DefaultHandler
	provider *LocalProvider
}

func (h *localMCPHandler) Implements(method string) bool {
	if h.provider.nativeSkills != nil && (method == schema.MethodSkillsList || method == schema.MethodSkillsGet || method == schema.MethodResourcesList || method == schema.MethodResourcesRead) {
		return true
	}
	for _, name := range h.provider.InstalledTools() {
		if name == method {
			return true
		}
	}
	return h.DefaultHandler.Implements(method)
}
func (h *localMCPHandler) Initialize(ctx context.Context, request *schema.InitializeRequestParams, result *schema.InitializeResult) {
	h.DefaultHandler.Initialize(ctx, request, result)
	h.addMetadata(&result.Capabilities)
}
func (h *localMCPHandler) Discover(ctx context.Context, result *schema.DiscoverResult) {
	h.DefaultHandler.Discover(ctx, result)
	h.addMetadata(&result.Capabilities)
}
func (h *localMCPHandler) addMetadata(c *schema.ServerCapabilities) {
	if h.provider.nativeSkills != nil {
		if c.Extensions == nil {
			c.Extensions = map[string]map[string]interface{}{}
		}
		c.Extensions[schema.SkillsExtension] = map[string]interface{}{}
		if c.Resources == nil {
			c.Resources = &schema.ServerCapabilitiesResources{}
		}
	}
	if h.provider.hasResourceChanges() && len(h.provider.nativeResources) > 0 {
		if c.Resources == nil {
			c.Resources = &schema.ServerCapabilitiesResources{}
		}
		enabled := true
		c.Resources.ListChanged = &enabled
	}
	if c.Extensions == nil {
		c.Extensions = map[string]map[string]interface{}{}
	}
	c.Extensions[primitive.AuthoringExtension] = map[string]interface{}{"version": 1, "providerIdentity": h.provider.identity, "transport": "tools/call"}
}

// FilterSubscriptions accepts only change notifications this owning source emits.
func (h *localMCPHandler) FilterSubscriptions(_ context.Context, requested schema.SubscriptionFilter) schema.SubscriptionFilter {
	var accepted schema.SubscriptionFilter
	if requested.ResourcesListChanged != nil && *requested.ResourcesListChanged && h.provider.hasResourceChanges() && len(h.provider.nativeResources) > 0 {
		yes := true
		accepted.ResourcesListChanged = &yes
	}
	return accepted
}

// NewLocalMCPHandler builds the standard MCP tools/list and tools/call path.
// The protection wrapper must derive the actor from authenticated transport
// state and is mandatory; request bodies never supply identity.
func NewLocalMCPHandler(provider *LocalProvider, protect func(http.Handler) http.Handler) (http.Handler, error) {
	if provider == nil || protect == nil {
		return nil, ErrUnavailable
	}
	protocolServer, err := NewMCPServer(provider)
	if err != nil {
		return nil, err
	}
	protocolServer.UseStreamableHTTP(true)
	var handler http.Handler = protocolServer.HTTP(context.Background(), "").Handler
	handler = protect(handler)
	if handler == nil {
		return nil, ErrUnavailable
	}
	return handler, nil
}

func NewMCPServer(provider *LocalProvider, compact ...bool) (*mcp.Server, error) {
	compactNative := len(compact) > 0 && compact[0]
	var sessions sync.Map
	return mcp.New(mcp.WithImplementation(schema.Implementation{Name: "agently-local-resources", Version: "1"}), mcp.WithStreamableURI("/mcp"), mcp.WithRootRedirect(false), mcp.WithOnSessionClose(func(n transport.Notifier) {
		if stop, ok := sessions.LoadAndDelete(n); ok {
			stop.(func())()
		}
	}), mcp.WithNewHandler(func(_ context.Context, n transport.Notifier, l logger.Logger, c client.Operations) (protocol.Handler, error) {
		h := &localMCPHandler{DefaultHandler: protocol.NewDefaultHandler(n, l, c), provider: provider}
		h.ServerCapabilities = &schema.ServerCapabilities{Resources: &schema.ServerCapabilitiesResources{}}
		h.Registry.Methods.Put(schema.MethodResourcesList, true)
		h.Registry.Methods.Put(schema.MethodResourcesRead, true)
		if err := h.registerNativeSkills(); err != nil {
			return nil, err
		}
		if err := h.registerNativeResources(); err != nil {
			return nil, err
		}
		for _, method := range provider.InstalledTools() {
			if provider.nativeSkills != nil && (method == schema.MethodSkillsList || method == schema.MethodSkillsGet) {
				continue
			}
			name := method
			description := "List authorized local resource definitions"
			var sample any = primitive.ListRequest{}
			if strings.HasPrefix(name, "namespaces/") {
				description = "Read local resource namespace capabilities"
				sample = primitive.NamespaceGetRequest{}
				if name == "namespaces/list" {
					sample = primitive.NamespaceListRequest{}
				}
			} else if strings.HasSuffix(name, "/get") {
				description = "Read an authorized local resource definition"
				sample = primitive.GetRequest{}
			}
			if provider.nativeSkillIndex() {
				sample = struct {
					URI    string  `json:"uri,omitempty"`
					Cursor *string `json:"cursor,omitempty"`
				}{}
			}
			if writeSample := authoringSample(name); writeSample != nil {
				sample = writeSample
				description = "Write a resource through its owning provider"
			}
			input, schemaErr := inputSchema(sample)
			if schemaErr != nil {
				return nil, schemaErr
			}
			h.Registry.RegisterToolWithSchema(name, description, input, nil, func(ctx context.Context, r *schema.CallToolRequest) (*schema.CallToolResult, *jsonrpc.Error) {
				serializeSpan := provider.timing(ctx, observe.Serialization, "", "")
				raw, e := json.Marshal(r.Params.Arguments)
				serializeSpan.End(observe.OutcomeFor(e), observe.CacheBypass)
				if e != nil {
					return nil, jsonrpc.NewInvalidParamsError("invalid resource request", nil)
				}
				value, handled, e := h.nativeSkillIndexCall(ctx, name, r.Params.Arguments)
				if !handled {
					value, e = provider.Call(ctx, name, raw)
				}
				failed := e != nil
				if e != nil {
					value = map[string]string{"code": "resource_unavailable", "message": "local resource operation denied or unavailable"}
				}
				compactGet := false
				if compactNative && !failed {
					if get, ok := value.(*primitive.GetResult); ok && get.Resource != nil && len(get.Resource.DefinitionBytes) > 0 {
						resource := *get.Resource
						resource.Definition = nil
						projected := *get
						projected.Resource = &resource
						value = &projected
						compactGet = true
					}
				}
				encoded := []byte("Resource definition returned in structuredContent.")
				var marshalErr error
				if !compactGet {
					responseSpan := provider.timing(ctx, observe.Serialization, "", "")
					encoded, marshalErr = json.Marshal(value)
					responseSpan.End(observe.OutcomeFor(marshalErr), observe.CacheBypass)
				}
				if marshalErr != nil {
					return nil, jsonrpc.NewInternalError("resource response unavailable", nil)
				}
				return &schema.CallToolResult{IsError: &failed, StructuredContent: value, Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: string(encoded)}}}, nil
			})
			entry, _ := h.ToolRegistry.Get(name)
			entry.Metadata.Meta = map[string]interface{}{primitive.AuthoringExtension: map[string]interface{}{"version": 1, "providerIdentity": provider.identity, "transport": "tools/call"}}
		}
		if n != nil {
			sessions.Store(n, provider.subscribeResourceChanges(n))
		}
		return h, nil
	}))
}

// NewMCPHandler is the conventional constructor for a protected local resource
// endpoint. The protection middleware is required and must install identity
// through request context before tool dispatch.
func NewMCPHandler(provider *LocalProvider, protect func(http.Handler) http.Handler) (http.Handler, error) {
	return NewLocalMCPHandler(provider, protect)
}

var _ interface{ Implements(string) bool } = (*localMCPHandler)(nil)

func (p *LocalProvider) namespaceKinds(namespace string) []primitive.KindSupport {
	typesByKind := map[string]map[int64]bool{}
	for _, binding := range p.bindings {
		u, _ := identity.ParseResourceURI(binding.URI)
		if u.Namespace == namespace {
			if typesByKind[u.Kind] == nil {
				typesByKind[u.Kind] = map[int64]bool{}
			}
			typesByKind[u.Kind][binding.FormatVersion] = true
		}
	}
	for kind, versions := range p.catalogKinds[namespace] {
		if typesByKind[kind] == nil {
			typesByKind[kind] = map[int64]bool{}
		}
		for version := range versions {
			typesByKind[kind][version] = true
		}
	}
	kinds := make([]string, 0, len(typesByKind))
	for k := range typesByKind {
		kinds = append(kinds, k)
	}
	sort.Strings(kinds)
	out := []primitive.KindSupport{}
	for _, kind := range kinds {
		versions := make([]int64, 0, len(typesByKind[kind]))
		for v := range typesByKind[kind] {
			versions = append(versions, v)
		}
		sort.Slice(versions, func(i, j int) bool { return versions[i] < versions[j] })
		ops := []string{"list", "get"}
		writes := []string{}
		for operation := range p.catalogOperations[namespace][kind] {
			if p.canAuthor(kind, namespace, operation) {
				writes = append(writes, operation)
			}
		}
		sort.Strings(writes)
		ops = append(ops, writes...)
		support := primitive.KindSupport{Kind: kind, FormatVersions: versions, Operations: ops, TestSupported: false, Methods: primitive.Methods(kind, ops)}
		if kind == primitive.ToolfeedKind {
			support.SchemaURI = primitive.ToolfeedSchemaURI
		}
		out = append(out, support)
	}
	return out
}
