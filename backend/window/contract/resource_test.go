// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package window

import (
	"errors"
	"strings"
	"testing"
	"time"

	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func canonicalDefinitionFixture() *Definition {
	hash := strings.Repeat("a", 64)
	return &Definition{Resource: &identity.ResolvedResource{URI: "window://planning/overview", AuthorityBinding: "alice/account/revision-1", ResourceCandidate: identity.ResourceCandidate{Kind: identity.StampedCandidate, Revision: "1", ContentFingerprint: hash}, ValidUntil: time.Now().Add(time.Minute)}, Window: &types.Window{}, DataSources: map[string]*DataSource{"orders": {ID: "orders", Backend: &Backend{Kind: "mcp", Ownership: "host", Service: "analytics", Method: "any-provider/queryOrders", SchemaFingerprint: hash}}}}
}
func TestCanonicalDataSourceSupportsArbitraryMCPAndExplicitHostAliases(t *testing.T) {
	def := canonicalDefinitionFixture()
	if err := ValidateResourceBindings(def, map[string]string{"analytics": "host-owned-service"}); err != nil {
		t.Fatal(err)
	}
	if err := ValidateResourceBindings(def, map[string]string{"another-service": "host-owned-service"}); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("unknown alias=%v", err)
	}
	def.DataSources["orders"].Backend.Ownership = "provider"
	if err := ValidateResourceBindings(def, nil); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("provider credentials/binding must stay private=%v", err)
	}
	def.DataSources["orders"].Backend.Service = ""
	if err := ValidateResourceBindings(def, nil); err != nil {
		t.Fatalf("provider-owned arbitrary MCP=%v", err)
	}
	if _, err := MergeHostBindings(map[string]string{"analytics": "one"}, map[string]string{"analytics": "two"}); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("provider alias conflicts=%v", err)
	}
	if _, err := MergeHostBindings(map[string]string{" analytics": "one"}); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("alias normalization conflict=%v", err)
	}
}
func TestDatlyDataSourceRequiresExactComponentRevisionAndContent(t *testing.T) {
	def := canonicalDefinitionFixture()
	backend := def.DataSources["orders"].Backend
	backend.Kind = "datly"
	if err := ValidateResourceBindings(def, map[string]string{"analytics": "host"}); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("missing component revision=%v", err)
	}
	expected := &ComponentBinding{Kind: "dynamic", ID: "orders", Revision: "7", SchemaFingerprint: strings.Repeat("b", 64), ContentFingerprint: strings.Repeat("c", 64)}
	backend.Component = expected
	if err := ValidateResourceBindings(def, map[string]string{"analytics": "host"}); err != nil {
		t.Fatal(err)
	}
	actual := *expected
	actual.Revision = "8"
	if err := ValidateComponentDispatch(expected, actual); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("component version drift=%v", err)
	}
	actual = *expected
	actual.ContentFingerprint = strings.Repeat("d", 64)
	if err := ValidateComponentDispatch(expected, actual); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("component content drift=%v", err)
	}
	actual = *expected
	actual.Kind = "linked"
	if err := ValidateComponentDispatch(expected, actual); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("component runtime kind drift=%v", err)
	}
	backend.Component.Revision = "active"
	if err := ValidateResourceBindings(def, map[string]string{"analytics": "host"}); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("active substitution=%v", err)
	}
}
func TestFetchUsesDefinitionResolvedResource(t *testing.T) {
	def := canonicalDefinitionFixture()
	pinned := *def.Resource
	if err := ValidateFetchResource(def, FetchInput{Resource: &pinned}); err != nil {
		t.Fatal(err)
	}
	pinned.Revision = "2"
	if err := ValidateFetchResource(def, FetchInput{Resource: &pinned}); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("fetch reselected revision=%v", err)
	}
	pinned = *def.Resource
	pinned.ContentFingerprint = strings.Repeat("b", 64)
	if err := ValidateFetchResource(def, FetchInput{Resource: &pinned}); !errors.Is(err, ErrResourceBinding) {
		t.Fatalf("fetch changed content=%v", err)
	}
}
