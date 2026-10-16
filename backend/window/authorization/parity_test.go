// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"encoding/json"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/policy"
)

func TestLegacyAndAuthzSnapshotsAgreeForEquivalentConfiguredAccess(t *testing.T) {
	global := authz.Resource{Kind: "global", ID: "settings", Version: "1", Tenant: "tenant"}
	resource := authz.Resource{Kind: "customer", ID: "catalog", Version: "1", Tenant: "tenant"}
	rule := &authz.Rule{Kind: "role", Value: "reader"}
	provider := &authzTestProvider{facts: authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, Exposures: []string{"feature"}, EntityGroups: authz.EntityGroups{"customer": {"12"}}, ValidUntil: time.Now().Add(time.Hour)}}
	service := &authz.Service{Provider: provider, Store: authzTestStore{docs: map[authz.Resource]authz.Document{
		global:   {Resource: global, Revision: 1, Policies: map[string]authz.Policy{"manage": {Mode: "protected", Rule: rule}}},
		resource: {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"retrieve": {Mode: "protected", Rule: rule, EntityType: "customer"}}},
	}}}
	authzResolver := &AuthzResolver{Service: service, Version: "mapped", Account: func(context.Context, authz.Facts) (string, error) { return "account-21", nil }, Map: func(_ context.Context, kind string, id int, capability string, isGlobal bool) (authz.Resource, string, *authz.Entity, error) {
		if kind != "customer" {
			return authz.Resource{}, "", nil, authz.ErrDenied
		}
		if isGlobal && capability == "manageSettings" {
			return global, "manage", nil, nil
		}
		if !isGlobal && capability == "read" {
			return resource, "retrieve", &authz.Entity{Type: "customer", ID: strconv.Itoa(id)}, nil
		}
		return authz.Resource{}, "", nil, authz.ErrDenied
	}, Gate: func(_ context.Context, facts authz.Facts, _ string, _ authz.Resource, _ string, _ *authz.Entity) (policy.GateResult, error) {
		return policy.GateResult{Allow: len(facts.Exposures) == 1 && facts.Exposures[0] == "feature", Revision: "requirements-1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, EntityPermission: func(_ context.Context, _ authz.Facts, entity authz.Entity, capability string) (bool, error) {
		return entity.ID == "12" && capability == "read", nil
	}}
	request := &Request{ResourceType: "customer", ResourceIDs: []int{12, 13}, RequestedCapabilities: []string{"read"}, RequestedGlobalCapabilities: []string{"manageSettings"}, IncludePrincipal: true}
	for _, enabled := range []bool{true, false} {
		if enabled {
			provider.facts.Exposures = []string{"feature"}
		} else {
			provider.facts.Exposures = nil
		}
		actual, err := authzResolver.Resolve(context.Background(), request)
		if err != nil {
			t.Fatal(err)
		}
		legacy := &Snapshot{AuthorizationVersion: "legacy", ExpiresAt: time.Now().Add(time.Minute), Principal: map[string]any{"subject": "alice", "issuer": "issuer", "tenantId": "tenant", "roles": []string{"reader"}, "features": append([]string{}, provider.facts.Exposures...)}, Account: map[string]any{"id": "account-21"}, GlobalCapabilities: map[string]bool{"manageSettings": enabled}, Resources: map[string]*Resource{"12": {Type: "customer", ID: 12, Capabilities: map[string]bool{"read": enabled}}, "13": {Type: "customer", ID: 13, Capabilities: map[string]bool{"read": false}}}}
		body, err := json.Marshal(legacy)
		if err != nil {
			t.Fatal(err)
		}
		legacyResolver := &MCPResolver{ToolName: "legacy/authorize", Executor: resolverTestExecutor(func(context.Context, string, map[string]interface{}) (string, error) { return string(body), nil })}
		expected, err := legacyResolver.Resolve(context.Background(), request)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(comparableSnapshot(t, actual), comparableSnapshot(t, expected)) {
			t.Fatalf("snapshot parity enabled=%v: authz=%+v legacy=%+v", enabled, actual, expected)
		}
	}
}

func comparableSnapshot(t *testing.T, value *Snapshot) map[string]any {
	t.Helper()
	body, err := json.Marshal(map[string]any{"principal": value.Principal, "account": value.Account, "globalCapabilities": value.GlobalCapabilities, "resources": value.Resources})
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	return result
}
