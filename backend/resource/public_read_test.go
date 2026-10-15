// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"testing"
	"time"
)

func TestPublicReadNeverVerifiedAuthority(t *testing.T) {
	a := VerifiedActor{PublicRead: true, ValidUntil: time.Now().Add(time.Minute)}
	if a.Valid(time.Now()) || !a.ReadValid(time.Now()) {
		t.Fatal("public read must not be verified authority")
	}
	variants := []VerifiedActor{a, a, a, a, a}
	variants[0].Subject = "user"
	variants[1].Issuer = "idp"
	variants[2].TenantID = "tenant"
	variants[3].AccountID = "account"
	variants[4].IdentityRevision = "revision"
	for _, v := range variants {
		if v.Valid(time.Now()) || v.ReadValid(time.Now()) {
			t.Fatal("public read with private facts accepted")
		}
	}
	a.ValidUntil = time.Now().Add(-time.Second)
	if a.ReadValid(time.Now()) {
		t.Fatal("expired public scope")
	}
}
