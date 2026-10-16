// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"errors"
	"github.com/viant/authz"
	"testing"
	"time"
)

type authzFacts struct{ facts authz.Facts }

func (f authzFacts) Resolve(context.Context) (authz.Facts, error) { return f.facts, nil }

type authzErrorFacts struct{ err error }

func (f authzErrorFacts) Resolve(context.Context) (authz.Facts, error) { return authz.Facts{}, f.err }

type rejectingAfterFacts struct {
	facts    authz.Facts
	reads    int
	rejectAt int
}

func (p *rejectingAfterFacts) Resolve(context.Context) (authz.Facts, error) {
	p.reads++
	if p.reads >= p.rejectAt {
		return authz.Facts{}, authz.ErrDenied
	}
	return p.facts, nil
}

type authzPolicies map[string]authz.Document

type unavailableAuthzStore struct{}

func (unavailableAuthzStore) Get(context.Context, authz.Resource) (authz.Document, error) {
	return authz.Document{}, errors.New("policy store unavailable")
}
func (unavailableAuthzStore) Replace(context.Context, authz.Document, int64, string) (authz.Document, error) {
	return authz.Document{}, authz.ErrDenied
}

func (s authzPolicies) Get(_ context.Context, r authz.Resource) (authz.Document, error) {
	d, ok := s[r.ID]
	if !ok {
		return authz.Document{}, authz.ErrDenied
	}
	return d, nil
}
func (authzPolicies) Replace(context.Context, authz.Document, int64, string) (authz.Document, error) {
	return authz.Document{}, authz.ErrDenied
}
func TestSharedAuthzResolverDoesNotTrustRequestFactsOrDiscardEntityBounds(t *testing.T) {
	makeResource := func(id string) authz.Resource {
		return authz.Resource{Kind: "window", ID: id, Tenant: "one", Version: "1"}
	}
	policies := authzPolicies{}
	for _, id := range []string{"allowed", "scoped", "denied"} {
		p := authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "all", Rules: []authz.Rule{{Kind: "role", Value: "reader"}, {Kind: "exposure", Value: "REPORTING"}}}}
		if id == "scoped" {
			p.EntityType = "publisher"
		}
		if id == "denied" {
			p.Rule = &authz.Rule{Kind: "role", Value: "admin"}
		}
		policies[id] = authz.Document{Resource: makeResource(id), Revision: 1, Policies: map[string]authz.Policy{"view": p}}
	}
	facts := authz.Facts{Subject: "alice", Tenant: "one", Issuer: "trusted", ValidUntil: time.Now().Add(time.Minute), Roles: []string{"reader"}, Exposures: []string{"REPORTING"}, EntityGroups: authz.EntityGroups{"publisher": {"127"}}}
	resolver := &AuthzResolver{Service: &authz.Service{Store: policies, Provider: authzFacts{facts}}, PolicyVersion: "authz-v1", Resource: func(_ context.Context, _ string, c Candidate) (authz.Resource, string, error) {
		return makeResource(c.ID), "view", nil
	}, Account: func(context.Context, authz.Facts) (string, error) { return "account-1", nil }, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{Allow: true, Revision: "gate-1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}}
	request := &Request{Operation: OperationWindowView, Candidates: []Candidate{{ID: "allowed"}, {ID: "scoped"}, {ID: "denied"}}, Context: map[string]any{"roles": []string{"admin"}, "allowedEntities": map[string]any{"publisher": []string{"999"}}}}
	decision, err := resolver.Resolve(context.Background(), request)
	if err != nil || !decision.Allow || len(decision.AllowedIDs) != 1 || decision.AllowedIDs[0] != "allowed" {
		t.Fatalf("decision=%+v err=%v", decision, err)
	}
	if decision.ExpiresAt.After(facts.ValidUntil) {
		t.Fatal("decision lease exceeded verified facts")
	}
	resolver.Gate = func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{Allow: false, Revision: "feature-off", ValidUntil: time.Now().Add(time.Minute)}, nil
	}
	decision, err = resolver.Resolve(context.Background(), request)
	if err != nil || decision.Allow {
		t.Fatalf("mandatory gate was bypassed: %+v %v", decision, err)
	}
	resolver.Gate = func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{Allow: true, Revision: "gate-1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}
	facts.Exposures = nil
	resolver.Service.Provider = authzFacts{facts}
	decision, err = resolver.Resolve(context.Background(), request)
	if err != nil || decision.Allow || len(decision.AllowedIDs) != 0 {
		t.Fatal("missing exposure accepted")
	}
	facts.ValidUntil = time.Now().Add(-time.Second)
	resolver.Service.Provider = authzFacts{facts}
	if _, err = resolver.Resolve(context.Background(), request); err == nil {
		t.Fatal("expired facts accepted")
	}
}

func TestWholeWindowAdmissionRejectsPolicyEditDuringDecision(t *testing.T) {
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "tenant"}
	policies := authzPolicies{"orders": {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"execute": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}
	resolver := &AuthzResolver{Service: &authz.Service{Store: policies, Provider: authzFacts{facts}}, PolicyVersion: "mapping-1",
		Resource: func(context.Context, string, Candidate) (authz.Resource, string, error) {
			return resource, "execute", nil
		},
		Account: func(context.Context, authz.Facts) (string, error) { return "account", nil },
		Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
			changed := policies["orders"]
			changed.Revision = 2
			policies["orders"] = changed
			return GateResult{Allow: true, Revision: "gate-1", ValidUntil: time.Now().Add(time.Minute)}, nil
		},
	}
	decision, err := resolver.Resolve(context.Background(), &Request{Operation: OperationWindowView, Candidates: []Candidate{{ID: "orders"}}})
	if decision != nil || err == nil {
		t.Fatalf("window survived policy edit: decision=%+v err=%v", decision, err)
	}
}

func TestWholeWindowAdmissionVersionTracksPolicyRevision(t *testing.T) {
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "tenant"}
	policies := authzPolicies{"orders": {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"execute": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}
	resolver := &AuthzResolver{Service: &authz.Service{Store: policies, Provider: authzFacts{facts}}, PolicyVersion: "mapping-1",
		Resource: func(context.Context, string, Candidate) (authz.Resource, string, error) {
			return resource, "execute", nil
		},
		Account: func(context.Context, authz.Facts) (string, error) { return "account", nil },
		Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
			return GateResult{Allow: true, Revision: "gate-1", ValidUntil: time.Now().Add(time.Minute)}, nil
		},
	}
	request := &Request{Operation: OperationWindowView, Candidates: []Candidate{{ID: "orders"}}}
	first, err := resolver.Resolve(context.Background(), request)
	if err != nil || !first.Allow {
		t.Fatalf("first admission=%+v err=%v", first, err)
	}
	changed := policies["orders"]
	changed.Revision = 2
	policies["orders"] = changed
	second, err := resolver.Resolve(context.Background(), request)
	if err != nil || !second.Allow || second.PolicyVersion == first.PolicyVersion {
		t.Fatalf("revision reused admission version: first=%+v second=%+v err=%v", first, second, err)
	}
}

func TestSharedAuthzResolverPreservesInfrastructureFailureWhenSupported(t *testing.T) {
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}
	service := &authz.Service{Store: unavailableAuthzStore{}, Provider: authzFacts{facts}}
	if _, supported := any(service).(interface {
		AuthorizeWithStatus(context.Context, authz.Request) (authz.Decision, authz.Facts, int64, error)
	}); !supported {
		t.Skip("pinned authz module predates status-preserving method")
	}
	resolver := &AuthzResolver{Service: service, PolicyVersion: "v1", Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		t.Fatal("gate called after store outage")
		return GateResult{}, nil
	}, Resource: func(_ context.Context, _ string, candidate Candidate) (authz.Resource, string, error) {
		return authz.Resource{Kind: "window", ID: candidate.ID, Version: "1", Tenant: "tenant"}, "execute", nil
	}}
	if _, err := resolver.Resolve(context.Background(), &Request{Operation: OperationWindowView, Candidates: []Candidate{{ID: "orders"}}}); err == nil || errors.Is(err, ErrDenied) {
		t.Fatalf("store outage was classified as ordinary denial: %v", err)
	}
}

func TestSharedAuthzResolverSeparatesRejectedIdentityFromOutage(t *testing.T) {
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "tenant"}
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}
	resolver := &AuthzResolver{Service: &authz.Service{Provider: authzErrorFacts{authz.ErrDenied}}, PolicyVersion: "v1", Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{}, nil
	}, Resource: func(context.Context, string, Candidate) (authz.Resource, string, error) {
		return resource, "execute", nil
	}}
	request := &Request{Operation: OperationWindowView, Candidates: []Candidate{{ID: "orders"}}}
	if _, err := resolver.Resolve(context.Background(), request); !errors.Is(err, ErrDenied) {
		t.Fatalf("rejected identity=%v", err)
	}
	outage := errors.New("identity service unavailable")
	resolver.Service.Provider = authzErrorFacts{outage}
	if _, err := resolver.Resolve(context.Background(), request); !errors.Is(err, outage) {
		t.Fatalf("identity outage=%v", err)
	}
	resolver.Service.Provider = authzFacts{facts}
	resolver.Account = func(context.Context, authz.Facts) (string, error) { return "", outage }
	if _, err := resolver.Resolve(context.Background(), request); !errors.Is(err, outage) {
		t.Fatalf("account outage=%v", err)
	}
}

func TestWholeWindowFilterRejectsIdentityRevocationAfterEarlierAllow(t *testing.T) {
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}
	provider := &rejectingAfterFacts{facts: facts, rejectAt: 3}
	policies := authzPolicies{}
	for _, id := range []string{"first", "second"} {
		resource := authz.Resource{Kind: "window", ID: id, Version: "1", Tenant: "tenant"}
		policies[id] = authz.Document{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"execute": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}
	}
	resolver := &AuthzResolver{Service: &authz.Service{Store: policies, Provider: provider}, PolicyVersion: "v1",
		Account: func(context.Context, authz.Facts) (string, error) { return "account", nil },
		Resource: func(_ context.Context, _ string, candidate Candidate) (authz.Resource, string, error) {
			return policies[candidate.ID].Resource, "execute", nil
		},
		Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
			return GateResult{Allow: true, Revision: "r1", ValidUntil: time.Now().Add(time.Minute)}, nil
		},
	}
	decision, err := resolver.Resolve(context.Background(), &Request{Operation: OperationWindowView, Candidates: []Candidate{{ID: "first"}, {ID: "second"}}})
	if decision != nil || !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("earlier window survived identity rejection: decision=%+v err=%v", decision, err)
	}
}

func TestWholeWindowFilterRejectsAccountSwitchBeforeReturn(t *testing.T) {
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "shared", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "shared"}
	accounts := 0
	resolver := &AuthzResolver{Service: &authz.Service{Store: authzPolicies{"orders": {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"execute": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}, Provider: authzFacts{facts}}, PolicyVersion: "v1",
		Account: func(context.Context, authz.Facts) (string, error) {
			accounts++
			if accounts == 1 {
				return "account-1", nil
			}
			return "account-2", nil
		},
		Resource: func(context.Context, string, Candidate) (authz.Resource, string, error) {
			return resource, "execute", nil
		},
		Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
			return GateResult{Allow: true, Revision: "r1", ValidUntil: time.Now().Add(time.Minute)}, nil
		},
	}
	decision, err := resolver.Resolve(context.Background(), &Request{Operation: OperationWindowView, Candidates: []Candidate{{ID: "orders"}}})
	if decision != nil || !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("window admission survived account switch: decision=%+v err=%v", decision, err)
	}
}

func TestWholeWindowGateDenialDiffersFromInvalidEnvelope(t *testing.T) {
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "tenant"}
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}
	resolver := &AuthzResolver{Service: &authz.Service{Provider: authzFacts{facts}, Store: authzPolicies{"orders": {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"execute": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}}, PolicyVersion: "v1",
		Account: func(context.Context, authz.Facts) (string, error) { return "account", nil },
		Resource: func(context.Context, string, Candidate) (authz.Resource, string, error) {
			return resource, "execute", nil
		},
		Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
			return GateResult{}, authz.ErrDenied
		},
	}
	request := &Request{Operation: OperationWindowView, Candidates: []Candidate{{ID: "orders"}}}
	decision, err := resolver.Resolve(context.Background(), request)
	if err != nil || decision.Allow {
		t.Fatalf("explicit missing gate became outage or allow: %+v %v", decision, err)
	}
	resolver.Gate = func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{Allow: true}, nil
	}
	if _, err := resolver.Resolve(context.Background(), request); err != ErrGateInvalid {
		t.Fatalf("invalid gate envelope became ordinary denial: %v", err)
	}
}
