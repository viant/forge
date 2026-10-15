// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package overlay

import (
	"strings"
	"testing"

	identity "github.com/viant/forge/backend/resource"
)

func TestLibraryReferenceValidatePinsCanonicalTemplateResource(t *testing.T) {
	fingerprint := strings.Repeat("a", 64)
	for _, tc := range []struct {
		name      string
		ref       LibraryReference
		immutable bool
		wantError bool
	}{
		{"working candidate", LibraryReference{Resource: identity.ResourceRef{URI: "template://catalog/customer", Revision: identity.WorkingCandidate}, ProviderIdentity: "template-provider", ContentFingerprint: fingerprint}, false, false},
		{"stamped immutable candidate", LibraryReference{Resource: identity.ResourceRef{URI: "template://catalog/customer", Revision: "12"}, ProviderIdentity: "template-provider", ContentFingerprint: fingerprint}, true, false},
		{"working immutable candidate", LibraryReference{Resource: identity.ResourceRef{URI: "template://catalog/customer", Revision: identity.WorkingCandidate}, ProviderIdentity: "template-provider", ContentFingerprint: fingerprint}, true, true},
		{"missing revision", LibraryReference{Resource: identity.ResourceRef{URI: "template://catalog/customer"}, ProviderIdentity: "template-provider", ContentFingerprint: fingerprint}, false, true},
		{"noncanonical revision", LibraryReference{Resource: identity.ResourceRef{URI: "template://catalog/customer", Revision: "012"}, ProviderIdentity: "template-provider", ContentFingerprint: fingerprint}, false, true},
		{"unknown resource kind", LibraryReference{Resource: identity.ResourceRef{URI: "report://catalog/customer", Revision: "12"}, ProviderIdentity: "template-provider", ContentFingerprint: fingerprint}, true, true},
		{"resource alias", LibraryReference{Resource: identity.ResourceRef{URI: "template://catalog/customer?alias=latest", Revision: "12"}, ProviderIdentity: "template-provider", ContentFingerprint: fingerprint}, false, true},
		{"missing provider", LibraryReference{Resource: identity.ResourceRef{URI: "template://catalog/customer", Revision: "12"}, ContentFingerprint: fingerprint}, false, true},
		{"padded provider", LibraryReference{Resource: identity.ResourceRef{URI: "template://catalog/customer", Revision: "12"}, ProviderIdentity: " template-provider ", ContentFingerprint: fingerprint}, false, true},
		{"incomplete fingerprint", LibraryReference{Resource: identity.ResourceRef{URI: "template://catalog/customer", Revision: "12"}, ProviderIdentity: "template-provider", ContentFingerprint: "abc"}, false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.ref.Validate(tc.immutable)
			if tc.wantError && err == nil {
				t.Fatal("Validate() succeeded, want invalid library reference")
			}
			if !tc.wantError && err != nil {
				t.Fatalf("Validate() error = %v", err)
			}
		})
	}
}
