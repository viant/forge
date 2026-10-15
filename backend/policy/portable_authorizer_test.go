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
	forgeservice "github.com/viant/forge/backend/provider"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

func TestPortableProviderUsesSharedACLAndSelectedInputAuthority(t *testing.T) {
	ctx := context.Background()
	resource := authz.Resource{Kind: "report", ID: "published", Version: "1", Tenant: "tenant"}
	facts := &authzFacts{facts: authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, EntityGroups: authz.EntityGroups{"customer": {"42"}}, ValidUntil: time.Now().Add(time.Hour)}}
	service := &authz.Service{Provider: facts, Store: authzPolicies{resource.ID: {Resource: resource, Revision: 1, Policies: map[string]authz.Policy{
		"describe": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}},
		"execute":  {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}, EntityType: "customer"},
	}}}}
	account := "account"
	checker := &ActionAuthorizer{Service: service, Account: func(context.Context, authz.Facts) (string, error) { return account, nil }, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{Allow: true, Revision: "gate", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, EntityPermission: func(_ context.Context, _ authz.Facts, e authz.Entity, permission string) (bool, error) {
		return e.ID == "42" && permission == "read", nil
	}}
	authority := &PortableAuthorizer{Action: checker, AuthorityRevision: func(context.Context, authz.Facts, string) (string, time.Time, error) {
		return "identity1", time.Now().Add(time.Minute), nil
	}, Map: func(_ context.Context, op, key, source string, inputs map[string]any) (authz.Resource, string, []authz.Entity, string, error) {
		if key != "published" {
			return authz.Resource{}, "", nil, "", ErrDenied
		}
		switch op {
		case "resource.describe":
			return resource, "describe", nil, "", nil
		case "datasource.fetch":
			if source != "rows" {
				return authz.Resource{}, "", nil, "", ErrDenied
			}
			id, _ := inputs["customerId"].(string)
			return resource, "execute", []authz.Entity{{Type: "customer", ID: id}}, "read", nil
		}
		return authz.Resource{}, "", nil, "", ErrDenied
	}}
	fetched := 0
	host := forgeservice.PrimitiveHostFuncs{DefinitionFunc: func(context.Context, *windowprotocol.DefinitionInput) (*windowprotocol.Definition, error) {
		return &windowprotocol.Definition{ContractVersion: 1, DefinitionRevision: "v1", Window: &types.Window{View: types.View{Content: &types.Container{}}}, DataSources: map[string]*windowprotocol.DataSource{"rows": {ID: "rows", Backend: &windowprotocol.Backend{Kind: "provider", Method: windowprotocol.FetchTool, Pinned: map[string]any{"windowKey": "published", "dataSourceId": "rows", "definitionRevision": "v1"}}}}}, nil
	}, FetchFunc: func(context.Context, *windowprotocol.FetchInput) (windowprotocol.FetchOutput, error) {
		fetched++
		return json.RawMessage(`{"rows":[{"id":"42"}]}`), nil
	}}
	provider := &forgeservice.PrimitiveProvider{Authority: authority, Host: host}
	input := &windowprotocol.FetchInput{ContractVersion: 1, DefinitionRevision: "v1", WindowKey: "published", DataSourceID: "rows", Inputs: map[string]any{"customerId": "42", "subject": "mallory", "accountId": "other", "roles": []string{"admin"}}}
	if _, err := provider.Fetch(ctx, input); err != nil || fetched != 1 {
		t.Fatalf("authorized fetch count=%d error=%v", fetched, err)
	}
	input.Inputs["customerId"] = "43"
	if _, err := provider.Fetch(ctx, input); err == nil || fetched != 1 {
		t.Fatal("unselected grant broadened or provider executed denied ID")
	}
	input.Inputs["customerId"] = "42"
	facts.facts.Roles = nil
	if _, err := provider.Fetch(ctx, input); err == nil || fetched != 1 {
		t.Fatal("entity permission bypassed resource ACL")
	}
	facts.facts.Roles = []string{"reader"}
	binding, err := authority.Authenticate(ctx)
	if err != nil {
		t.Fatal(err)
	}
	account = "other"
	if err := authority.AuthorizeFetch(ctx, binding, input); !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("account switch accepted: %v", err)
	}
}
