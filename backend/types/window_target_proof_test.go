package types

import (
	"context"
	identity "github.com/viant/agently-core/protocol/resource"
	"strings"
	"testing"
	"time"
)

func TestWindowTargetProofBindsParentVariantProfileAndOriginalLease(t *testing.T) {
	one, _ := NewWindowTargetHMAC([]byte(strings.Repeat("a", 32)))
	replica, _ := NewWindowTargetHMAC([]byte(strings.Repeat("a", 32)))
	pin := identity.ResolvedResource{URI: "window://example/sales", AuthorityBinding: "verified-user/account/facts", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte("all variants"))}, ValidUntil: time.Now().Add(time.Minute)}
	target := WindowTarget{Platform: "ios", FormFactor: "phone", Surface: "app", Capabilities: []string{"touch"}}
	variant := identity.ContentFingerprint([]byte("phone typed definition"))
	token, err := one.Sign(context.Background(), pin, target, variant)
	if err != nil {
		t.Fatal(err)
	}
	if err := replica.Verify(context.Background(), pin, target, variant, token); err != nil {
		t.Fatal("shared verifier rejected same original lease", err)
	}
	offset := pin
	offset.ValidUntil = pin.ValidUntil.In(time.FixedZone("same-instant", -7*60*60))
	if err := replica.Verify(context.Background(), offset, target, variant, token); err != nil {
		t.Fatal("same exact instant changed target proof", err)
	}
	for _, mode := range []string{"profile", "variant", "revision", "resource", "authority", "lease-extension", "expiry", "key"} {
		t.Run(mode, func(t *testing.T) {
			p, target, v, verifier := pin, target, variant, replica
			switch mode {
			case "profile":
				target.FormFactor = "tablet"
			case "variant":
				v = identity.ContentFingerprint([]byte("desktop"))
			case "revision":
				p.ResourceCandidate = identity.ResourceCandidate{Kind: identity.StampedCandidate, Revision: "1", ContentFingerprint: pin.ContentFingerprint}
			case "resource":
				p.URI = "window://other/sales"
			case "authority":
				p.AuthorityBinding = "foreign-account"
			case "lease-extension":
				p.ValidUntil = p.ValidUntil.Add(time.Second)
			case "expiry":
				p.ValidUntil = time.Now().Add(-time.Second)
			case "key":
				verifier, _ = NewWindowTargetHMAC([]byte(strings.Repeat("b", 32)))
			}
			if verifier.Verify(context.Background(), p, target, v, token) == nil {
				t.Fatal("target proof accepted substitution")
			}
		})
	}
}
