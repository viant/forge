// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"testing"
	"time"

	"github.com/viant/authz"
)

type evaluatorBridgeFunc func(context.Context, authz.Resource, string, []authz.Entity) (bool, string, time.Time, string, string, string, string, error)

func (f evaluatorBridgeFunc) Check(ctx context.Context, resource authz.Resource, action string, selected []authz.Entity) (bool, string, time.Time, string, string, string, string, error) {
	return f(ctx, resource, action, selected)
}

func TestGateBridgeRejectsAccountDriftAndPreservesSelection(t *testing.T) {
	facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant"}
	resource := authz.Resource{Kind: "window", ID: "orders", Version: "1", Tenant: "tenant"}
	entity := &authz.Entity{Type: "customer", ID: "42"}
	returnedAccount := "account"
	gate := GateFromEvaluator(evaluatorBridgeFunc(func(_ context.Context, got authz.Resource, action string, selected []authz.Entity) (bool, string, time.Time, string, string, string, string, error) {
		if got != resource || action != "execute" || len(selected) != 1 || selected[0] != *entity {
			t.Fatalf("request bindings changed: %+v %s %+v", got, action, selected)
		}
		return true, "requirements:policy:provider", time.Now().Add(time.Minute), "alice", "issuer", "tenant", returnedAccount, nil
	}))
	if decision, err := gate(context.Background(), facts, "account", resource, "execute", entity); err != nil || !decision.Allow {
		t.Fatalf("trusted result: %+v %v", decision, err)
	}
	returnedAccount = "other"
	if _, err := gate(context.Background(), facts, "account", resource, "execute", entity); err != ErrGateInvalid {
		t.Fatalf("cross-account result accepted: %v", err)
	}
}
