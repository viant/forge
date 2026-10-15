// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"context"
	"encoding/json"
	"time"
)

// RenewalAuthorizer verifies historical selection provenance against fresh
// credentials and current namespace policy. It is an optional trusted host seam;
// implementing SelectRevision alone does not opt a resolver into renewal.
type RenewalAuthorizer interface {
	AuthorizeRenewal(context.Context, ResolvedResource) (time.Time, error)
}

// RenewResolved creates a separate NEW-operation lease for the exact original
// artifact. Callers must never use it inside held reads, replay, or retry flows.
// Stable actor equality belongs to RenewalAuthorizer; authority/credential
// revisions may change after a legitimate refresh and are freshly reauthorized.
func (r *ResourceResolver) RenewResolved(ctx context.Context, original ResolvedResource) (json.RawMessage, *ResolvedResource, error) {
	if r == nil || r.Source == nil || ctx == nil || ctx.Err() != nil || !original.ResourceCandidate.Valid() || original.ProviderIdentity == "" || original.ProviderIdentity != r.ProviderIdentity || original.AuthorityBinding == "" || original.ValidUntil.IsZero() {
		return nil, nil, ErrResourceDenied
	}
	authority, ok := r.Policy.(RenewalAuthorizer)
	if !ok {
		return nil, nil, ErrResourceDenied
	}
	lease, err := authority.AuthorizeRenewal(ctx, original)
	if err != nil {
		return nil, nil, err
	}
	if !lease.After(r.now()) {
		return nil, nil, ErrResourceDenied
	}
	bounded, cancel := context.WithDeadline(ctx, lease)
	defer cancel()
	fresh, err := r.Resolve(bounded, ResourceRef{URI: original.URI, Revision: original.Selector()})
	if err != nil {
		return nil, nil, err
	}
	if fresh.ProviderIdentity != original.ProviderIdentity || fresh.URI != original.URI || fresh.ResourceCandidate != original.ResourceCandidate {
		return nil, nil, ErrResourceStale
	}
	if fresh.ValidUntil.After(lease) {
		fresh.ValidUntil = lease
	}
	raw, terminal, err := r.ReadResolved(bounded, *fresh)
	if err != nil {
		return nil, nil, err
	}
	if terminal == nil || terminal.ProviderIdentity != original.ProviderIdentity || terminal.URI != original.URI || terminal.ResourceCandidate != original.ResourceCandidate {
		return nil, nil, ErrResourceStale
	}
	return raw, terminal, nil
}
