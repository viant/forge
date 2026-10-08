package types

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	identity "github.com/viant/agently-core/protocol/resource"
)

// WindowTargetProof signs a presentation selection, not an ACL grant. Every
// operation must separately refresh authorization of its exact parent pin.
// Hosts may inject a shared signer/verifier for multiple replicas.
type WindowTargetProof interface {
	Sign(context.Context, identity.ResolvedResource, WindowTarget, string) (string, error)
	Verify(context.Context, identity.ResolvedResource, WindowTarget, string, string) error
}
type WindowTargetHMAC struct{ key []byte }

func NewWindowTargetHMAC(key []byte) (*WindowTargetHMAC, error) {
	if len(key) < 32 {
		return nil, fmt.Errorf("window target signing key requires at least 32 bytes")
	}
	return &WindowTargetHMAC{key: append([]byte(nil), key...)}, nil
}
func (s *WindowTargetHMAC) Sign(ctx context.Context, pin identity.ResolvedResource, target WindowTarget, variant string) (string, error) {
	if s == nil || len(s.key) < 32 || ctx == nil || ctx.Err() != nil || !pin.ValidUntil.After(time.Now()) || pin.URI == "" || pin.AuthorityBinding == "" || variant == "" {
		return "", identity.ErrResourceDenied
	}
	target.SelectionToken = ""
	pin.ValidUntil = pin.ValidUntil.UTC()
	normalized, err := target.Normalize()
	if err != nil {
		return "", err
	}
	// Exact original lease is signed. A valid signature cannot extend an
	// in-flight pin, substitute another authority, or switch a target variant.
	raw, err := json.Marshal(struct {
		Domain  string
		Pin     identity.ResolvedResource
		Target  WindowTarget
		Variant string
	}{"window.target.v1", pin, normalized, variant})
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, s.key)
	_, _ = mac.Write(raw)
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}
func (s *WindowTargetHMAC) Verify(ctx context.Context, pin identity.ResolvedResource, target WindowTarget, variant, token string) error {
	expected, err := s.Sign(ctx, pin, target, variant)
	if err != nil {
		return err
	}
	a, e1 := base64.RawURLEncoding.DecodeString(expected)
	b, e2 := base64.RawURLEncoding.DecodeString(token)
	if e1 != nil || e2 != nil || !hmac.Equal(a, b) {
		return identity.ErrResourceDenied
	}
	return nil
}
