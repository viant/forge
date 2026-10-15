// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package user

import (
	"errors"
	"testing"

	identity "github.com/viant/forge/backend/resource"
)

func TestCanonicalUserResourceIdentities(t *testing.T) {
	for _, kind := range []string{"report", "window", "skill", "intent"} {
		uri, err := NewURI(kind, "Canonical-Alice", "folder/nested/item")
		if err != nil || uri.String() != kind+"://users/Canonical-Alice/folder/nested/item" {
			t.Fatalf("identity changed: %+v %v", uri, err)
		}
		owner, path, ok := Parse(uri)
		if !ok || owner != "Canonical-Alice" || path != "folder/nested/item" {
			t.Fatalf("round trip changed: %q %q %v", owner, path, ok)
		}
	}
}

func TestUserResourceIdentityRejectsAliasesAndTraversal(t *testing.T) {
	for _, owner := range []string{"", ".", "..", "alice/bob", "alice@example.test", " Alice", "alice%2Fbob", "alice\\bob"} {
		if _, err := NewURI("report", owner, "item"); !errors.Is(err, identity.ErrResource) {
			t.Errorf("invalid canonical owner accepted: %q", owner)
		}
	}
	for _, path := range []string{"", "/item", "../item", "folder/../item", "folder//item", "item/", "folder/%2e%2e/item"} {
		if _, err := NewURI("window", "alice", path); !errors.Is(err, identity.ErrResource) {
			t.Errorf("invalid identity path accepted: %q", path)
		}
	}
	for _, uri := range []identity.ResourceURI{
		{Kind: "report", Namespace: "platform", Name: "alice/item"},
		{Kind: "report", Namespace: "users", Name: "alice"},
		{Kind: "report", Namespace: "users", Name: "alice/../bob"},
	} {
		if _, _, ok := Parse(uri); ok {
			t.Errorf("invalid user URI accepted: %s", uri.String())
		}
	}
}
