// SPDX-License-Identifier: Apache-2.0
// Shared primitive delivery; kept aligned with the Core compatibility boundary.
package resource

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	service "github.com/viant/forge/backend/provider"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"strings"
	"time"
)

type WindowContentCheck func(context.Context, identity.ResolvedResource) error

type WindowCatalog struct {
	nativeHTTPWindows map[Connection]map[string]bool
	// DefaultNamespace is trusted host routing for original unqualified keys.
	DefaultNamespace string
	// DefaultProviderIdentity and Aliases are startup-owned routing for local
	// unqualified window keys. They avoid discovery of unrelated MCPs.
	DefaultProviderIdentity string
	Aliases                 map[string]string
	// ContentCurrent is supplied only by the authoritative host for each owner.
	// Unregistered providers retain an exact, authorized Get as the final check.
	ContentCurrent map[string]WindowContentCheck
	Gateway        *Gateway
	TargetProof    types.WindowTargetProof
}
type windowLocator struct {
	Connection Connection `json:"connection"`
	URI        string     `json:"uri"`
}

const locatorPrefix = "primitive:"

func encodeWindowLocator(connection Connection, uri string) string {
	raw, _ := json.Marshal(windowLocator{connection, uri})
	return locatorPrefix + base64.RawURLEncoding.EncodeToString(raw)
}
func decodeWindowLocator(value string) (windowLocator, error) {
	var out windowLocator
	if !strings.HasPrefix(value, locatorPrefix) || len(value) > 4096 {
		return out, identity.ErrResource
	}
	raw, e := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(value, locatorPrefix))
	if e != nil || json.Unmarshal(raw, &out) != nil {
		return out, identity.ErrResource
	}
	uri, e := identity.ParseResourceURI(out.URI)
	if e != nil || uri.Kind != "window" || out.Connection.Name == "" || out.Connection.ProviderIdentity == "" {
		return out, identity.ErrResource
	}
	return out, nil
}
func (c *WindowCatalog) AuthzReady() bool {
	return c != nil && c.Gateway != nil && c.TargetProof != nil
}
func (c *WindowCatalog) UsesResourceResolution() bool { return true }
func (c *WindowCatalog) List(ctx context.Context, input *service.WindowDefinitionListInput) (*service.WindowDefinitionListOutput, error) {
	return c.listExcludingLocalProvider(ctx, input, "")
}

// ListFrom limits delegated inventory to host-selected roots while retaining
// the ordinary list conversion, query, pagination and provider admission.
func (c *WindowCatalog) ListFrom(ctx context.Context, roots []Connection, input *service.WindowDefinitionListInput) (*service.WindowDefinitionListOutput, error) {
	if len(roots) == 0 {
		return nil, identity.ErrResource
	}
	return c.listWindows(ctx, input, "", roots)
}
func (c *WindowCatalog) listExcludingLocalProvider(ctx context.Context, input *service.WindowDefinitionListInput, owner string) (*service.WindowDefinitionListOutput, error) {
	return c.listWindows(ctx, input, owner, nil)
}
func (c *WindowCatalog) listWindows(ctx context.Context, input *service.WindowDefinitionListInput, owner string, roots []Connection) (*service.WindowDefinitionListOutput, error) {
	if !c.AuthzReady() {
		return nil, identity.ErrResourceDenied
	}
	if input == nil {
		input = &service.WindowDefinitionListInput{}
	}
	if input.Offset < 0 || input.Limit < 0 || input.Limit > 100 {
		return nil, identity.ErrResource
	}
	var rows []LocatedResource
	var e error
	if roots == nil {
		rows, e = c.Gateway.listExcludingLocalProvider(ctx, "window", "", owner)
	} else {
		rows, e = c.scopedWindowRows(ctx, roots, owner)
	}
	if e != nil {
		return nil, e
	}
	summaries := []service.WindowDefinitionSummary{}
	for _, row := range rows {
		if input.Query != "" && !strings.Contains(strings.ToLower(row.Resource.Title+" "+row.Resource.Name+" "+row.Resource.URI), strings.ToLower(input.Query)) {
			continue
		}
		// List is metadata only. Provider list admission decides visibility; opening
		// validates the exact selected definition through its owning provider.
		summaries = append(summaries, service.WindowDefinitionSummary{ProviderIdentity: row.Connection.ProviderIdentity, ResourceURI: row.Resource.URI, Name: row.Resource.Name, WindowID: encodeWindowLocator(row.Connection, row.Resource.URI), Title: row.Resource.Title, Namespace: row.Resource.Namespace})
	}
	offset := input.Offset
	if offset > len(summaries) {
		offset = len(summaries)
	}
	limit := input.Limit
	if limit == 0 {
		limit = 100
	}
	end := offset + limit
	if end > len(summaries) {
		end = len(summaries)
	}
	return &service.WindowDefinitionListOutput{Windows: summaries[offset:end], HasMore: end < len(summaries)}, nil
}
func (c *WindowCatalog) scopedWindowRows(ctx context.Context, roots []Connection, excludedOwner string) ([]LocatedResource, error) {
	excluded := ""
	if excludedOwner != "" {
		// Validate every declared root even if its local owner is excluded.
		scoped := context.WithValue(ctx, catalogRootsKey{}, roots)
		if _, err := c.Gateway.catalogConnectionNames(scoped); err != nil {
			return nil, err
		}
		names, err := c.Gateway.Manager.LocalProviderNames(ctx, excludedOwner)
		if err != nil {
			return nil, err
		}
		if len(names) > 1 {
			return nil, ErrCollision
		}
		if len(names) == 1 {
			excluded = names[0]
		}
	}
	selected := make([]Connection, 0, len(roots))
	for _, root := range roots {
		if excluded == "" || root.Name != excluded {
			selected = append(selected, root)
		}
	}
	if len(selected) == 0 {
		return nil, nil
	}
	var rows []LocatedResource
	query := CatalogQuery{Limit: primitive.MaxCatalogPageSize}
	for {
		page, err := ListPageFrom[json.RawMessage](ctx, c.Gateway, selected, "window", query, false)
		if err != nil {
			return nil, err
		}
		rows = append(rows, untypedLocations(page.Items)...)
		if page.Complete {
			return rows, nil
		}
		if page.NextCursor == "" || page.NextCursor == query.Cursor {
			return nil, primitive.ErrCatalogCursor
		}
		query.Cursor = page.NextCursor
	}
}

func (c *WindowCatalog) locate(ctx context.Context, key, owner string) (windowLocator, error) {
	if strings.HasPrefix(key, locatorPrefix) {
		return decodeWindowLocator(key)
	}
	if !strings.Contains(key, "://") && c.DefaultNamespace != "" {
		if uri := c.Aliases[key]; uri != "" {
			key = uri
		} else {
			key = "window://" + c.DefaultNamespace + "/" + key
		}
		if owner == "" {
			owner = c.DefaultProviderIdentity
		}
	}
	uri, e := identity.ParseResourceURI(key)
	if e != nil || uri.Kind != "window" {
		return windowLocator{}, identity.ErrResource
	}
	connection, e := c.Gateway.ConnectionForResource(ctx, uri, owner)
	if e != nil {
		return windowLocator{}, e
	}
	return windowLocator{connection, key}, nil
}
func (c *WindowCatalog) ResourceReference(ctx context.Context, key string) (identity.ResourceRef, error) {
	loc, e := c.locate(ctx, key, "")
	if e != nil {
		return identity.ResourceRef{}, e
	}
	return identity.ResourceRef{URI: loc.URI}, nil
}
func (c *WindowCatalog) Get(ctx context.Context, input *service.WindowDefinitionGetInput) (*service.WindowDefinitionGetOutput, error) {
	return c.getForProvider(ctx, "", input)
}

// GetForProvider is a trusted host entry point for an already configured owner.
// It adds no client wire field and does not fabricate a resource revision pin.
func (c *WindowCatalog) GetForProvider(ctx context.Context, owner string, input *service.WindowDefinitionGetInput) (*service.WindowDefinitionGetOutput, error) {
	if strings.TrimSpace(owner) == "" {
		return nil, identity.ErrResourceDenied
	}
	return c.getForProvider(ctx, owner, input)
}

func (c *WindowCatalog) getForProvider(ctx context.Context, explicitOwner string, input *service.WindowDefinitionGetInput) (out *service.WindowDefinitionGetOutput, resultErr error) {
	span := observe.Start(ctx, "window.open", observe.Labels{Kind: "window"})
	defer func() { span.End(observe.OutcomeFor(resultErr), observe.CacheUnknown) }()
	if !c.AuthzReady() || input == nil {
		return nil, identity.ErrResourceDenied
	}
	owner := explicitOwner
	if input.ResolvedResource != nil {
		if explicitOwner != "" && input.ResolvedResource.ProviderIdentity != explicitOwner {
			return nil, identity.ErrResourceDenied
		}
		owner = input.ResolvedResource.ProviderIdentity
	}
	loc, e := c.locate(ctx, input.WindowID, owner)
	if e != nil {
		return nil, fmt.Errorf("window locate: %w", e)
	}
	if explicitOwner != "" && loc.Connection.ProviderIdentity != explicitOwner {
		return nil, identity.ErrResourceDenied
	}
	ref := identity.ResourceRef{URI: loc.URI}
	if input.Resource != nil {
		if input.Resource.URI != loc.URI {
			return nil, identity.ErrResourceDenied
		}
		ref = *input.Resource
	}
	ctx = requestctx.WithWindowTarget(ctx, input.Target)
	result, e := GetWithCodec[*types.CompiledWindowResource](ctx, c.Gateway, loc.Connection, ref, input.ResolvedResource, DefinitionCodec[*types.CompiledWindowResource]{ID: "forge.window.resource.v1", Parse: types.CompileWindowResource})
	if e != nil {
		return nil, fmt.Errorf("window read/select: %w", e)
	}
	selectionTiming := observe.Start(ctx, "window.target.select", observe.Labels{})
	selected, e := result.Definition.Select(input.Target)
	selectionTiming.End(observe.OutcomeFor(e), observe.CacheUnknown)
	if e != nil {
		return nil, e
	}
	if selected == nil {
		return nil, identity.ErrResourceDenied
	}
	pin := *result.ResolvedResource
	definition := selected.Window
	providerOwned := false
	for _, raw := range selected.DataSources {
		var source struct {
			Backend struct{ Kind, Ownership string }
		}
		if json.Unmarshal(raw, &source) != nil {
			return nil, identity.ErrResourceDenied
		}
		if source.Backend.Ownership == "provider" && source.Backend.Kind == "datly" {
			providerOwned = true
		}
	}
	var executionProof *primitive.ExecutionProof
	if input.Target != nil && input.Target.SelectionToken != "" {
		if input.ResolvedResource == nil || c.TargetProof.Verify(ctx, *input.ResolvedResource, *input.Target, selected.Fingerprint, input.Target.SelectionToken) != nil {
			return nil, identity.ErrResourceDenied
		}
		executionProof = input.Target.ExecutionProof
	} else if input.Target != nil && input.Target.ExecutionProof != nil {
		return nil, identity.ErrResourceDenied
	}
	if providerOwned {
		if input.ResolvedResource != nil && executionProof == nil {
			return nil, identity.ErrResourceDenied
		}
		if executionProof == nil {
			executionProof = result.ExecutionProof
		}
		if err := matchProviderProof(pin, executionProof); err != nil {
			return nil, err
		}
	} else if executionProof != nil {
		return nil, identity.ErrResourceDenied
	}
	var dependencyPins map[string]identity.ResolvedResource
	if len(selected.DataSourceResources) > 0 {
		var existing map[string]identity.ResolvedResource
		if input.Target != nil && input.Target.SelectionToken != "" {
			if e = c.TargetProof.Verify(ctx, pin, *input.Target, selected.Fingerprint, input.Target.SelectionToken); e != nil {
				return nil, e
			}
			existing = input.Target.DependencyPins
			if existing == nil {
				return nil, identity.ErrResourceDenied
			}
		} else if input.Target != nil && len(input.Target.DependencyPins) > 0 {
			return nil, identity.ErrResourceDenied
		}
		dependencyTiming := observe.Start(ctx, "window.dependencies", observe.Labels{})
		dependencyPins, e = c.Gateway.ResolveDependencyPins(ctx, loc.Connection, pin, selected.DataSourceResources, selected.DataSources, existing)
		dependencyTiming.End(observe.OutcomeFor(e), observe.CacheUnknown)
		if e != nil {
			return nil, e
		}
		for _, child := range dependencyPins {
			pin.ValidUntil = identity.MinimumMetadataExpiry(pin.ValidUntil, child.ValidUntil)
		}
	} else if input.Target != nil && len(input.Target.DependencyPins) > 0 {
		return nil, identity.ErrResourceDenied
	}
	target := types.WindowTarget{}
	if input.Target != nil {
		target = *input.Target
	}
	target.DependencyPins = dependencyPins
	target.ExecutionProof = executionProof
	target, e = target.Normalize()
	if e != nil {
		return nil, e
	}
	// No source fallback: only the exact provider bytes above enter the window.
	if !identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	if target.SelectionToken != "" {
		if e = c.TargetProof.Verify(ctx, pin, target, selected.Fingerprint, target.SelectionToken); e != nil {
			return nil, e
		}
	} else {
		target.SelectionToken, e = c.TargetProof.Sign(ctx, pin, target, selected.Fingerprint)
		if e != nil {
			return nil, e
		}
	}
	// Project host transport only after provider definition, target, source and
	// integrity checks complete. Never rewrite provider bytes or descriptors.
	// Compiled selection already returned a detached caller-owned variant.
	nativeConnection := loc.Connection
	nativeConnection.Generation = 0
	if err := projectWindowDatasourceTransport(definition, selected.DataSources, c.nativeHTTPWindows[nativeConnection][loc.URI]); err != nil {
		return nil, err
	}
	if c.Gateway.generation(loc.Connection.Name) != loc.Connection.Generation {
		return nil, identity.ErrResourceStale
	}
	if ctx.Err() != nil || !identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	definition.Resource = &pin
	definition.ResourceTarget = &target
	return &service.WindowDefinitionGetOutput{WindowID: input.WindowID, Definition: definition}, nil
}

// RevalidateWindowResource is used only with a host-held instance pin/target.
// Get performs fresh owning-provider/source checks without replacing either proof.
func (c *WindowCatalog) RevalidateWindowResource(ctx context.Context, key string, pin identity.ResolvedResource, target *types.WindowTarget) (*identity.ResolvedResource, error) {
	result, err := c.Get(ctx, &service.WindowDefinitionGetInput{WindowID: key, ResolvedResource: &pin, Target: target})
	if err != nil {
		return nil, err
	}
	return result.Definition.Resource, nil
}
func (c *WindowCatalog) RevalidateResource(ctx context.Context, key string, pin identity.ResolvedResource) (*identity.ResolvedResource, error) {
	return c.RevalidateWindowResource(ctx, key, pin, nil)
}
func (c *WindowCatalog) CheckWindowAdmission(ctx context.Context, key string) (bool, error) {
	_, e := c.Get(ctx, &service.WindowDefinitionGetInput{WindowID: key})
	return e == nil, e
}
func (c *WindowCatalog) VerifyWindowTarget(ctx context.Context, pin identity.ResolvedResource, target types.WindowTarget, variant string) error {
	if !c.AuthzReady() {
		return identity.ErrResourceDenied
	}
	return c.TargetProof.Verify(ctx, pin, target, variant, target.SelectionToken)
}

// CheckWindowContent is the terminal check after a pure identity phase finishes.
// It never selects a new candidate, accepts a caller source, or renews a pin.
func (c *WindowCatalog) CheckWindowContent(ctx context.Context, key string, pin identity.ResolvedResource, target *types.WindowTarget) error {
	if c == nil || !c.AuthzReady() || ctx == nil || ctx.Err() != nil || !identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) {
		return identity.ErrResourceDenied
	}
	if strings.HasPrefix(key, locatorPrefix) {
		loc, err := decodeWindowLocator(key)
		if err != nil || loc.URI != pin.URI || loc.Connection.ProviderIdentity != pin.ProviderIdentity {
			return identity.ErrResourceDenied
		}
	} else {
		if !strings.Contains(key, "://") && c.DefaultNamespace != "" && c.DefaultProviderIdentity == pin.ProviderIdentity {
			if alias := c.Aliases[key]; alias != "" {
				key = alias
			} else {
				key = "window://" + c.DefaultNamespace + "/" + key
			}
		}
		uri, err := identity.ParseResourceURI(key)
		if err != nil || uri.Kind != "window" || uri.String() != pin.URI {
			return identity.ErrResourceDenied
		}
	}
	if check := c.ContentCurrent[pin.ProviderIdentity]; check != nil {
		if err := check(ctx, pin); err != nil {
			return err
		}
	} else {
		connection, err := c.Gateway.ConnectionForProvider(ctx, pin.ProviderIdentity)
		if err != nil {
			return err
		}
		result, err := Get[json.RawMessage](ctx, c.Gateway, connection, identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}, &pin)
		if err != nil {
			return err
		}
		if result == nil || result.ResolvedResource == nil {
			return identity.ErrResourceDenied
		}
		current := result.ResolvedResource
		if current.URI != pin.URI || current.ProviderIdentity != pin.ProviderIdentity || current.ResourceCandidate != pin.ResourceCandidate || current.AuthorityBinding != pin.AuthorityBinding || identity.MetadataExpiryExtends(current.ValidUntil, pin.ValidUntil) || !identity.MetadataExpiryValid(current.ValidUntil, time.Now()) {
			return identity.ErrResourceDenied
		}
	}
	if ctx.Err() != nil || !identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) {
		return identity.ErrResourceDenied
	}
	return nil
}
