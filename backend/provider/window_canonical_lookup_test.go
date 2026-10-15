// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestWindowCatalogAcceptsCanonicalURIWithSameAuthority(t *testing.T) {
	c, policy := targetCatalogFixture(t)
	target := &types.WindowTarget{Platform: "ios", FormFactor: "phone", Surface: "app"}
	got, err := c.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "window://example/sales", Target: target})
	if err != nil {
		t.Fatal(err)
	}
	if got.Definition.View.Content.ID != "phoneRoot" || got.Definition.Resource.URI != "window://example/sales" {
		t.Fatal("canonical lookup lost target or identity")
	}
	ref, err := c.ResourceReference(context.Background(), "window://example/sales")
	if err != nil || ref.URI != "window://example/sales" {
		t.Fatal("canonical reference rejected", err)
	}
	policy.allowed = false
	if _, err = c.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "window://example/sales", Target: target}); err == nil {
		t.Fatal("canonical lookup bypassed revocation")
	}
}

func TestWindowCatalogRejectsUnknownAndAmbiguousCanonicalURI(t *testing.T) {
	c, _ := targetCatalogFixture(t)
	for _, key := range []string{"window://foreign/sales", "report://example/sales", "window://example/sales/extra"} {
		if _, err := c.Get(context.Background(), &WindowDefinitionGetInput{WindowID: key}); err == nil {
			t.Fatal("invalid canonical lookup admitted", key)
		}
	}
	duplicate := c.entries[0]
	duplicate.WindowID = "other-alias"
	c.entries = append(c.entries, duplicate)
	if _, err := c.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "window://example/sales"}); err == nil {
		t.Fatal("ambiguous canonical mapping admitted")
	}
}
