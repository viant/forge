// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"time"
)

// CanonicalActor is stable identity, independent of credential revision or lease.
// Hosts must project it from verified credentials, never request parameters.
// If canonical user mapping differs from the verified subject, the trusted host
// must verify that mapping at bind and preparation time; this type infers none.
type CanonicalActor struct {
	Issuer    string `json:"issuer"`
	Subject   string `json:"subject"`
	TenantID  string `json:"tenantId"`
	AccountID string `json:"accountId"`
}

func canonicalActor(a VerifiedActor) CanonicalActor {
	return CanonicalActor{a.Issuer, a.Subject, a.TenantID, a.AccountID}
}

// SelectionBinding authenticates an original artifact, target, and complete
// selection. It grants no business capability and cannot authorize a held read.
type SelectionBinding struct {
	Actor            CanonicalActor `json:"actor"`
	InstanceID       string         `json:"instanceId"`
	ParametersDigest string         `json:"parametersDigest"`
	Token            string         `json:"token"`
}

// SelectionHMAC is configured by a trusted host. Its key never comes from wire input.
type SelectionHMAC struct {
	key []byte
	Now func() time.Time
}

func NewSelectionHMAC(key []byte) (*SelectionHMAC, error) {
	if len(key) < 32 {
		return nil, ErrResourceDenied
	}
	return &SelectionHMAC{key: append([]byte(nil), key...)}, nil
}
func (s *SelectionHMAC) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}
func SelectionParametersDigest(parameters map[string]any) (string, error) {
	if parameters == nil {
		parameters = map[string]any{}
	}
	raw, err := json.Marshal(parameters)
	if err != nil {
		return "", ErrResourceDenied
	}
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:]), nil
}
func (s *SelectionHMAC) mac(ctx context.Context, pin ResolvedResource, target json.RawMessage, b SelectionBinding) ([]byte, error) {
	if s == nil || len(s.key) < 32 || ctx == nil || ctx.Err() != nil || pin.ProviderIdentity == "" || !pin.ResourceCandidate.Valid() || pin.AuthorityBinding == "" || len(b.InstanceID) > 256 || b.InstanceID == "" || len(b.ParametersDigest) != 64 || !json.Valid(target) {
		return nil, ErrResourceDenied
	}
	if _, err := ParseResourceURI(pin.URI); err != nil {
		return nil, ErrResourceDenied
	}
	decoder := json.NewDecoder(bytes.NewReader(target))
	decoder.UseNumber()
	var decodedTarget any
	if decoder.Decode(&decodedTarget) != nil {
		return nil, ErrResourceDenied
	}
	var trailing any
	if decoder.Decode(&trailing) != io.EOF {
		return nil, ErrResourceDenied
	}
	canonicalTarget, err := json.Marshal(decodedTarget)
	if err != nil {
		return nil, ErrResourceDenied
	}
	pin.ValidUntil = pin.ValidUntil.UTC()
	b.Token = ""
	raw, err := json.Marshal(struct {
		Domain    string
		Resource  ResolvedResource
		Target    json.RawMessage
		Selection SelectionBinding
	}{"resource.selection.v1", pin, canonicalTarget, b})
	if err != nil {
		return nil, ErrResourceDenied
	}
	m := hmac.New(sha256.New, s.key)
	_, _ = m.Write(raw)
	return m.Sum(nil), nil
}

// Bind is called only after original artifact and selection admission.
func (s *SelectionHMAC) Bind(ctx context.Context, pin ResolvedResource, target json.RawMessage, actor VerifiedActor, instanceID string, parameters map[string]any) (*SelectionBinding, error) {
	if s == nil || !actor.Valid(s.now()) || !MetadataExpiryValid(pin.ValidUntil, s.now()) {
		return nil, ErrResourceDenied
	}
	digest, err := SelectionParametersDigest(parameters)
	if err != nil {
		return nil, err
	}
	b := SelectionBinding{Actor: canonicalActor(actor), InstanceID: instanceID, ParametersDigest: digest}
	token, err := s.mac(ctx, pin, target, b)
	if err != nil {
		return nil, err
	}
	b.Token = base64.RawURLEncoding.EncodeToString(token)
	return &b, nil
}

// Verify preserves ordinary artifact expiry checks.
func (s *SelectionHMAC) Verify(ctx context.Context, pin ResolvedResource, target json.RawMessage, b SelectionBinding, parameters map[string]any, current VerifiedActor) error {
	if s == nil || !MetadataExpiryValid(pin.ValidUntil, s.now()) {
		return ErrResourceDenied
	}
	return s.VerifyOriginalForNewDelivery(ctx, pin, target, b, parameters, current)
}

// VerifyOriginalForNewDelivery checks historical selection integrity, including
// expired artifact provenance. Only a trusted NEW-operation preparer may use it;
// it still requires a fresh verified actor and grants no new artifact lease.
// The host must run its credential/revocation verifier before supplying current;
// Valid checks structural validity and expiry, not IdP revocation or user mapping.
func (s *SelectionHMAC) VerifyOriginalForNewDelivery(ctx context.Context, pin ResolvedResource, target json.RawMessage, b SelectionBinding, parameters map[string]any, current VerifiedActor) error {
	if s == nil || !current.Valid(s.now()) || canonicalActor(current) != b.Actor {
		return ErrResourceDenied
	}
	digest, err := SelectionParametersDigest(parameters)
	if err != nil || digest != b.ParametersDigest {
		return ErrResourceDenied
	}
	expected, err := s.mac(ctx, pin, target, b)
	if err != nil {
		return err
	}
	actual, err := base64.RawURLEncoding.DecodeString(b.Token)
	if err != nil || !hmac.Equal(expected, actual) {
		return ErrResourceDenied
	}
	return nil
}
