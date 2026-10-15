// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"github.com/viant/authz"
)

type driftingFactsProvider struct {
	values []authz.Facts
	calls  int
}

func (p *driftingFactsProvider) Resolve(context.Context) (authz.Facts, error) {
	index := p.calls
	if index >= len(p.values) {
		index = len(p.values) - 1
	}
	p.calls++
	return p.values[index], nil
}

func TestSameAuthorityFactsIncludesOptionalPermissionAndScopeFields(t *testing.T) {
	now := time.Now()
	base := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, Exposures: []string{"feature"}, ValidUntil: now.Add(time.Minute)}
	if !SameAuthorityFacts(base, base, now) {
		t.Fatal("identical facts drifted")
	}
	changed := base
	changed.Entities = []authz.Entity{{Type: "customer", ID: "42"}}
	if SameAuthorityFacts(base, changed, now) {
		t.Fatal("legacy flat entity bounds drifted")
	}
	for _, tc := range []struct{ field, raw string }{
		{"EntityPermissions", `{"entityPermissions":[{"type":"customer","id":"42","permissions":["write"]}]}`},
		{"GrantedScopes", `{"grantedScopes":["export:run"]}`},
		{"AuthorityRevision", `{"authorityRevision":"verified-context-2"}`},
	} {
		changed = base
		if err := json.Unmarshal([]byte(tc.raw), &changed); err != nil {
			t.Fatal(err)
		}
		if reflect.ValueOf(base).FieldByName(tc.field).IsValid() && SameAuthorityFacts(base, changed, now) {
			t.Fatalf("%s authority drifted without detection", tc.field)
		}
	}
	if SameAuthorityFacts(base, base, now.Add(2*time.Minute)) {
		t.Fatal("expired authority accepted")
	}
}

func TestWindowAdmissionRejectsNamedPermissionDriftWithinOneDecision(t *testing.T) {
	if !reflect.ValueOf(authz.Facts{}).FieldByName("EntityPermissions").IsValid() {
		t.Skip("pinned authz predates named entity permissions")
	}
	now := time.Now()
	first := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: now.Add(time.Minute)}
	second := first
	if err := json.Unmarshal([]byte(`{"entityPermissions":[{"type":"customer","id":"42","permissions":["write"]}]}`), &second); err != nil {
		t.Fatal(err)
	}
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "tenant"}
	provider := &driftingFactsProvider{values: []authz.Facts{first, second}}
	service := &authz.Service{Provider: provider, Store: authzPolicies{resource.ID: {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"execute": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}}
	resolver := &AuthzResolver{Service: service, PolicyVersion: "v1", Resource: func(context.Context, string, Candidate) (authz.Resource, string, error) {
		return resource, "execute", nil
	}, Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{Allow: true, Revision: "gate", ValidUntil: now.Add(time.Minute)}, nil
	}}
	if _, err := resolver.Resolve(context.Background(), &Request{Operation: OperationWindowView, Candidates: []Candidate{{ID: "orders"}}}); err == nil {
		t.Fatal("window admission accepted permission drift")
	}
}
