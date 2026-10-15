// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"reflect"
	"time"

	"github.com/viant/authz"
)

// SameAuthorityFacts rejects a changed authorization principal during one
// operation. Newer authz versions add named entity permissions and OAuth
// scopes; reflection keeps Core buildable with its pinned older module while
// comparing those fields when present.
func SameAuthorityFacts(expected, current authz.Facts, now time.Time) bool {
	if expected.Subject != current.Subject || expected.Issuer != current.Issuer || expected.Tenant != current.Tenant || !expected.ValidUntil.After(now) || !current.ValidUntil.After(now) || !reflect.DeepEqual(expected.Roles, current.Roles) || !reflect.DeepEqual(expected.Exposures, current.Exposures) || !reflect.DeepEqual(expected.EntityGroups, current.EntityGroups) || !reflect.DeepEqual(expected.Entities, current.Entities) {
		return false
	}
	left, right := reflect.ValueOf(expected), reflect.ValueOf(current)
	for _, field := range []string{"EntityPermissions", "GrantedScopes", "AuthorityRevision"} {
		a, b := left.FieldByName(field), right.FieldByName(field)
		if a.IsValid() != b.IsValid() || a.IsValid() && !reflect.DeepEqual(a.Interface(), b.Interface()) {
			return false
		}
	}
	return true
}
