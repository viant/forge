// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"testing"

	"github.com/viant/authz"
)

func TestStaticCapabilityMappingsSeparateGlobalAndExactEntity(t *testing.T) {
	global := authz.Resource{Kind: "global", ID: "settings", Version: "1", Tenant: "tenant"}
	entity := authz.Resource{Kind: "customer", ID: "catalog", Version: "1", Tenant: "tenant"}
	v1, v2, err := NewStaticCapabilityMappings([]CapabilityBinding{
		{ResourceType: "Customer", Capability: "manageSettings", Global: true, Resource: global, Action: "viewAccess"},
		{ResourceType: "customer", Capability: "read", Resource: entity, Action: "retrieve", EntityType: "customer"},
	})
	if err != nil {
		t.Fatal(err)
	}
	resource, action, selected, err := v1(context.Background(), "customer", 0, "manageSettings", true)
	if err != nil || resource != global || action != "viewAccess" || selected != nil {
		t.Fatalf("global mapping: %+v %s %+v %v", resource, action, selected, err)
	}
	resource, action, selected, err = v2(context.Background(), "customer", "9007199254740993", "read", false)
	if err != nil || resource != entity || action != "retrieve" || selected == nil || selected.ID != "9007199254740993" {
		t.Fatalf("v2 mapping: %+v %s %+v %v", resource, action, selected, err)
	}
	if _, _, _, err := v1(context.Background(), "customer", 42, "manageSettings", false); err == nil {
		t.Fatal("global capability widened from entity")
	}
	if _, _, _, err := v2(context.Background(), "customer", "other", "unknown", false); err == nil {
		t.Fatal("unknown capability mapped")
	}
	if _, _, err := NewStaticCapabilityMappings([]CapabilityBinding{{ResourceType: "customer", Capability: "read", Resource: entity, Action: "retrieve", EntityType: "customer"}, {ResourceType: "Customer", Capability: "read", Resource: entity, Action: "retrieve", EntityType: "customer"}}); err == nil {
		t.Fatal("duplicate normalized mapping accepted")
	}
}
