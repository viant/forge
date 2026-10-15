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
	"sort"
	"strings"
	"time"

	"github.com/viant/authz"
)

// AuthzResolver uses the shared resource/role/exposure/entity model without
// importing Datly or Studio. The deployment owns candidate-to-resource mapping
// and trusted fact resolution. Request.Context is never an authority source.
type AuthzResolver struct {
	Service       *authz.Service
	PolicyVersion string
	Resource      func(context.Context, string, Candidate) (authz.Resource, string, error)
	Account       func(context.Context, authz.Facts) (string, error)
	Gate          GateCheck
}

func (r *AuthzResolver) Resolve(ctx context.Context, request *Request) (*Decision, error) {
	if r == nil || r.Service == nil || r.Service.Provider == nil || r.Resource == nil || r.Account == nil || r.Gate == nil || strings.TrimSpace(r.PolicyVersion) == "" || request == nil || ctx.Err() != nil {
		return nil, ErrDenied
	}
	facts, err := r.Service.Provider.Resolve(ctx)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return nil, ErrIdentityRejected
		}
		return nil, err
	}
	if facts.Subject == "" || facts.Tenant == "" || facts.Issuer == "" || !facts.ValidUntil.After(time.Now()) {
		return nil, ErrIdentityRejected
	}
	accountID, err := r.Account(ctx, facts)
	if err != nil {
		if errors.Is(err, authz.ErrDenied) {
			return nil, ErrIdentityRejected
		}
		return nil, err
	}
	if accountID == "" {
		return nil, ErrIdentityRejected
	}
	result := &Decision{PolicyVersion: r.PolicyVersion, ExpiresAt: facts.ValidUntil, AllowedIDs: []string{}}
	reconfirm := func() error {
		current, err := r.Service.Provider.Resolve(ctx)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return ErrIdentityRejected
			}
			return err
		}
		if !SameAuthorityFacts(facts, current, time.Now()) {
			return ErrIdentityRejected
		}
		currentAccount, err := r.Account(ctx, current)
		if err != nil {
			if errors.Is(err, authz.ErrDenied) {
				return ErrIdentityRejected
			}
			return err
		}
		if currentAccount != accountID {
			return ErrIdentityRejected
		}
		if current.ValidUntil.Before(result.ExpiresAt) {
			result.ExpiresAt = current.ValidUntil
		}
		return nil
	}
	gateRevisions := map[string]bool{}
	policyRevisions := map[string]bool{}
	observedPolicies := map[authz.Resource]int64{}
	seen := map[string]bool{}
	for _, candidate := range request.Candidates {
		if candidate.ID == "" || seen[candidate.ID] {
			return nil, fmt.Errorf("authorization candidates must have distinct nonempty IDs")
		}
		seen[candidate.ID] = true
		resource, action, err := r.Resource(ctx, request.Operation, candidate)
		if err != nil {
			return nil, err
		}
		if resource.ID != candidate.ID {
			return nil, ErrDenied
		}
		decision, current, revision, err := AuthorizeSharedWithRevision(r.Service, ctx, authz.Request{Resource: resource, Action: action})
		if revision > 0 {
			if prior, exists := observedPolicies[resource]; exists && prior != revision {
				return nil, fmt.Errorf("authorization policy changed during admission")
			}
			observedPolicies[resource] = revision
			binding, marshalErr := json.Marshal(struct {
				Resource authz.Resource
				Action   string
				Revision int64
			}{resource, action, revision})
			if marshalErr != nil {
				return nil, marshalErr
			}
			policyRevisions[string(binding)] = true
		}
		if err != nil {
			if !errors.Is(err, authz.ErrDenied) {
				return nil, err
			}
			if err := reconfirm(); err != nil {
				return nil, err
			}
			continue
		}
		if revision < 1 {
			return nil, fmt.Errorf("authorization policy revision is unavailable")
		}
		if current.Subject != "" {
			if !SameAuthorityFacts(facts, current, time.Now()) {
				return nil, ErrIdentityRejected
			}
			if current.ValidUntil.Before(result.ExpiresAt) {
				result.ExpiresAt = current.ValidUntil
			}
		}
		// This consumer authorizes whole candidate resources, not data rows. Never
		// discard entity bounds to turn a scoped grant into whole-resource access.
		if decision.Bounded {
			if err := reconfirm(); err != nil {
				return nil, err
			}
			continue
		}
		gate, err := r.Gate(ctx, facts, accountID, resource, action, nil)
		if err != nil {
			if errors.Is(err, ErrIdentityRejected) {
				return nil, err
			}
			if errors.Is(err, authz.ErrDenied) || errors.Is(err, ErrDenied) {
				if checkErr := reconfirm(); checkErr != nil {
					return nil, checkErr
				}
				continue
			}
			return nil, err
		}
		if gate.Revision == "" || !gate.ValidUntil.After(time.Now()) {
			return nil, ErrGateInvalid
		}
		gateRevisions[gate.Revision] = true
		if !gate.Allow {
			if err := reconfirm(); err != nil {
				return nil, err
			}
			continue
		}
		if gate.ValidUntil.Before(result.ExpiresAt) {
			result.ExpiresAt = gate.ValidUntil
		}
		result.AllowedIDs = append(result.AllowedIDs, candidate.ID)
	}
	if err := reconfirm(); err != nil {
		return nil, err
	}
	for resource, revision := range observedPolicies {
		current, err := r.Service.Store.Get(ctx, resource)
		if err != nil || current.Resource != resource || current.Revision != revision {
			return nil, fmt.Errorf("authorization policy changed during admission")
		}
	}
	if ctx.Err() != nil {
		return nil, ErrDenied
	}
	if !result.ExpiresAt.After(time.Now()) {
		return nil, ErrIdentityRejected
	}
	result.Allow = len(result.AllowedIDs) > 0
	if len(gateRevisions) != 0 {
		revisions := make([]string, 0, len(gateRevisions))
		for revision := range gateRevisions {
			revisions = append(revisions, revision)
		}
		sort.Strings(revisions)
		result.PolicyVersion += ":" + strings.Join(revisions, ",")
	}
	if len(policyRevisions) != 0 {
		revisions := make([]string, 0, len(policyRevisions))
		for revision := range policyRevisions {
			revisions = append(revisions, revision)
		}
		sort.Strings(revisions)
		hash := sha256.Sum256([]byte(strings.Join(revisions, "\n")))
		result.PolicyVersion += ":policies:" + hex.EncodeToString(hash[:12])
	}
	return result, nil
}
