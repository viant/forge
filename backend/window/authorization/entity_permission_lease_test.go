// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"testing"
	"time"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/policy"
)

func TestSnapshotPreservesAndRechecksEntityPermissionLease(t *testing.T) {
	for _, slow := range []bool{false, true} {
		name := "shorter snapshot"
		if slow {
			name = "expires during authority reconfirm"
		}
		t.Run(name, func(t *testing.T) {
			resource := authz.Resource{Kind: "report", ID: "r", Version: "1", Tenant: "tenant"}
			facts := authz.Facts{Subject: "alice", Issuer: "issuer", Tenant: "tenant", Roles: []string{"reader"}, ValidUntil: time.Now().Add(time.Hour)}
			store, err := authz.NewStaticStore([]authz.Document{{Resource: resource, Revision: 1, Policies: map[string]authz.Policy{"retrieve": {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "reader"}}}}})
			if err != nil {
				t.Fatal(err)
			}
			expiry := time.Now().Add(time.Minute)
			if slow {
				expiry = time.Now().Add(20 * time.Millisecond)
			}
			resolver := &AuthzResolver{Service: &authz.Service{Provider: authzTestProvider{facts}, Store: store}, Version: "mapping", Account: func(context.Context, authz.Facts) (string, error) { return "account", nil }, Map: func(context.Context, string, int, string, bool) (authz.Resource, string, *authz.Entity, error) {
				return resource, "retrieve", &authz.Entity{Type: "advertiser", ID: "1"}, nil
			}, Gate: func(context.Context, authz.Facts, string, authz.Resource, string, *authz.Entity) (policy.GateResult, error) {
				return policy.GateResult{Allow: true, Revision: "gate", ValidUntil: time.Now().Add(time.Minute)}, nil
			}, EntityPermissionWithLease: func(context.Context, authz.Facts, authz.Entity, string) (bool, time.Time, error) {
				return true, expiry, nil
			}}
			if slow {
				resolver.AuthorityRevision = func(context.Context, authz.Facts, string) (string, time.Time, error) {
					time.Sleep(30 * time.Millisecond)
					return "identity", facts.ValidUntil, nil
				}
			}
			snapshot, err := resolver.Resolve(context.Background(), &Request{ResourceType: "advertiser", ResourceIDs: []int{1}, RequestedCapabilities: []string{"read"}})
			if slow {
				if err == nil || snapshot != nil {
					t.Fatalf("expired permission released snapshot: %+v %v", snapshot, err)
				}
			} else if err != nil || snapshot == nil || !snapshot.ExpiresAt.Equal(expiry) || !snapshot.Resources["1"].Capabilities["read"] {
				t.Fatalf("snapshot lease not narrowed: %+v %v", snapshot, err)
			}
		})
	}
}
