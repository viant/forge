// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"strings"
	"time"
)

// CompositeWindowCatalog keeps one host open path while retaining the local
// authoritative catalog and explicit delegated provider locators.
type CompositeWindowCatalog struct {
	Local                 service.WindowDefinitionCatalog
	LocalProviderIdentity string
	Remote                *WindowCatalog
}

func (c *CompositeWindowCatalog) AuthzReady() bool {
	if c == nil || !c.Remote.AuthzReady() {
		return false
	}
	if c.Local == nil {
		return true
	}
	ready, ok := c.Local.(interface{ AuthzReady() bool })
	return ok && ready.AuthzReady()
}
func (c *CompositeWindowCatalog) UsesResourceResolution() bool { return true }
func (c *CompositeWindowCatalog) List(ctx context.Context, input *service.WindowDefinitionListInput) (result *service.WindowDefinitionListOutput, err error) {
	if !c.AuthzReady() {
		return nil, identity.ErrResourceDenied
	}
	if input == nil {
		input = &service.WindowDefinitionListInput{}
	}
	if input.Offset < 0 || input.Limit < 0 || input.Limit > 100 {
		return nil, identity.ErrResource
	}
	// A trusted local catalog can establish the metadata actor context for the
	// whole aggregate read. Its scope must survive the transition to delegated
	// catalogs, which still perform their own current-actor and list admission.
	if scoped, ok := c.Local.(interface {
		BeginWindowList(context.Context) (context.Context, func() error, error)
	}); ok {
		read, finish, scopeErr := scoped.BeginWindowList(ctx)
		if scopeErr != nil {
			return nil, scopeErr
		}
		if read == nil || finish == nil {
			if finish != nil {
				_ = finish()
			}
			return nil, identity.ErrResourceDenied
		}
		ctx = read
		defer func() {
			if finishErr := finish(); err == nil && finishErr != nil {
				result, err = nil, finishErr
			}
		}()
	}
	query := input.Query
	out := []service.WindowDefinitionSummary{}
	seen := map[string]bool{}
	appendCatalog := func(catalog service.WindowDefinitionCatalog, excludedOwner string) error {
		if catalog == nil {
			return nil
		}
		for offset := 0; offset < 10000; offset += 100 {
			request := &service.WindowDefinitionListInput{Query: query, Offset: offset, Limit: 100}
			var page *service.WindowDefinitionListOutput
			var e error
			if remote, ok := catalog.(*WindowCatalog); ok && excludedOwner != "" {
				page, e = remote.listExcludingLocalProvider(ctx, request, excludedOwner)
			} else {
				page, e = catalog.List(ctx, request)
			}
			if e != nil {
				return e
			}
			if page == nil {
				return identity.ErrResource
			}
			for _, row := range page.Windows {
				if excludedOwner != "" && row.ProviderIdentity == excludedOwner {
					return ErrCollision
				}
				key := row.ResourceURI
				if key == "" {
					key = row.WindowID
				}
				if seen[key] {
					return ErrCollision
				}
				seen[key] = true
				out = append(out, row)
			}
			if !page.HasMore {
				return nil
			}
			if len(page.Windows) == 0 {
				return identity.ErrResource
			}
		}
		return identity.ErrResource
	}
	if e := appendCatalog(c.Local, ""); e != nil {
		return nil, e
	}
	excludedOwner := ""
	if c.Local != nil {
		excludedOwner = c.LocalProviderIdentity
	}
	if e := appendCatalog(c.Remote, excludedOwner); e != nil {
		return nil, e
	}
	start := input.Offset
	if start > len(out) {
		start = len(out)
	}
	limit := input.Limit
	if limit == 0 {
		limit = 100
	}
	end := start + limit
	if end > len(out) {
		end = len(out)
	}
	return &service.WindowDefinitionListOutput{Windows: out[start:end], HasMore: end < len(out)}, nil
}
func (c *CompositeWindowCatalog) Get(ctx context.Context, input *service.WindowDefinitionGetInput) (*service.WindowDefinitionGetOutput, error) {
	if input == nil {
		return nil, identity.ErrResource
	}
	if strings.HasPrefix(input.WindowID, locatorPrefix) {
		return c.Remote.Get(ctx, input)
	}
	if uri, e := identity.ParseResourceURI(input.WindowID); e == nil && uri.Kind == "window" {
		if pin := input.ResolvedResource; pin != nil && pin.ProviderIdentity != "" {
			if !c.AuthzReady() || pin.URI != uri.String() {
				return nil, identity.ErrResourceDenied
			}
			if pin.ProviderIdentity == c.LocalProviderIdentity && c.Local != nil {
				return c.Local.Get(ctx, input)
			}
			return c.Remote.GetForProvider(ctx, pin.ProviderIdentity, input)
		}
		rows, e := c.List(ctx, &service.WindowDefinitionListInput{})
		if e != nil {
			return nil, e
		}
		var selected string
		for _, row := range rows.Windows {
			if row.ResourceURI == uri.String() {
				if selected != "" {
					return nil, ErrCollision
				}
				selected = row.WindowID
			}
		}
		if selected == "" {
			return nil, identity.ErrResourceDenied
		}
		copy := *input
		copy.WindowID = selected
		return c.Get(ctx, &copy)
	}
	if input.Namespace != "" || input.ProviderIdentity != "" {
		return c.getScopedWindow(ctx, input)
	}
	if c.Local == nil {
		if c.Remote.DefaultNamespace != "" {
			return c.Remote.Get(ctx, input)
		}
		return nil, identity.ErrResourceDenied
	}
	return c.Local.Get(ctx, input)
}

func (c *CompositeWindowCatalog) RevalidateWindowResource(ctx context.Context, key string, pin identity.ResolvedResource, target *types.WindowTarget) (*identity.ResolvedResource, error) {
	result, err := c.Get(ctx, &service.WindowDefinitionGetInput{WindowID: key, ResolvedResource: &pin, Target: target})
	if err != nil {
		return nil, err
	}
	if result == nil || result.Definition == nil || result.Definition.Resource == nil {
		return nil, identity.ErrResourceDenied
	}
	return result.Definition.Resource, nil
}
func (c *CompositeWindowCatalog) RevalidateResource(ctx context.Context, key string, pin identity.ResolvedResource) (*identity.ResolvedResource, error) {
	return c.RevalidateWindowResource(ctx, key, pin, nil)
}
func (c *CompositeWindowCatalog) ResourceReference(ctx context.Context, key string) (identity.ResourceRef, error) {
	if strings.HasPrefix(key, locatorPrefix) {
		return c.Remote.ResourceReference(ctx, key)
	}
	if uri, e := identity.ParseResourceURI(key); e == nil && uri.Kind == "window" {
		rows, e := c.List(ctx, &service.WindowDefinitionListInput{})
		if e != nil {
			return identity.ResourceRef{}, e
		}
		for _, row := range rows.Windows {
			if row.ResourceURI == key {
				return identity.ResourceRef{URI: key}, nil
			}
		}
		return identity.ResourceRef{}, identity.ErrResourceDenied
	}
	local, ok := c.Local.(interface {
		ResourceReference(context.Context, string) (identity.ResourceRef, error)
	})
	if !ok {
		if c.Remote.DefaultNamespace != "" {
			return c.Remote.ResourceReference(ctx, key)
		}
		return identity.ResourceRef{}, identity.ErrResourceDenied
	}
	return local.ResourceReference(ctx, key)
}
func (c *CompositeWindowCatalog) CheckWindowAdmission(ctx context.Context, key string) (bool, error) {
	if strings.HasPrefix(key, locatorPrefix) {
		return c.Remote.CheckWindowAdmission(ctx, key)
	}
	checker, ok := c.Local.(interface {
		CheckWindowAdmission(context.Context, string) (bool, error)
	})
	if !ok {
		if c.Remote.DefaultNamespace != "" {
			return c.Remote.CheckWindowAdmission(ctx, key)
		}
		return false, identity.ErrResourceDenied
	}
	return checker.CheckWindowAdmission(ctx, key)
}
func (c *CompositeWindowCatalog) VerifyWindowTarget(ctx context.Context, pin identity.ResolvedResource, target types.WindowTarget, variant string) error {
	if pin.ProviderIdentity != c.LocalProviderIdentity {
		return c.Remote.VerifyWindowTarget(ctx, pin, target, variant)
	}
	local, ok := c.Local.(interface {
		VerifyWindowTarget(context.Context, identity.ResolvedResource, types.WindowTarget, string) error
	})
	if !ok {
		return identity.ErrResourceDenied
	}
	return local.VerifyWindowTarget(ctx, pin, target, variant)
}

func (c *CompositeWindowCatalog) CheckWindowContent(ctx context.Context, key string, pin identity.ResolvedResource, target *types.WindowTarget) error {
	if c == nil || !c.AuthzReady() || ctx == nil || ctx.Err() != nil || !identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) {
		return identity.ErrResourceDenied
	}
	ctx, cancel := identity.WithMetadataExpiry(ctx, pin.ValidUntil)
	defer cancel()
	if c.Local != nil && pin.ProviderIdentity == c.LocalProviderIdentity {
		check, ok := c.Local.(interface {
			CheckWindowContent(context.Context, string, identity.ResolvedResource, *types.WindowTarget) error
		})
		if ok {
			return check.CheckWindowContent(ctx, key, pin, target)
		}
		// Older local catalogs retain their authorized exact-pin Get path.
		current, err := c.RevalidateWindowResource(ctx, key, pin, target)
		if err != nil {
			return err
		}
		if current == nil || current.URI != pin.URI || current.ProviderIdentity != pin.ProviderIdentity || current.ResourceCandidate != pin.ResourceCandidate || current.AuthorityBinding != pin.AuthorityBinding || identity.MetadataExpiryExtends(current.ValidUntil, pin.ValidUntil) || !identity.MetadataExpiryValid(current.ValidUntil, time.Now()) || !identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) || ctx.Err() != nil {
			return identity.ErrResourceDenied
		}
		return nil
	}
	return c.Remote.CheckWindowContent(ctx, key, pin, target)
}

// getScopedWindow resolves an authored relative key from visible metadata, then
// performs the existing fresh Get. Catalog visibility is never OPEN authority.
func (c *CompositeWindowCatalog) getScopedWindow(ctx context.Context, input *service.WindowDefinitionGetInput) (*service.WindowDefinitionGetOutput, error) {
	if !c.AuthzReady() || input.Namespace == "" || strings.TrimSpace(input.Namespace) != input.Namespace || strings.TrimSpace(input.ProviderIdentity) != input.ProviderIdentity {
		return nil, identity.ErrResourceDenied
	}
	if input.ProviderIdentity != "" && input.ProviderIdentity == c.LocalProviderIdentity {
		if c.Local == nil {
			return nil, identity.ErrResourceDenied
		}
		var matched string
		complete := false
		for offset := 0; offset < 10000; offset += 100 {
			page, err := c.Local.List(ctx, &service.WindowDefinitionListInput{Offset: offset, Limit: 100})
			if err != nil {
				return nil, err
			}
			if page == nil {
				return nil, identity.ErrResourceDenied
			}
			for _, row := range page.Windows {
				uri, err := identity.ParseResourceURI(row.ResourceURI)
				if err != nil || uri.Kind != "window" || uri.Namespace != input.Namespace {
					continue
				}
				if row.WindowID != input.WindowID && row.Name != input.WindowID && uri.Name != input.WindowID {
					continue
				}
				if matched != "" {
					return nil, ErrCollision
				}
				matched = row.WindowID
			}
			if !page.HasMore {
				complete = true
				break
			}
			if len(page.Windows) == 0 {
				return nil, identity.ErrResourceDenied
			}
		}
		if !complete || matched == "" {
			return nil, identity.ErrResourceDenied
		}
		copy := *input
		copy.WindowID = matched
		return c.Local.Get(ctx, &copy)
	}
	query := CatalogQuery{Namespace: input.Namespace, Limit: 100}
	var selected *LocatedResource
	for {
		page, err := c.Remote.Gateway.ListPage(ctx, "window", query)
		if err != nil {
			return nil, err
		}
		for _, row := range page.Items {
			if row.Connection.ProviderIdentity == c.LocalProviderIdentity || input.ProviderIdentity != "" && row.Connection.ProviderIdentity != input.ProviderIdentity {
				continue
			}
			uri, err := identity.ParseResourceURI(row.Resource.URI)
			if err != nil || uri.Kind != "window" || uri.Namespace != input.Namespace {
				continue
			}
			if row.Resource.Name != input.WindowID && uri.Name != input.WindowID {
				continue
			}
			if selected != nil {
				return nil, ErrCollision
			}
			copy := row.LocatedResource
			selected = &copy
		}
		if page.Complete {
			break
		}
		if page.NextCursor == "" {
			return nil, identity.ErrResourceDenied
		}
		query.Cursor = page.NextCursor
	}
	if selected == nil {
		return nil, identity.ErrResourceDenied
	}
	copy := *input
	copy.WindowID = encodeWindowLocator(selected.Connection, selected.Resource.URI)
	output, err := c.Remote.Get(ctx, &copy)
	if err != nil {
		return nil, err
	}
	if output == nil || output.Definition == nil {
		return nil, identity.ErrResourceDenied
	}
	// Trusted callbacks use the selected canonical identity. The browser retains
	// the authored relative window key in its own native presentation state.
	definition := *output.Definition
	definition.WindowKey = selected.Resource.URI
	result := *output
	result.Definition = &definition
	return &result, nil
}
