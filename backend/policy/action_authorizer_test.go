// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/viant/authz"
)

func TestBackendActionRequiresExactACLAccountGateAndPermission(t *testing.T) {
	resource := authz.Resource{Kind: "customer", ID: "catalog", Version: "1", Tenant: "tenant"}
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, Exposures: []string{"FEATURE"}, EntityGroups: authz.EntityGroups{"customer": {"42"}}, ValidUntil: time.Now().Add(time.Hour)}
	provider := &authzFacts{facts: facts}
	service := &authz.Service{Provider: provider, Store: authzPolicies{resource.ID: {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"retrieve": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}, EntityType: "customer"}}}}}
	authorizer := &ActionAuthorizer{Service: service, Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Gate: func(_ context.Context, used authz.Facts, account string, _ authz.Resource, _ string, _ *authz.Entity) (GateResult, error) {
		return GateResult{Allow: account == "account" && len(used.Exposures) == 1, Revision: "requirements-1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, EntityPermission: func(_ context.Context, _ authz.Facts, entity authz.Entity, permission string) (bool, error) {
		return entity.ID == "42" && permission == "read", nil
	}}
	entity := &authz.Entity{Type: "customer", ID: "42"}
	if err := authorizer.Authorize(context.Background(), resource, "retrieve", entity, "read"); err != nil {
		t.Fatalf("exact action denied: %v", err)
	}
	if err := authorizer.Authorize(context.Background(), resource, "retrieve", nil, ""); err == nil {
		t.Fatal("bounded ACL became whole-resource allow")
	}
	if err := authorizer.Authorize(context.Background(), resource, "retrieve", &authz.Entity{Type: "customer", ID: "43"}, "read"); err == nil {
		t.Fatal("other entity allowed")
	}
	if err := authorizer.Authorize(context.Background(), resource, "retrieve", entity, "write"); err == nil {
		t.Fatal("read permission implied write")
	}
	provider.facts.Exposures = nil
	if err := authorizer.Authorize(context.Background(), resource, "retrieve", entity, "read"); err == nil {
		t.Fatal("mandatory account feature bypassed")
	}
	provider.facts.Exposures = []string{"FEATURE"}
	provider.facts.EntityGroups = authz.EntityGroups{"customer": {"42", "43"}}
	authorizer.GateEvaluator = evaluatorBridgeFunc(func(_ context.Context, _ authz.Resource, _ string, selected []authz.Entity) (bool, string, time.Time, string, string, string, string, error) {
		if len(selected) != 2 {
			t.Fatalf("multi-selection narrowed: %+v", selected)
		}
		return true, "requirements:policy:provider", time.Now().Add(time.Minute), "alice", "issuer", "tenant", "account", nil
	})
	selection := []authz.Entity{{Type: "customer", ID: "42"}, {Type: "customer", ID: "43"}}
	if err := authorizer.AuthorizeMany(context.Background(), resource, "retrieve", selection, "read"); err == nil {
		t.Fatal("partial entity permission widened to multi allow")
	}
	authorizer.EntityPermission = func(_ context.Context, _ authz.Facts, entity authz.Entity, permission string) (bool, error) {
		return (entity.ID == "42" || entity.ID == "43") && permission == "read", nil
	}
	if err := authorizer.AuthorizeMany(context.Background(), resource, "retrieve", selection, "read"); err != nil {
		t.Fatalf("exact multi-selection denied: %v", err)
	}
	backend, err := NewStaticBackendMapper([]BackendBinding{{Operation: "tool.execute", ID: "customer:patch", Resource: resource, Action: "retrieve", EntityType: "customer", Permission: "read", SelectionParameter: "customerIds", SelectionMode: "multiple"}})
	if err != nil {
		t.Fatal(err)
	}
	toolCheck := authorizer.ToolCallback(backend)
	if err := toolCheck(context.Background(), "customer:patch", map[string]interface{}{"customerIds": []string{"42", "43"}}); err != nil {
		t.Fatalf("mapped tool denied: %v", err)
	}
	if err := toolCheck(context.Background(), "unknown:patch", nil); err == nil {
		t.Fatal("unmapped tool executed")
	}
}

func TestBackendActionPreservesIdentityAndAccountOutages(t *testing.T) {
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "tenant"}
	outage := errors.New("identity authority unavailable")
	checker := &ActionAuthorizer{Service: &authz.Service{Provider: authzErrorFacts{outage}}, Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{}, nil
	}}
	if err := checker.Authorize(context.Background(), resource, "execute", nil, ""); !errors.Is(err, outage) {
		t.Fatalf("identity outage=%v", err)
	}
	checker.Service.Provider = authzErrorFacts{authz.ErrDenied}
	if err := checker.Authorize(context.Background(), resource, "execute", nil, ""); !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("rejected identity=%v", err)
	}
	checker.Service.Provider = authzFacts{authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", ValidUntil: time.Now().Add(time.Minute)}}
	checker.Account = func(context.Context, authz.Facts) (string, error) { return "", outage }
	if err := checker.Authorize(context.Background(), resource, "execute", nil, ""); !errors.Is(err, outage) {
		t.Fatalf("account outage=%v", err)
	}
}

func TestBackendActionRejectsSecondIdentityReadAndAccountSwitch(t *testing.T) {
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "shared"}
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "shared", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}
	store := authzPolicies{"orders": {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"execute": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}
	provider := &rejectingAfterFacts{facts: facts, rejectAt: 2}
	checker := &ActionAuthorizer{Service: &authz.Service{Store: store, Provider: provider}, Account: func(context.Context, authz.Facts) (string, error) { return "account-1", nil }, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		t.Fatal("gate called after identity rejection")
		return GateResult{}, nil
	}}
	if err := checker.Authorize(context.Background(), resource, "execute", nil, ""); !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("second identity rejection became ordinary denial: %v", err)
	}
	checker.Service.Provider = authzFacts{facts}
	accountReads := 0
	checker.Account = func(context.Context, authz.Facts) (string, error) {
		accountReads++
		if accountReads == 1 {
			return "account-1", nil
		}
		return "account-2", nil
	}
	checker.Gate = func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{Allow: true, Revision: "r1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}
	if err := checker.Authorize(context.Background(), resource, "execute", nil, ""); !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("account switch survived backend check: %v", err)
	}
}

func TestBackendActionRejectsMalformedGateEnvelopeAsUnavailable(t *testing.T) {
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "tenant"}
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Minute)}
	checker := &ActionAuthorizer{Service: &authz.Service{Provider: authzFacts{facts}, Store: authzPolicies{"orders": {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"execute": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}},
		Account: func(context.Context, authz.Facts) (string, error) { return "account", nil },
		GateEvaluator: evaluatorBridgeFunc(func(context.Context, authz.Resource, string, []authz.Entity) (bool, string, time.Time, string, string, string, string, error) {
			return true, "", time.Now().Add(time.Minute), "alice", "issuer", "tenant", "account", nil
		}),
	}
	if err := checker.Authorize(context.Background(), resource, "execute", nil, ""); err != ErrGateInvalid {
		t.Fatalf("missing gate revision became ordinary denial: %v", err)
	}
	checker.GateEvaluator = evaluatorBridgeFunc(func(context.Context, authz.Resource, string, []authz.Entity) (bool, string, time.Time, string, string, string, string, error) {
		return false, "revision", time.Now().Add(time.Minute), "alice", "issuer", "tenant", "account", nil
	})
	if err := checker.Authorize(context.Background(), resource, "execute", nil, ""); err != ErrDenied {
		t.Fatalf("explicit gate denial became outage: %v", err)
	}
}

func TestWindowCatalogCallbackUsesCurrentGateOnEveryOpen(t *testing.T) {
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "tenant"}
	provider := &authzFacts{facts: authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, Exposures: []string{"FEATURE"}, ValidUntil: time.Now().Add(time.Hour)}}
	service := &authz.Service{Provider: provider, Store: authzPolicies{resource.ID: {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"execute": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}}}
	mapper, err := NewStaticResourceMapper([]ResourceBinding{{Operation: OperationWindowView, CandidateID: "orders", Resource: resource, Action: "execute"}})
	if err != nil {
		t.Fatal(err)
	}
	checker := &ActionAuthorizer{Service: service, Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Gate: func(_ context.Context, used authz.Facts, _ string, _ authz.Resource, _ string, _ *authz.Entity) (GateResult, error) {
		return GateResult{Allow: len(used.Exposures) == 1, Revision: "r1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}}
	callback := checker.WindowCallback(mapper)
	if allowed, err := callback(context.Background(), "orders"); err != nil || !allowed {
		t.Fatalf("window denied: %v %v", allowed, err)
	}
	provider.facts.Exposures = nil
	if allowed, err := callback(context.Background(), "orders"); err != nil || allowed {
		t.Fatalf("revoked feature accepted: %v %v", allowed, err)
	}
	if allowed, err := callback(context.Background(), "unknown"); err != nil || allowed {
		t.Fatalf("unknown window exposed: %v %v", allowed, err)
	}
	checker.Service.Provider = authzErrorFacts{authz.ErrDenied}
	if allowed, err := callback(context.Background(), "orders"); allowed || !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("catalog hid identity rejection: allowed=%v err=%v", allowed, err)
	}
}
