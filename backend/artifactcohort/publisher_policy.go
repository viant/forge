package artifactcohort

import "github.com/viant/authz"

// CohortPolicies returns only the policy references for a cohort name and the
// immutable Authz store prepared with that same catalog generation. Names may
// exist in multiple tenants; callers retain their existing scope/ambiguity rules.
// No catalog scan, policy compilation, identity lookup or decision happens here.
// Publication replaces this view atomically. Holding the returned store has the
// same snapshot semantics as Snapshot; it is not a current authorization grant.
func (p *Publisher) CohortPolicies(name string) ([]authz.Resource, authz.Store, error) {
	if p == nil {
		return nil, nil, ErrUnavailable
	}
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.manifest == nil || p.policyStore == nil {
		return nil, nil, ErrUnavailable
	}
	return append([]authz.Resource(nil), p.cohortPolicies[name]...), p.policyStore, nil
}
