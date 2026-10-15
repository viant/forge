// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/viant/authz"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
)

func TestCapabilityMappingUsesVerifiedPinAndNeverWorkingFallback(t *testing.T) {
	mapper, _, err := NewStaticCapabilityMappings([]CapabilityBinding{{ResourceType: "campaign", Capability: "read", EntityType: "campaign", Action: "describe", UseResolvedResource: true, Resource: authz.Resource{Tenant: "trusted-tenant"}}})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := mapper(context.Background(), "campaign", 42, "read", false); err == nil {
		t.Fatal("missing pin fell back to current resource")
	}
	pin := identity.ResolvedResource{URI: "window://steward/campaign", ResourceCandidate: identity.ResourceCandidate{Kind: identity.StampedCandidate, Revision: "1", ContentFingerprint: strings.Repeat("a", 64)}, AuthorityBinding: "verified-account", ValidUntil: time.Now().Add(time.Minute)}
	resource, _, selected, err := mapper(requestctx.WithResolvedResource(context.Background(), pin), "campaign", 42, "read", false)
	if err != nil || resource.ID != pin.URI || resource.Version != "1" || resource.Kind != "window" || resource.Tenant != "trusted-tenant" || selected.ID != "42" {
		t.Fatal("opened historical resource identity lost", resource, selected, err)
	}
	pin.ValidUntil = time.Now().Add(-time.Second)
	if _, _, _, err := mapper(requestctx.WithResolvedResource(context.Background(), pin), "campaign", 42, "read", false); err == nil {
		t.Fatal("expired pin admitted")
	}
	if _, _, err := NewStaticCapabilityMappings([]CapabilityBinding{{ResourceType: "campaign", Capability: "read", EntityType: "campaign", Action: "describe", UseResolvedResource: true, Resource: authz.Resource{Tenant: "trusted-tenant", Version: "working"}}}); err == nil {
		t.Fatal("resolved resource could use explicit revision fallback")
	}
}
