// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import "testing"

func TestPlaybookAndLegacyIntentKeepExactResourceIdentity(t *testing.T) {
	for _, kind := range []string{"playbook", "intent"} {
		methods := Methods(kind, []string{"list", "get"})
		if Kind(Plural(kind)) != kind || methods["get"] != kind+"s/get" {
			t.Fatalf("unexpected methods for %s: %#v", kind, methods)
		}
		body := []byte(`{"resources":[{"uri":"` + kind + `://sales/analysis","kind":"` + kind + `"}],"complete":true}`)
		if _, err := DecodeList(body, kind); err != nil {
			t.Fatal(err)
		}
		other := "intent"
		if kind == other {
			other = "playbook"
		}
		if _, err := DecodeList(body, other); err == nil {
			t.Fatal("renaming must not reinterpret an authorized resource URI")
		}
	}
}

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
