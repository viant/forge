package resource

import (
	"context"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"time"
)

// RenewDefaultPresentation freshly admits the same native public definition.
// This changes only an expired presentation read lease, not a business pin.
func (c *WindowCatalog) RenewDefaultPresentation(ctx context.Context, key string, pin identity.ResolvedResource, target *types.WindowTarget) (*service.WindowDefinitionGetOutput, error) {
	if c.DefaultNamespace != "workspace" || pin.ProviderIdentity != InternalProviderIdentity || identity.MetadataExpiryValid(pin.ValidUntil, time.Now()) || target == nil || len(target.DependencyPins) > 0 || target.ExecutionProof != nil {
		return nil, identity.ErrResourceDenied
	}
	actor, err := c.Gateway.actor(ctx)
	if err != nil || !actor.PublicRead {
		return nil, identity.ErrResourceDenied
	}
	if parsed, err := identity.ParseResourceURI(pin.URI); err != nil || parsed.Kind != "window" || parsed.Namespace != "workspace" {
		return nil, identity.ErrResourceDenied
	}
	// The old integrity proof is lease-bound. A fresh proof covers the identical
	// target dimensions and variant after current original OPEN admission.
	freshTarget := *target
	freshTarget.SelectionToken = ""
	got, err := c.Get(ctx, &service.WindowDefinitionGetInput{WindowID: key, Resource: &identity.ResourceRef{URI: pin.URI, Revision: pin.Selector()}, Target: &freshTarget})
	if err != nil {
		return nil, err
	}
	current := got.Definition.Resource
	if current == nil || current.URI != pin.URI || current.ProviderIdentity != pin.ProviderIdentity || current.ResourceCandidate != pin.ResourceCandidate || current.AuthorityBinding != pin.AuthorityBinding || current.AuthorityBinding != "public-local-definition" {
		return nil, identity.ErrResourceDenied
	}
	return got, nil
}
func (c *CompositeWindowCatalog) RenewDefaultPresentation(ctx context.Context, key string, pin identity.ResolvedResource, target *types.WindowTarget) (*service.WindowDefinitionGetOutput, error) {
	if c.Local != nil {
		return nil, identity.ErrResourceDenied
	}
	return c.Remote.RenewDefaultPresentation(ctx, key, pin, target)
}

// IsDefaultPresentationWindow is trusted host composition, never wire metadata.
func (c *WindowCatalog) IsDefaultPresentationWindow(pin identity.ResolvedResource) bool {
	uri, err := identity.ParseResourceURI(pin.URI)
	return err == nil && c.DefaultNamespace == "workspace" && uri.Kind == "window" && uri.Namespace == "workspace" && pin.ProviderIdentity == InternalProviderIdentity && pin.AuthorityBinding == "public-local-definition"
}
func (c *CompositeWindowCatalog) IsDefaultPresentationWindow(pin identity.ResolvedResource) bool {
	return c.Local == nil && c.Remote.IsDefaultPresentationWindow(pin)
}
