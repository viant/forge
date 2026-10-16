// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/viant/authz"
	identity "github.com/viant/forge/backend/resource"
)

// ResourceRevisionBinding maps a trusted host operation to a logical resource
// family and action. Version selection lives in the public authz SelectionStore.
type ResourceRevisionBinding struct {
	Operation string               `json:"operation"`
	URI       string               `json:"uri"`
	Resource  authz.ResourceFamily `json:"resource"`
	Action    string               `json:"action"`
}

type ResourceRevisionPolicy struct {
	authoritySnapshot AuthoritySnapshotResolver
	authorizer        *ActionAuthorizer
	operation         string
	bindings          []ResourceRevisionBinding
	mappings          authz.SelectionStore
	authorityRevision func(context.Context, authz.Facts, string) (string, time.Time, error)
	selection         func(context.Context, string) ([]authz.Entity, string, error)
}

type ResourceRevisionPolicyOption func(*ResourceRevisionPolicy)

func WithAuthoritySnapshot(resolve AuthoritySnapshotResolver) ResourceRevisionPolicyOption {
	return func(p *ResourceRevisionPolicy) { p.authoritySnapshot = resolve }
}

func NewResourceRevisionPolicy(authorizer *ActionAuthorizer, operation string, bindings []ResourceRevisionBinding, mappings authz.SelectionStore, authorityRevision func(context.Context, authz.Facts, string) (string, time.Time, error), selection func(context.Context, string) ([]authz.Entity, string, error), options ...ResourceRevisionPolicyOption) (*ResourceRevisionPolicy, error) {
	if authorizer == nil || mappings == nil || authorityRevision == nil || operation == "" {
		return nil, fmt.Errorf("resource revision authorizer, policy mappings and operation required")
	}
	seen := map[string]bool{}
	for _, b := range bindings {
		uri, err := identity.ParseResourceURI(b.URI)
		if err != nil || b.Operation == "" || b.Action == "" || b.Resource.Kind != uri.Kind || b.Resource.ID != b.URI || b.Resource.Tenant == "" {
			return nil, fmt.Errorf("invalid resource revision binding")
		}
		key := b.Operation + "\x00" + b.URI
		if seen[key] {
			return nil, fmt.Errorf("duplicate resource revision binding")
		}
		seen[key] = true
	}
	result := &ResourceRevisionPolicy{authorizer: authorizer, operation: operation, bindings: append([]ResourceRevisionBinding(nil), bindings...), mappings: mappings, authorityRevision: authorityRevision, selection: selection}
	for _, option := range options {
		if option != nil {
			option(result)
		}
	}
	return result, nil
}

func (p *ResourceRevisionPolicy) SelectRevision(ctx context.Context, ref identity.ResourceRef, candidates []identity.ResourceCandidate) (decision identity.ResourceDecision, resultErr error) {
	defer func() {
		if resultErr != nil && !errors.Is(resultErr, ErrIdentityRejected) && !errors.Is(resultErr, authz.ErrIdentityDenied) && (errors.Is(resultErr, ErrDenied) || errors.Is(resultErr, authz.ErrDenied)) {
			resultErr = errors.Join(identity.ErrResourceDenied, resultErr)
		}
	}()
	if p == nil || p.authorizer == nil || ctx == nil || ctx.Err() != nil {
		return identity.ResourceDecision{}, ErrDenied
	}
	if _, err := identity.ParseResourceURI(ref.URI); err != nil {
		return identity.ResourceDecision{}, ErrDenied
	}
	initialBinding, identityLease, err := p.authority(ctx)
	if err != nil {
		return identity.ResourceDecision{}, err
	}
	var selected []authz.Entity
	var permission string
	if p.selection != nil {
		selected, permission, err = p.selection(ctx, ref.URI)
		if err != nil {
			return identity.ResourceDecision{}, err
		}
	}
	for _, binding := range p.bindings {
		if binding.Operation != p.operation || binding.URI != ref.URI {
			continue
		}
		version := ref.Revision
		if version == "" {
			request := authz.SelectionRequest{Resource: binding.Resource, Action: binding.Action}
			if len(selected) > 0 {
				request.Selection = &selected
			}
			resolved, err := (&authz.Selector{Mappings: p.mappings, Service: p.authorizer.Service}).Authorize(ctx, request)
			if err != nil {
				return identity.ResourceDecision{}, err
			}
			version = resolved.Resource.Version
		}
		for _, candidate := range candidates {
			if !candidate.Valid() || candidate.Selector() != version {
				continue
			}
			resource := authz.Resource{Kind: binding.Resource.Kind, ID: binding.Resource.ID, Tenant: binding.Resource.Tenant, Version: version}
			lease, err := p.authorizer.AuthorizeManyWithLease(ctx, resource, binding.Action, selected, permission)
			if err != nil {
				return identity.ResourceDecision{}, err
			}
			freshBinding, freshLease, err := p.authority(ctx)
			if err != nil {
				return identity.ResourceDecision{}, err
			}
			if freshBinding != initialBinding {
				return identity.ResourceDecision{}, ErrIdentityRejected
			}
			if identityLease.Before(lease) {
				lease = identityLease
			}
			if freshLease.Before(lease) {
				lease = freshLease
			}
			if ctx.Err() != nil || !lease.After(time.Now()) {
				return identity.ResourceDecision{}, ErrIdentityRejected
			}
			return identity.ResourceDecision{Candidate: candidate, ValidUntil: lease, AuthorityBinding: initialBinding}, nil
		}
		// The policy-selected version must exist. Never fall back to an available
		// publication, a working copy, or another version after denial or absence.
		return identity.ResourceDecision{}, ErrDenied
	}
	return identity.ResourceDecision{}, ErrDenied
}

func (p *ResourceRevisionPolicy) authority(ctx context.Context) (string, time.Time, error) {
	if p != nil && p.authoritySnapshot != nil {
		return ResolveAuthorityBinding(ctx, p.authoritySnapshot)
	}
	if p.authorizer == nil || p.authorizer.Service == nil || p.authorizer.Service.Provider == nil || p.authorizer.Account == nil || p.authorityRevision == nil {
		return "", time.Time{}, ErrIdentityRejected
	}
	facts, err := p.authorizer.Service.Provider.Resolve(ctx)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return "", time.Time{}, ErrIdentityRejected
		}
		return "", time.Time{}, err
	}
	account, err := p.authorizer.Account(ctx, facts)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return "", time.Time{}, ErrIdentityRejected
		}
		return "", time.Time{}, err
	}
	revision, lease, err := p.authorityRevision(ctx, facts, account)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return "", time.Time{}, ErrIdentityRejected
		}
		return "", time.Time{}, err
	}
	if facts.Subject == "" || facts.Issuer == "" || facts.Tenant == "" || account == "" || revision == "" || !facts.ValidUntil.After(time.Now()) || !lease.After(time.Now()) {
		return "", time.Time{}, ErrIdentityRejected
	}
	if facts.ValidUntil.Before(lease) {
		lease = facts.ValidUntil
	}
	raw, err := json.Marshal(struct{ Subject, Issuer, Tenant, Account, Revision string }{facts.Subject, facts.Issuer, facts.Tenant, account, revision})
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return "", time.Time{}, ErrIdentityRejected
		}
		return "", time.Time{}, err
	}
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:]), lease, nil
}
