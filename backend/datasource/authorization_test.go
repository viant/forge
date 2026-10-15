// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
	"github.com/viant/forge/backend/window/authorization"
	"reflect"
	"testing"
	"time"
)

type permissionResolverFunc func(context.Context, *permittedview.Request) (*permittedview.Snapshot, error)

func (f permissionResolverFunc) Resolve(c context.Context, r *permittedview.Request) (*permittedview.Snapshot, error) {
	return f(c, r)
}
func permissionFixture(r permittedview.Resolver) (*Service, *dsproto.DataSource) {
	d := &dsproto.DataSource{ID: "permission", DataSource: types.DataSource{Cardinality: "object"}, Backend: &dsproto.Backend{Kind: dsproto.BackendAuthorization, Authorization: &dsproto.AuthorizationBinding{SchemaVersion: 1, ResourceType: "campaign", ResourceIDsArgument: "ResourceIDs", Capabilities: []string{"read", "archive"}, MaxResourceIDs: 20}}}
	store := NewMemoryStore()
	store.Put(d)
	return New(Options{Store: store, PermissionResolver: r}), d
}
func TestAuthorizationDatasourceUsesTrustedQueryAndNeverCaches(t *testing.T) {
	type actorKey struct{}
	calls := 0
	service, _ := permissionFixture(permissionResolverFunc(func(c context.Context, r *permittedview.Request) (*permittedview.Snapshot, error) {
		calls++
		if c.Value(actorKey{}) != "verified" || r.ResourceType != "campaign" || !reflect.DeepEqual(r.ResourceIDs, []int{42}) || !reflect.DeepEqual(r.RequestedCapabilities, []string{"read", "archive"}) || r.IncludePrincipal {
			t.Fatal("caller replaced trusted query")
		}
		return &permittedview.Snapshot{AuthorizationVersion: "p", ExpiresAt: time.Now().Add(time.Minute), Principal: map[string]any{"private": "hidden"}, Resources: map[string]*permittedview.Resource{"42": {Type: "campaign", ID: 42, Capabilities: map[string]bool{"read": true, "archive": calls == 1, "delete": true}}, "99": {Type: "campaign", ID: 99, Capabilities: map[string]bool{"archive": true}}}}, nil
	}))
	for i := 0; i < 2; i++ {
		got, err := service.Fetch(context.WithValue(context.Background(), actorKey{}, "verified"), "permission", map[string]interface{}{"ResourceIDs": []int{42}, "ResourceType": "advertiser", "IncludePrincipal": true, "includePrincipal": true, "RequestedCapabilities": []string{"delete"}}, FetchOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if len(got.Rows) != 1 || got.Cache != nil {
			t.Fatal("missing or cached authorization")
		}
		row := got.Rows[0]
		resources := row["resources"].(map[string]interface{})
		if len(resources) != 1 || row["principal"] != nil {
			t.Fatal("broader authority leaked")
		}
		caps := resources["42"].(map[string]interface{})["capabilities"].(map[string]interface{})
		if len(caps) != 2 || caps["archive"] != (i == 0) {
			t.Fatal("revoked capability reused")
		}
	}
	if calls != 2 {
		t.Fatal("provider not refreshed")
	}
}
func TestAuthorizationDatasourceRejectsInvalidSelectionAndExpiredAuthority(t *testing.T) {
	calls := 0
	r := permissionResolverFunc(func(context.Context, *permittedview.Request) (*permittedview.Snapshot, error) {
		calls++
		return &permittedview.Snapshot{AuthorizationVersion: "p", ExpiresAt: time.Now().Add(-time.Second)}, nil
	})
	for _, ids := range []interface{}{nil, []int{}, []int{1, 1}, []int{-1}, []float64{1.5}, []string{"42"}, []int64{9007199254740992}, make([]int, 21)} {
		s, _ := permissionFixture(r)
		if got, err := s.Fetch(context.Background(), "permission", map[string]interface{}{"ResourceIDs": ids}, FetchOptions{}); err == nil || got != nil {
			t.Fatalf("invalid selection accepted: %v", ids)
		}
	}
	if calls != 0 {
		t.Fatal("invalid IDs reached provider")
	}
	for _, resolver := range []permittedview.Resolver{r, nil} {
		s, _ := permissionFixture(resolver)
		if got, err := s.Fetch(context.Background(), "permission", map[string]interface{}{"ResourceIDs": []int{42}}, FetchOptions{}); err == nil || got != nil {
			t.Fatal("expired or missing authority accepted")
		}
	}
}
func TestAuthorizationDatasourcePreservesV2OpaqueIDs(t *testing.T) {
	id := "900719925474099312345"
	s, d := permissionFixture(permissionResolverFunc(func(_ context.Context, r *permittedview.Request) (*permittedview.Snapshot, error) {
		if !reflect.DeepEqual(r.StringResourceIDs, []string{id}) || len(r.ResourceIDs) != 0 {
			t.Fatal("opaque ID changed")
		}
		return &permittedview.Snapshot{SchemaVersion: 2, AuthorizationVersion: "p", ExpiresAt: time.Now().Add(time.Minute), Resources: map[string]*permittedview.Resource{id: {Type: "campaign", IDString: id, Capabilities: map[string]bool{"read": true}}}}, nil
	}))
	d.Backend.Authorization.SchemaVersion = 2
	if _, err := s.Fetch(context.Background(), "permission", map[string]interface{}{"ResourceIDs": []string{id}}, FetchOptions{}); err != nil {
		t.Fatal(err)
	}
}

func TestAuthorizationDatasourceDropsExpiredProjectionAfterFinalResourceCheck(t *testing.T) {
	now := time.Now()
	s, _ := permissionFixture(permissionResolverFunc(func(context.Context, *permittedview.Request) (*permittedview.Snapshot, error) {
		return &permittedview.Snapshot{AuthorizationVersion: "p", ExpiresAt: now.Add(time.Second)}, nil
	}))
	s.now = func() time.Time { return now }
	checks := 0
	s.authorizeDefinition = func(context.Context, *dsproto.DataSource, map[string]interface{}) error {
		checks++
		if checks == 2 {
			now = now.Add(2 * time.Second)
		}
		return nil
	}
	got, err := s.Fetch(context.Background(), "permission", map[string]interface{}{"ResourceIDs": []int{42}}, FetchOptions{})
	if err == nil || got != nil || checks != 2 {
		t.Fatal("expired projection released after final resource validation", got, err, checks)
	}
}

func TestAuthorizationDatasourceUsesOnlyTrustedPrincipalProjectionFlag(t *testing.T) {
	s, d := permissionFixture(permissionResolverFunc(func(_ context.Context, r *permittedview.Request) (*permittedview.Snapshot, error) {
		if !r.IncludePrincipal {
			t.Fatal("trusted projection flag lost")
		}
		return &permittedview.Snapshot{AuthorizationVersion: "p", ExpiresAt: time.Now().Add(time.Minute), Principal: map[string]any{"features": []string{"capture-objectives"}}, Account: map[string]any{"id": 42, "businessModelContext": 1}, Resources: map[string]*permittedview.Resource{"42": {Type: "campaign", ID: 42, Capabilities: map[string]bool{"read": true}}}}, nil
	}))
	d.Backend.Authorization.IncludePrincipal = true
	got, err := s.Fetch(context.Background(), "permission", map[string]interface{}{"ResourceIDs": []int{42}, "account": map[string]any{"businessModelContext": 999}, "principal": map[string]any{"features": []string{"forged"}}}, FetchOptions{})
	if err != nil || len(got.Rows) != 1 {
		t.Fatal(got, err)
	}
	account := got.Rows[0]["account"].(map[string]interface{})
	principal := got.Rows[0]["principal"].(map[string]interface{})
	if account["businessModelContext"] != float64(1) || !reflect.DeepEqual(principal["features"], []interface{}{"capture-objectives"}) {
		t.Fatal("verified feature/account projection changed", got)
	}
}
