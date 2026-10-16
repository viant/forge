// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package policy

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/viant/authz"
	"github.com/viant/authz/gating"
)

func atomicAuthorityFixture() gating.Principal {
	return gating.Principal{Facts: authz.Facts{Subject: "opaque-person", Issuer: "issuer", Tenant: "policy-team", ValidUntil: time.Now().Add(time.Minute)}, AccountID: "opaque-account", IdentityRevision: "authority-v1"}
}
func TestAtomicAuthorityBindingKeepsEachFreshReadAndOriginalLease(t *testing.T) {
	principal := atomicAuthorityFixture()
	calls := 0
	resolve := func(context.Context) (gating.Principal, error) { calls++; return principal, nil }
	first, lease, err := ResolveAuthorityBinding(context.Background(), resolve)
	if err != nil || first == "" || !lease.Equal(principal.Facts.ValidUntil) {
		t.Fatalf("atomic authority=%q lease=%v err=%v", first, lease, err)
	}
	principal.IdentityRevision = "authority-v2"
	second, _, err := ResolveAuthorityBinding(context.Background(), resolve)
	if err != nil || first == second || calls != 2 {
		t.Fatalf("authority was reused: equal=%v calls=%d err=%v", first == second, calls, err)
	}
	principal.AccountID = "different-account"
	third, _, err := ResolveAuthorityBinding(context.Background(), resolve)
	if err != nil || second == third || calls != 3 {
		t.Fatalf("account switch not bound: equal=%v calls=%d err=%v", second == third, calls, err)
	}
}
func TestAtomicAuthorityBindingRejectsIncompleteExpiredAndCanceledIdentity(t *testing.T) {
	for _, change := range []func(*gating.Principal){
		func(p *gating.Principal) { p.Facts.Subject = "" }, func(p *gating.Principal) { p.Facts.Issuer = "" }, func(p *gating.Principal) { p.Facts.Tenant = "*" }, func(p *gating.Principal) { p.AccountID = " " }, func(p *gating.Principal) { p.IdentityRevision = "" }, func(p *gating.Principal) { p.Facts.ValidUntil = time.Now().Add(-time.Second) },
	} {
		principal := atomicAuthorityFixture()
		change(&principal)
		if _, _, err := ResolveAuthorityBinding(context.Background(), func(context.Context) (gating.Principal, error) { return principal, nil }); !errors.Is(err, ErrIdentityRejected) {
			t.Fatalf("invalid authority admitted: %v", err)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	if _, _, err := ResolveAuthorityBinding(ctx, func(context.Context) (gating.Principal, error) { cancel(); return atomicAuthorityFixture(), nil }); !errors.Is(err, ErrIdentityRejected) {
		t.Fatalf("canceled authority admitted: %v", err)
	}
}
func TestAtomicAuthorityBindingPreservesOutageAndDenial(t *testing.T) {
	for _, want := range []error{authz.ErrDenied, authz.ErrUnavailable} {
		_, _, err := ResolveAuthorityBinding(context.Background(), func(context.Context) (gating.Principal, error) { return gating.Principal{}, want })
		if errors.Is(want, authz.ErrDenied) {
			if !errors.Is(err, ErrIdentityRejected) {
				t.Fatalf("denial status=%v", err)
			}
		} else if !errors.Is(err, authz.ErrUnavailable) {
			t.Fatalf("outage status=%v", err)
		}
	}
}
