// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/viant/authz"
	"github.com/viant/authz/gating"
	"github.com/viant/forge/backend/handlers"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
)

// WindowDefinitionCatalog belongs to the embedding host, not the browser.
type WindowDefinitionCatalog interface {
	List(context.Context, *WindowDefinitionListInput) (*WindowDefinitionListOutput, error)
	Get(context.Context, *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error)
}

type WindowDefinitionSummary struct {
	ProviderIdentity string `json:"providerIdentity,omitempty" yaml:"-"`
	ResourceURI      string `json:"resourceUri,omitempty" yaml:"resourceUri,omitempty"`
	Name             string `json:"name,omitempty" yaml:"name,omitempty"`
	WindowID         string `json:"windowId" yaml:"windowId"`
	Title            string `json:"title" yaml:"title"`
	Namespace        string `json:"namespace,omitempty" yaml:"namespace,omitempty"`
}

type WindowDefinitionListInput struct {
	Query  string `json:"query,omitempty"`
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
}

type WindowDefinitionListOutput struct {
	Windows []WindowDefinitionSummary `json:"windows"`
	HasMore bool                      `json:"hasMore"`
}

type WindowDefinitionGetInput struct {
	// Routing hints select an existing catalog identity; they confer no authority.
	Namespace        string                     `json:"namespace,omitempty"`
	ProviderIdentity string                     `json:"providerIdentity,omitempty"`
	Target           *types.WindowTarget        `json:"target,omitempty"`
	Resource         *identity.ResourceRef      `json:"resource,omitempty"`
	ResolvedResource *identity.ResolvedResource `json:"resolvedResource,omitempty"`
	WindowID         string                     `json:"windowId"`
}
type WindowDefinitionGetOutput struct {
	WindowID   string        `json:"windowId"`
	Definition *types.Window `json:"definition"`
}

// SavedWindow maps a stable public ID to host-owned Forge loader arguments.
type SavedWindow struct {
	WindowDefinitionSummary `yaml:",inline"`
	Key                     string   `json:"-" yaml:"key"`
	SubKey                  string   `json:"-" yaml:"subKey,omitempty"`
	Roles                   []string `json:"-" yaml:"roles,omitempty"`
}

// WindowRoleResolver returns caller roles from trusted server-side identity.
type WindowRoleResolver func(context.Context) ([]string, error)

// WindowAuthorizer is a host-owned admission check for every catalog entry,
// including entries without legacy Roles. The callback must use verified
// request identity and current policy; an error denies access.
type WindowAuthorizer func(context.Context, string) (bool, error)
type WindowDefinitionLoader func(context.Context, string) (*types.Window, error)
type WindowResourceResolver func(context.Context, string) (*identity.ResourceResolver, identity.ResourceRef, error)
type WindowResolvedDefinitionLoader func(context.Context, string, identity.ResolvedResource, json.RawMessage) (*types.Window, error)

// WindowLegacyTargetSupport is a trusted declaration of byte-equivalent target
// support for one exact historical singleton pin. It cannot select source files.
type WindowLegacyTargetSupport func(context.Context, identity.ResolvedResource, types.WindowTarget) bool
type WindowCatalogOption func(*MetadataWindowCatalog)

func WithWindowLegacyTargetSupport(support WindowLegacyTargetSupport) WindowCatalogOption {
	return func(c *MetadataWindowCatalog) { c.legacyTargets = support }
}

// WithWindowTargetProof installs shared verification for multi-replica hosts.
// The default catalog signer is process-local: callers need the same process
// for a lease's metadata and datasource/action requests, and restart invalidates
// outstanding presentation proofs. No server-side token map is maintained.
func WithWindowTargetProof(proof types.WindowTargetProof) WindowCatalogOption {
	return func(c *MetadataWindowCatalog) { c.targetProof = proof }
}

// WithWindowMetadataScope binds direct catalog List/Get reads to an explicit
// host-owned verified metadata scope.
func WithWindowMetadataScope(scope MetadataReadScope) WindowCatalogOption {
	return func(c *MetadataWindowCatalog) { c.metadataScope = scope }
}

func WithWindowRoleResolver(resolve WindowRoleResolver) WindowCatalogOption {
	return func(c *MetadataWindowCatalog) { c.roles = resolve }
}

func WithWindowAuthorizer(authorize WindowAuthorizer) WindowCatalogOption {
	return func(c *MetadataWindowCatalog) { c.authorize = authorize }
}

// WithWindowDefinitionLoader lets a host assemble an admitted definition from
// its trusted assets. The callback receives a configured catalog ID.
func WithWindowDefinitionLoader(load WindowDefinitionLoader) WindowCatalogOption {
	return func(c *MetadataWindowCatalog) { c.loadDefinition = load }
}
func WithWindowResourceResolver(resolve WindowResourceResolver) WindowCatalogOption {
	return func(c *MetadataWindowCatalog) { c.resolveResource = resolve }
}
func WithWindowResolvedDefinitionLoader(load WindowResolvedDefinitionLoader) WindowCatalogOption {
	return func(c *MetadataWindowCatalog) { c.loadResolvedDefinition = load }
}

// MetadataWindowCatalog uses the same loader/validation as Forge's window API.
// Entries without configured roles are open. Configured roles are resolved
// through the host's trusted server-side provider before loading definitions.
type MetadataWindowCatalog struct {
	loader                 *meta.Service
	baseURL                string
	entries                []SavedWindow
	roles                  WindowRoleResolver
	authorize              WindowAuthorizer
	loadDefinition         WindowDefinitionLoader
	resolveResource        WindowResourceResolver
	loadResolvedDefinition WindowResolvedDefinitionLoader
	metadataScope          MetadataReadScope
	legacyTargets          WindowLegacyTargetSupport
	targetProof            types.WindowTargetProof
}

func NewMetadataWindowCatalog(loader *meta.Service, baseURL string, entries []SavedWindow, options ...WindowCatalogOption) (*MetadataWindowCatalog, error) {
	if loader == nil || strings.TrimSpace(baseURL) == "" {
		return nil, errors.New("window definition loader and base URL are required")
	}
	seen := map[string]bool{}
	copyEntries := append([]SavedWindow(nil), entries...)
	for i, entry := range copyEntries {
		if entry.WindowID == "" || strings.TrimSpace(entry.WindowID) != entry.WindowID || seen[entry.WindowID] {
			return nil, errors.New("window definitions require unique nonempty windowId values")
		}
		seen[entry.WindowID] = true
		if !validWindowPath(entry.Key) || (entry.SubKey != "" && !validWindowPath(entry.SubKey)) {
			return nil, fmt.Errorf("invalid loader key for window %s", entry.WindowID)
		}
		roleSet := map[string]bool{}
		copyEntries[i].Roles = append([]string(nil), entry.Roles...)
		for _, role := range entry.Roles {
			if role == "" || strings.TrimSpace(role) != role || roleSet[role] {
				return nil, fmt.Errorf("invalid roles for window %s", entry.WindowID)
			}
			roleSet[role] = true
		}
	}
	sort.Slice(copyEntries, func(i, j int) bool { return copyEntries[i].WindowID < copyEntries[j].WindowID })
	result := &MetadataWindowCatalog{loader: loader, baseURL: baseURL, entries: copyEntries}
	for _, option := range options {
		if option != nil {
			option(result)
		}
	}
	if result.targetProof == nil {
		key := make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			return nil, err
		}
		result.targetProof, _ = types.NewWindowTargetHMAC(key)
	}
	return result, nil
}

func (c *MetadataWindowCatalog) RequiresRoles() bool {
	for _, entry := range c.entries {
		if len(entry.Roles) > 0 {
			return true
		}
	}
	return false
}

// ConfiguredWindowIDs is a server-side configuration inventory for startup
// validation. It does not perform a user request or expose definitions.
func (c *MetadataWindowCatalog) ConfiguredWindowIDs() []string {
	if c == nil {
		return nil
	}
	ids := make([]string, len(c.entries))
	for i, entry := range c.entries {
		ids[i] = entry.WindowID
	}
	return ids
}

// AuthzReady reports whether a host-installed admission callback covers every
// saved window, including roleless entries.
func (c *MetadataWindowCatalog) AuthzReady() bool {
	return c != nil && (c.authorize != nil || c.resolveResource != nil)
}

// windowDefinitionFailure preserves trusted classifications while replacing
// dependency text with a fixed catalog diagnostic. Unknown errors retain their
// existing untyped, fail-closed behavior; error messages never determine status.
func windowDefinitionSentinel(err error) error {
	switch {
	case errors.Is(err, identity.ErrResourceDenied):
		return identity.ErrResourceDenied
	case errors.Is(err, identity.ErrResourceStale):
		return identity.ErrResourceStale
	case errors.Is(err, context.DeadlineExceeded):
		return context.DeadlineExceeded
	case errors.Is(err, ErrWindowSelectionUnavailable), errors.Is(err, authz.ErrUnavailable), errors.Is(err, gating.ErrUnavailable):
		return ErrWindowSelectionUnavailable
	case errors.Is(err, context.Canceled):
		return context.Canceled
	default:
		return nil
	}
}
func windowDefinitionFailure(err error, message string) error {
	if sentinel := windowDefinitionSentinel(err); sentinel != nil {
		return fmt.Errorf("%s: %w", message, sentinel)
	}
	return errors.New(message)
}

// Verification failures retain a typed denial fallback. Availability and timeout
// sentinels remain distinguishable, but an unknown verifier cannot become 500.
func windowVerificationFailure(err error, message string) error {
	if windowDefinitionSentinel(err) == nil {
		err = identity.ErrResourceDenied
	}
	return windowDefinitionFailure(err, message)
}

// Scope wrappers preserve existing catalog-owned diagnostics for unknown
// failures. Canonical dependency failures are already sanitized in getResolved.
func knownWindowDefinitionFailure(err error, message string) error {
	if windowDefinitionSentinel(err) != nil {
		return windowDefinitionFailure(err, message)
	}
	return err
}

func (c *MetadataWindowCatalog) checkEntry(ctx context.Context, entry SavedWindow) (bool, error) {
	allowed, err := c.checkEntryAccess(ctx, entry)
	if err != nil || !allowed {
		return allowed, err
	}
	if c.resolveResource == nil {
		return true, nil
	}
	resolver, ref, err := c.resolveResource(ctx, entry.WindowID)
	if err != nil || resolver == nil {
		return false, windowDefinitionFailure(err, "window resource authority unavailable")
	}
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil || uri.Kind != "window" || entry.ResourceURI != "" && entry.ResourceURI != ref.URI {
		return false, errors.New("window resource mapping is invalid")
	}
	_, err = resolver.Resolve(ctx, ref)
	if errors.Is(err, identity.ErrResourceDenied) {
		return false, nil
	}
	if err != nil {
		return false, windowDefinitionFailure(err, "window resource authority unavailable")
	}
	return true, nil
}
func (c *MetadataWindowCatalog) checkEntryAccess(ctx context.Context, entry SavedWindow) (bool, error) {
	if ctx == nil || ctx.Err() != nil {
		var contextErr error
		if ctx != nil {
			contextErr = ctx.Err()
		}
		return false, windowDefinitionFailure(contextErr, "window admission context unavailable")
	}
	if c.authorize != nil {
		allowed, err := c.authorize(ctx, entry.WindowID)
		if err != nil || ctx.Err() != nil {
			if ctx.Err() != nil {
				err = ctx.Err()
			}
			return false, windowDefinitionFailure(err, "window admission authority unavailable")
		}
		if !allowed {
			return false, nil
		}
	}
	if len(entry.Roles) > 0 {
		if c.roles == nil {
			if c.authorize == nil {
				return false, nil
			}
			return false, windowDefinitionFailure(nil, "window role authority unavailable")
		}
		actual, err := c.roles(ctx)
		if err != nil || ctx.Err() != nil {
			if c.authorize == nil {
				return false, nil
			}
			if ctx.Err() != nil {
				err = ctx.Err()
			}
			return false, windowDefinitionFailure(err, "window role authority unavailable")
		}
		matched := false
		for _, required := range entry.Roles {
			for _, role := range actual {
				if role == required {
					matched = true
					break
				}
			}
			if matched {
				break
			}
		}
		if !matched {
			return false, nil
		}
	}
	return true, nil
}

// CheckWindowAdmission is for trusted host adapters that must distinguish an
// explicit denial from an unavailable authority. Public catalog methods hide
// both states and never expose the provider's error.
func (c *MetadataWindowCatalog) CheckWindowAdmission(ctx context.Context, windowID string) (bool, error) {
	if c == nil || !c.AuthzReady() || windowID == "" || strings.TrimSpace(windowID) != windowID {
		return false, errors.New("window admission is not configured")
	}
	for _, entry := range c.entries {
		if entry.WindowID == windowID {
			return c.checkEntry(ctx, entry)
		}
	}
	return false, nil
}

// Authorize checks a direct open without loading the definition. The same
// callback and legacy role intersection used by list/get apply here.
func (c *MetadataWindowCatalog) Authorize(ctx context.Context, windowID string) error {
	for _, entry := range c.entries {
		if entry.WindowID == windowID {
			allowed, err := c.checkEntry(ctx, entry)
			if err != nil {
				return err
			}
			if allowed {
				return nil
			}
		}
	}
	return errors.New("window definition is not available")
}

func validWindowPath(value string) bool {
	return value != "" && value != "." && !strings.HasPrefix(value, "/") && path.Clean(value) == value && !strings.ContainsAny(value, "\\:\x00?#") && !strings.Contains(value, "..")
}

func (c *MetadataWindowCatalog) List(ctx context.Context, in *WindowDefinitionListInput) (*WindowDefinitionListOutput, error) {
	readCtx, finish, err := BeginMetadataReadScope(ctx, c.metadataScope)
	if err != nil {
		return nil, err
	}
	result, readErr := c.list(readCtx, in)
	if err := FinishMetadataReadScope(finish, readErr); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *MetadataWindowCatalog) list(ctx context.Context, in *WindowDefinitionListInput) (*WindowDefinitionListOutput, error) {
	if in == nil {
		in = &WindowDefinitionListInput{}
	}
	if in.Limit < 0 || in.Limit > 100 || in.Offset < 0 {
		return nil, errors.New("limit must be 0..100 and offset nonnegative")
	}
	limit := in.Limit
	if limit == 0 {
		limit = 25
	}
	query := strings.ToLower(strings.TrimSpace(in.Query))
	visible := []WindowDefinitionSummary{}
	for _, entry := range c.entries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		allowed, err := c.checkEntry(ctx, entry)
		if err != nil {
			return nil, err
		}
		if !allowed {
			continue
		}
		if query != "" && !strings.Contains(strings.ToLower(entry.WindowID+" "+entry.Title+" "+entry.Namespace), query) {
			continue
		}
		summary := entry.WindowDefinitionSummary
		if c.resolveResource != nil {
			_, ref, err := c.resolveResource(ctx, entry.WindowID)
			if err != nil {
				return nil, errors.New("window resource authority unavailable")
			}
			uri, err := identity.ParseResourceURI(ref.URI)
			if err != nil {
				return nil, err
			}
			summary.ResourceURI, summary.Namespace, summary.Name = ref.URI, uri.Namespace, uri.Name
		}
		visible = append(visible, summary)
	}
	start := min(in.Offset, len(visible))
	end := min(start+limit, len(visible))
	return &WindowDefinitionListOutput{Windows: visible[start:end], HasMore: end < len(visible)}, nil
}

func (c *MetadataWindowCatalog) Get(ctx context.Context, in *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	readCtx, finish, err := BeginMetadataReadScope(ctx, c.metadataScope)
	if err != nil {
		return nil, knownWindowDefinitionFailure(err, "window definition is not available")
	}
	result, readErr := c.get(readCtx, in)
	if err := FinishMetadataReadScope(finish, readErr); err != nil {
		return nil, knownWindowDefinitionFailure(err, "window definition is not available")
	}
	return result, nil
}

// GetForOpen is reserved for host window-open flows. Open is separately
// authorized and must not inherit metadata-list/get scope accounting.
func (c *MetadataWindowCatalog) GetForOpen(ctx context.Context, in *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	return c.get(WithoutMetadataReadScope(ctx, c.metadataScope), in)
}

func (c *MetadataWindowCatalog) get(ctx context.Context, in *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	if in == nil || strings.TrimSpace(in.WindowID) == "" || strings.TrimSpace(in.WindowID) != in.WindowID {
		return nil, errors.New("windowId is required")
	}
	key, err := c.canonicalWindowKey(ctx, in.WindowID)
	if err != nil {
		return nil, err
	}
	for _, entry := range c.entries {
		if entry.WindowID != key {
			continue
		}
		if c.resolveResource != nil {
			return c.getResolved(ctx, entry, in.Resource, in.ResolvedResource, in.Target)
		}
		allowed, err := c.checkEntry(ctx, entry)
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, errors.New("window definition is not available")
		}
		if c.loadDefinition != nil {
			definition, err := c.loadDefinition(ctx, entry.WindowID)
			if err != nil {
				return nil, fmt.Errorf("load window definition %s: %w", entry.WindowID, err)
			}
			if definition == nil {
				return nil, errors.New("window definition is not available")
			}
			return &WindowDefinitionGetOutput{WindowID: entry.WindowID, Definition: withoutWindowSelectionBinding(definition)}, nil
		}
		definition, err := handlers.LoadWindow(ctx, c.loader, c.baseURL, entry.Key, entry.SubKey, nil)
		if err != nil {
			return nil, fmt.Errorf("load window definition %s: %w", entry.WindowID, err)
		}
		return &WindowDefinitionGetOutput{WindowID: entry.WindowID, Definition: withoutWindowSelectionBinding(definition)}, nil
	}
	return nil, errors.New("window definition is not available")
}

func (s *Service) WindowDefinitionsList(ctx context.Context, in *WindowDefinitionListInput) (*WindowDefinitionListOutput, error) {
	if s.cfg.WindowDefinitions == nil {
		return nil, errors.New("saved window definition catalog is not configured")
	}
	readCtx, finish, err := BeginMetadataReadScope(ctx, s.cfg.MetadataScope)
	if err != nil {
		return nil, err
	}
	result, readErr := s.cfg.WindowDefinitions.List(readCtx, in)
	if err := FinishMetadataReadScope(finish, readErr); err != nil {
		return nil, err
	}
	return result, nil
}
func (s *Service) HasWindowDefinitions() bool { return s.cfg.WindowDefinitions != nil }

// WindowAuthorize exposes only the protected catalog's admission result to
// server-owned workspace view discovery; it never returns a definition.
func (s *Service) WindowAuthorize(ctx context.Context, windowID string) (bool, error) {
	if s == nil || s.cfg == nil || !s.AuthzReady() {
		return false, errors.New("window admission is not configured")
	}
	checker, ok := s.cfg.WindowDefinitions.(interface {
		CheckWindowAdmission(context.Context, string) (bool, error)
	})
	if !ok {
		return false, errors.New("window admission is not configured")
	}
	return checker.CheckWindowAdmission(ctx, windowID)
}

// AuthzReady reports source-owned resource resolution for selected definitions.
func (s *Service) AuthzReady() bool {
	if s == nil || s.cfg == nil || s.cfg.WindowDefinitions == nil {
		return false
	}
	ready, ok := s.cfg.WindowDefinitions.(interface{ AuthzReady() bool })
	return ok && ready.AuthzReady()
}
func (s *Service) WindowDefinitionGet(ctx context.Context, in *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	if s.cfg.WindowDefinitions == nil {
		return nil, errors.New("saved window definition catalog is not configured")
	}
	readCtx, finish, err := BeginMetadataReadScope(ctx, s.cfg.MetadataScope)
	if err != nil {
		return nil, knownWindowDefinitionFailure(err, "window definition is not available")
	}
	result, readErr := s.cfg.WindowDefinitions.Get(readCtx, in)
	if err := FinishMetadataReadScope(finish, readErr); err != nil {
		return nil, knownWindowDefinitionFailure(err, "window definition is not available")
	}
	if result != nil {
		copy := *result
		copy.Definition = withoutWindowSelectionBinding(result.Definition)
		result = &copy
	}
	return result, nil
}

func (s *Service) windowDefinitionForOpen(ctx context.Context, in *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error) {
	if s.cfg.WindowDefinitions == nil {
		return nil, errors.New("saved window definition catalog is not configured")
	}
	ctx = WithoutMetadataReadScope(ctx, s.cfg.MetadataScope)
	var result *WindowDefinitionGetOutput
	var err error
	if catalog, ok := s.cfg.WindowDefinitions.(interface {
		GetForOpen(context.Context, *WindowDefinitionGetInput) (*WindowDefinitionGetOutput, error)
	}); ok {
		result, err = catalog.GetForOpen(ctx, in)
	} else {
		result, err = s.cfg.WindowDefinitions.Get(ctx, in)
	}
	if result != nil {
		copy := *result
		copy.Definition = withoutWindowSelectionBinding(result.Definition)
		result = &copy
	}
	return result, err
}

func (c *MetadataWindowCatalog) getResolved(ctx context.Context, entry SavedWindow, requested *identity.ResourceRef, pinned *identity.ResolvedResource, target *types.WindowTarget) (*WindowDefinitionGetOutput, error) {
	resolver, ref, err := c.resolveResource(ctx, entry.WindowID)
	if err != nil || resolver == nil {
		return nil, windowDefinitionFailure(err, "window resource authority unavailable")
	}
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil || uri.Kind != "window" || entry.ResourceURI != "" && entry.ResourceURI != ref.URI {
		return nil, errors.New("window resource mapping is invalid")
	}
	if requested != nil {
		if requested.URI != ref.URI {
			return nil, errors.New("window resource mapping is invalid")
		}
		ref.Revision = requested.Revision
	}
	// Existing host roles/admission remain an intersection, not a replacement for
	// revision policy. The source is read only after explicit candidate admission.
	allowed, err := c.checkEntryAccess(ctx, entry)
	if err != nil || !allowed {
		if err == nil {
			err = identity.ErrResourceDenied
		}
		return nil, windowDefinitionFailure(err, "window definition is not available")
	}
	pin := pinned
	if pin == nil {
		pin, err = resolver.Resolve(ctx, ref)
		if err != nil {
			return nil, windowDefinitionFailure(err, "window definition is not available")
		}
	}
	if pin.URI != ref.URI || ref.Revision != "" && pin.Selector() != ref.Revision {
		return nil, windowDefinitionFailure(err, "window definition is not available")
	}
	raw, fresh, err := resolver.ReadResolved(ctx, *pin)
	if err != nil {
		return nil, windowDefinitionFailure(err, "window definition is not available")
	}
	variant, selectErr := types.SelectWindowResource(raw, target)
	if selectErr != nil && target != nil && c.legacyTargets != nil {
		var header struct {
			Format string `json:"format"`
		}
		normalized, err := target.Normalize()
		if err == nil && json.Unmarshal(raw, &header) == nil && header.Format == "" && c.legacyTargets(ctx, *fresh, normalized) {
			variant, selectErr = types.SelectWindowResource(raw, nil)
			if selectErr == nil {
				variant.Window.ResourceTarget = &normalized
			}
		}
	}
	if selectErr != nil || variant == nil {
		return nil, errors.New("window target is unavailable")
	}
	definition := variant.Window
	if c.loadResolvedDefinition != nil {
		selected, encodeErr := json.Marshal(definition)
		if encodeErr != nil {
			return nil, windowDefinitionFailure(encodeErr, "window definition is not available")
		}
		definition, err = c.loadResolvedDefinition(ctx, entry.WindowID, *fresh, selected)
	}
	if err != nil || definition == nil {
		return nil, windowDefinitionFailure(err, "window definition is not available")
	}
	// Clone host-owned values before attaching this request's authority pin.
	encoded, err := json.Marshal(definition)
	if err != nil {
		return nil, windowDefinitionFailure(err, "window definition is not available")
	}
	definition = &types.Window{}
	decoder := json.NewDecoder(bytes.NewReader(encoded))
	decoder.UseNumber()
	if err := decoder.Decode(definition); err != nil {
		return nil, windowDefinitionFailure(err, "window definition is not available")
	}
	definition.SelectionBinding = nil
	definition.Resource = fresh
	if _, _, err := resolver.ReadResolved(ctx, *fresh); err != nil {
		return nil, windowDefinitionFailure(err, "window definition is not available")
	}
	normalized := types.WindowTarget{}
	if target != nil {
		normalized = *target
	}
	normalized, err = normalized.Normalize()
	if err != nil {
		return nil, windowDefinitionFailure(err, "window definition is not available")
	}
	if normalized.SelectionToken != "" {
		if err := c.VerifyWindowTarget(ctx, *fresh, normalized, variant.Fingerprint); err != nil {
			return nil, windowDefinitionFailure(err, "window definition is not available")
		}
	} else {
		normalized.SelectionToken, err = c.targetProof.Sign(ctx, *fresh, normalized, variant.Fingerprint)
		if err != nil {
			return nil, windowDefinitionFailure(err, "window definition is not available")
		}
	}
	definition.ResourceTarget = &normalized
	return &WindowDefinitionGetOutput{WindowID: entry.WindowID, Definition: withoutWindowSelectionBinding(definition)}, nil
}

func (c *MetadataWindowCatalog) VerifyWindowTarget(ctx context.Context, pin identity.ResolvedResource, target types.WindowTarget, variant string) error {
	if c == nil || c.targetProof == nil || target.SelectionToken == "" {
		return identity.ErrResourceDenied
	}
	return c.targetProof.Verify(ctx, pin, target, variant, target.SelectionToken)
}

// UsesResourceResolution allows the bridge to require a checked definition
// instead of accepting the older authorize-only fast path on open.
func (c *MetadataWindowCatalog) UsesResourceResolution() bool {
	return c != nil && c.resolveResource != nil
}

// ResourceReference returns configured logical mapping without selecting a
// candidate. Direct explicit reads must not depend on omitted list admission.
func (c *MetadataWindowCatalog) ResourceReference(ctx context.Context, key string) (identity.ResourceRef, error) {
	if c == nil || c.resolveResource == nil {
		return identity.ResourceRef{}, identity.ErrResourceDenied
	}
	resolvedKey, err := c.canonicalWindowKey(ctx, key)
	if err != nil {
		return identity.ResourceRef{}, err
	}
	key = resolvedKey
	for _, entry := range c.entries {
		if entry.WindowID == key {
			_, ref, err := c.resolveResource(ctx, key)
			if err != nil {
				return identity.ResourceRef{}, err
			}
			uri, err := identity.ParseResourceURI(ref.URI)
			if err != nil || uri.Kind != "window" || entry.ResourceURI != "" && entry.ResourceURI != ref.URI {
				return identity.ResourceRef{}, identity.ErrResourceDenied
			}
			return identity.ResourceRef{URI: ref.URI}, nil
		}
	}
	return identity.ResourceRef{}, identity.ErrResourceDenied
}
func (s *Service) WindowResourceReference(ctx context.Context, key string) (identity.ResourceRef, error) {
	if s == nil || s.cfg == nil {
		return identity.ResourceRef{}, identity.ErrResourceDenied
	}
	mapper, ok := s.cfg.WindowDefinitions.(interface {
		ResourceReference(context.Context, string) (identity.ResourceRef, error)
	})
	if !ok {
		return identity.ResourceRef{}, identity.ErrResourceDenied
	}
	return mapper.ResourceReference(ctx, key)
}

// WindowResourceConfigured inspects trusted catalog configuration without
// selecting or authorizing a revision. A denied configured identity must not
// fall through to another resource's reusable browser key.
func (s *Service) WindowResourceConfigured(key string) bool {
	if !s.canonicalWindowCatalog() {
		return false
	}
	catalog, ok := s.cfg.WindowDefinitions.(interface{ ConfiguredWindowIDs() []string })
	if !ok {
		return false
	}
	for _, id := range catalog.ConfiguredWindowIDs() {
		if id == key {
			return true
		}
	}
	return false
}

// canonicalWindowKey resolves only the configured resource identity. Selection
// and access checks remain in getResolved; a URI is never a source-file path.
func (c *MetadataWindowCatalog) canonicalWindowKey(ctx context.Context, key string) (string, error) {
	if !strings.Contains(key, "://") {
		return key, nil
	}
	uri, err := identity.ParseResourceURI(key)
	if err != nil || uri.Kind != "window" || c.resolveResource == nil {
		return "", identity.ErrResourceDenied
	}
	matched := ""
	for _, entry := range c.entries {
		configured := entry.ResourceURI
		if configured == "" {
			_, ref, err := c.resolveResource(ctx, entry.WindowID)
			if err != nil {
				return "", identity.ErrResourceDenied
			}
			configured = ref.URI
		}
		if configured != key {
			continue
		}
		if matched != "" {
			return "", identity.ErrResourceDenied
		}
		matched = entry.WindowID
	}
	if matched == "" {
		return "", identity.ErrResourceDenied
	}
	return matched, nil
}
