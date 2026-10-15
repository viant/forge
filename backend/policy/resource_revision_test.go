// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/viant/authz"
	identity "github.com/viant/forge/backend/resource"
)

type revisionFixtureSource map[string]json.RawMessage

func (s revisionFixtureSource) Candidates(context.Context, identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	result := []identity.ResourceCandidate{}
	for _, stamp := range []string{"r2", "r1", "working"} {
		if raw, ok := s[stamp]; ok {
			c := identity.ResourceCandidate{Kind: identity.StampedCandidate, Revision: stamp, ContentFingerprint: identity.ContentFingerprint(raw)}
			if stamp == "working" {
				c.Kind = identity.WorkingCandidate
				c.Revision = ""
			}
			result = append(result, c)
		}
	}
	return result, nil
}
func (s revisionFixtureSource) ReadCandidate(_ context.Context, _ identity.ResourceURI, c identity.ResourceCandidate) (json.RawMessage, error) {
	return s[c.Selector()], nil
}

func TestResourceRevisionPolicyUsesAuthzSelectionAndPinsAuthority(t *testing.T) {
	ctx := context.Background()
	uri := "report://analytics/sales"
	family := authz.ResourceFamily{Kind: "report", ID: uri, Tenant: "tenant"}
	resource := func(version string) authz.Resource {
		return authz.Resource{Kind: family.Kind, ID: family.ID, Tenant: family.Tenant, Version: version}
	}
	docs := []authz.Document{}
	for _, stamp := range []string{"r1", "r2", "working"} {
		role := "reader"
		if stamp == "r2" {
			role = "editor"
		}
		docs = append(docs, authz.Document{Resource: resource(stamp), Revision: 1, Policies: map[string]authz.Policy{"read": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: role}}}})
	}
	store, err := authz.NewStaticStore(docs)
	if err != nil {
		t.Fatal(err)
	}
	selection, err := authz.NewStaticSelectionStore([]authz.SelectionDocument{{Resource: family, Revision: 1, DefaultVersion: "r1", Overrides: []authz.VersionOverride{{Version: "r2", Priority: 1, RequiredExposures: []string{"BETA"}}}}})
	if err != nil {
		t.Fatal(err)
	}
	facts := &authzFacts{facts: authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}}
	account := "account-a"
	gateLease := time.Now().Add(30 * time.Second)
	checker := &ActionAuthorizer{Service: &authz.Service{Provider: facts, Store: store}, Account: func(context.Context, authz.Facts) (string, error) { return account, nil }, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{Allow: true, Revision: "gate1", ValidUntil: gateLease}, nil
	}}
	policy, err := NewResourceRevisionPolicy(checker, "report.retrieve", []ResourceRevisionBinding{{Operation: "report.retrieve", URI: uri, Resource: family, Action: "read"}}, selection, func(context.Context, authz.Facts, string) (string, time.Time, error) {
		return "credential-facts-revision", facts.facts.ValidUntil, nil
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	source := revisionFixtureSource{"r1": json.RawMessage(`{"value":1}`), "r2": json.RawMessage(`{"value":2}`), "working": json.RawMessage(`{"value":3}`)}
	resolver := identity.ResourceResolver{Source: source, Policy: policy}
	pin, err := resolver.Resolve(ctx, identity.ResourceRef{URI: uri})
	if err != nil {
		t.Fatal(err)
	}
	if pin.Revision != "r1" || pin.ValidUntil.After(gateLease) || pin.AuthorityBinding == "" {
		t.Fatalf("policy selection or source lease lost: %+v", pin)
	}
	if _, err = resolver.Resolve(ctx, identity.ResourceRef{URI: uri, Revision: "r2"}); err == nil {
		t.Fatal("explicit forbidden stamp allowed")
	}
	working, err := resolver.Resolve(ctx, identity.ResourceRef{URI: uri, Revision: "working"})
	if err != nil || working.Kind != identity.WorkingCandidate || working.Revision != "" {
		t.Fatalf("explicit authorized working candidate: %v", err)
	}
	facts.facts.Exposures = []string{"BETA"}
	if _, err = resolver.Resolve(ctx, identity.ResourceRef{URI: uri}); err == nil {
		t.Fatal("denied selected revision fell back to older allowed revision")
	}
	facts.facts.Exposures = nil
	account = "account-b"
	if _, _, err = resolver.ReadResolved(ctx, *pin); err == nil {
		t.Fatal("open resource survived an account switch")
	}
	account = "account-a"
	source["r1"] = json.RawMessage(`{"value":99}`)
	if _, _, err = resolver.ReadResolved(ctx, *pin); !errors.Is(err, identity.ErrResourceStale) {
		t.Fatalf("changed definition was not rejected: %v", err)
	}
	delete(source, "r1")
	if _, err = resolver.Resolve(ctx, identity.ResourceRef{URI: uri}); err == nil {
		t.Fatal("missing selected stamp became available working/latest")
	}
}
