// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/viant/authz"
)

func TestStaticBackendMappingPreservesExactMultiEntityIDs(t *testing.T) {
	resource := authz.Resource{Kind: "dataSource", ID: "orders", Version: "1", Tenant: "tenant"}
	mapper, err := NewStaticBackendMapper([]BackendBinding{{Operation: "datasource.fetch", ID: "orderRows", Resource: resource, Action: "retrieve", EntityType: "customer", Permission: "read", SelectionParameter: "customerIds", SelectionMode: "multiple"}})
	if err != nil {
		t.Fatal(err)
	}
	resolved, action, selected, permission, err := mapper(context.Background(), "datasource.fetch", "orderRows", map[string]interface{}{"customerIds": []any{"9007199254740993", json.Number("42"), "42"}})
	if err != nil || resolved != resource || action != "retrieve" || permission != "read" || len(selected) != 2 || selected[0].ID != "42" || selected[1].ID != "9007199254740993" {
		t.Fatalf("mapping=%+v %s %+v %s %v", resolved, action, selected, permission, err)
	}
	if _, _, _, _, err := mapper(context.Background(), "datasource.fetch", "orderRows", nil); err == nil {
		t.Fatal("missing entity selection widened")
	}
	if _, _, _, _, err := mapper(context.Background(), "datasource.fetch", "orderRows", map[string]interface{}{"customerIds": []any{1.5}}); err == nil {
		t.Fatal("fractional ID accepted")
	}
	if _, _, _, _, err := mapper(context.Background(), "datasource.fetch", "orderRows", map[string]interface{}{"customerIds": []any{float64(1 << 53)}}); err == nil {
		t.Fatal("rounded floating ID accepted")
	}
	if _, _, _, _, err := mapper(context.Background(), "report.export", "orderRows", nil); err == nil {
		t.Fatal("backend operation switched mapping")
	}
}

func TestBackendMapperChainUsesTrustedDynamicLookupOnlyForMissingExactBinding(t *testing.T) {
	staticResource := authz.Resource{Kind: "report", ID: "configured", Version: "1", Tenant: "owner"}
	dynamicResource := authz.Resource{Kind: "report", ID: "created", Version: "1", Tenant: "owner"}
	static, err := NewStaticBackendMapper([]BackendBinding{{Operation: "report.retrieve", ID: "configured", Resource: staticResource, Action: "retrieve"},
		{Operation: "datasource.fetch", ID: "rows", Resource: staticResource, Action: "retrieve", EntityType: "customer", Permission: "read", SelectionParameter: "customerIds", SelectionMode: "single"}})
	if err != nil {
		t.Fatal(err)
	}
	calls := 0
	dynamic := BackendMapper(func(_ context.Context, operation, id string, _ map[string]interface{}) (authz.Resource, string, []authz.Entity, string, error) {
		calls++
		if operation != "report.retrieve" || id != "report-run://new" {
			t.Fatalf("unexpected dynamic lookup: %s %s", operation, id)
		}
		return dynamicResource, "retrieve", nil, "", nil
	})
	combined := ChainBackendMappers(static, dynamic)
	resource, action, _, _, err := combined(context.Background(), "report.retrieve", "configured", nil)
	if err != nil || resource != staticResource || action != "retrieve" || calls != 0 {
		t.Fatalf("exact static binding was not authoritative: %+v %q calls=%d err=%v", resource, action, calls, err)
	}
	if _, _, _, _, err := combined(context.Background(), "datasource.fetch", "rows", nil); !errors.Is(err, ErrDenied) || errors.Is(err, ErrBackendUnmapped) || calls != 0 {
		t.Fatalf("invalid static selection fell through: %v calls=%d", err, calls)
	}
	resource, action, _, _, err = combined(context.Background(), "report.retrieve", "report-run://new", nil)
	if err != nil || resource != dynamicResource || action != "retrieve" || calls != 1 {
		t.Fatalf("trusted dynamic binding was not used: %+v %q calls=%d err=%v", resource, action, calls, err)
	}
	if _, _, _, _, err := static(context.Background(), "report.retrieve", "report-run://new", nil); !errors.Is(err, ErrBackendUnmapped) || !errors.Is(err, ErrDenied) {
		t.Fatalf("missing static binding did not preserve denial: %v", err)
	}
}
