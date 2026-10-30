// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import (
	"strings"
	"testing"

	identity "github.com/viant/forge/backend/resource"
)

func TestDatasourceReferenceBindsExactProviderAndImmutableSelector(t *testing.T) {
	ref := DataSourceReference{Resource: identity.ResourceRef{URI: "datasource://platform/deliver/orders", Revision: "1"}, ProviderIdentity: strings.Repeat("p", 2046) + "é", ContentFingerprint: identity.ContentFingerprint([]byte("definition"))}
	if err := ref.Validate(true); err != nil {
		t.Fatal(err)
	}
	for _, provider := range []string{"", ref.ProviderIdentity + "x", " provider ", string([]byte{0xff})} {
		bad := ref
		bad.ProviderIdentity = provider
		if bad.Validate(false) == nil {
			t.Fatal("invalid provider accepted")
		}
	}
	for _, selector := range []string{"main", "latest", "01", "0"} {
		bad := ref
		bad.Resource.Revision = selector
		if bad.Validate(false) == nil {
			t.Fatal("implicit or noncanonical selector accepted", selector)
		}
	}
	ref.Resource.Revision = identity.WorkingCandidate
	if ref.Validate(false) != nil || ref.Validate(true) == nil {
		t.Fatal("working must remain mutable and unavailable to immutable closure")
	}
}
