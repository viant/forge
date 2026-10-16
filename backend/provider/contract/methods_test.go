// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import "testing"

func TestNavigationMethodContract(t *testing.T) {
	if got := Plural("navigation"); got != "navigations" {
		t.Fatalf("navigation plural = %q", got)
	}
	if got := Kind("navigations"); got != "navigation" {
		t.Fatalf("navigation kind = %q", got)
	}
	methods := Methods("navigation", []string{"list", "get"})
	if methods["list"] != "navigations/list" || methods["get"] != "navigations/get" {
		t.Fatalf("navigation methods = %#v", methods)
	}
	if got := Plural("menu"); got != "" {
		t.Fatalf("obsolete menu kind unexpectedly advertised as %q", got)
	}
}
