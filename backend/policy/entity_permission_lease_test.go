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

type leasedActionIdentity struct {
	facts authz.Facts
	wait  bool
}

func (p *leasedActionIdentity) Resolve(context.Context) (authz.Facts, error) {
	if p.wait {
		time.Sleep(30 * time.Millisecond)
	}
	return p.facts, nil
}
func TestActionRechecksEntityPermissionLeaseAfterIdentityReconfirmation(t *testing.T) {
	resource := authz.Resource{Kind: "report", ID: "r", Version: "1", Tenant: "tenant"}
	identity := &leasedActionIdentity{facts: authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Hour)}}
	store, err := authz.NewStaticStore([]authz.Document{{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"retrieve": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}})
	if err != nil {
		t.Fatal(err)
	}
	checker := &ActionAuthorizer{Service: &authz.Service{Provider: identity, Store: store}, Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (GateResult, error) {
		return GateResult{Allow: true, Revision: "gate", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, EntityPermissionWithLease: func(context.Context, authz.Facts, authz.Entity, string) (bool, time.Time, error) {
		identity.wait = true
		return true, time.Now().Add(20 * time.Millisecond), nil
	}}
	if err := checker.Authorize(context.Background(), resource, "retrieve", &authz.Entity{Type: "advertiser", ID: "1"}, "read"); !errors.Is(err, ErrGateInvalid) {
		t.Fatalf("expired entity permission released action: %v", err)
	}
}
