// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

func TestMetadataExpiryOptionalDoesNotRelaxAuthenticatedActor(t *testing.T) {
	now := time.Now()
	zero := time.Time{}
	earlier := now.Add(time.Minute)
	later := now.Add(time.Hour)
	if !MetadataExpiryValid(zero, now) || MetadataExpiryValid(now.Add(-time.Second), now) {
		t.Fatal("optional metadata expiry semantics changed")
	}
	if MinimumMetadataExpiry(zero, earlier) != earlier || MinimumMetadataExpiry(later, zero) != later || MinimumMetadataExpiry(later, earlier) != earlier {
		t.Fatal("real managing deadlines lost")
	}
	if MetadataExpiryExtends(earlier, zero) || !MetadataExpiryExtends(zero, earlier) {
		t.Fatal("zero/nonzero deadline comparison wrong")
	}
	if !(VerifiedActor{PublicRead: true}).ReadValid(now) {
		t.Fatal("timeless public metadata scope rejected")
	}
	actor := VerifiedActor{Subject: "actor", Issuer: "issuer", TenantID: "tenant", AccountID: "account", IdentityRevision: "revision"}
	if actor.Valid(now) || actor.ReadValid(now) {
		t.Fatal("authenticated actor missingexpiry became valid")
	}
}
func TestResolvedDefinitionAllowsManagingEventBoundMetadata(t *testing.T) {
	uri, _ := ParseResourceURI("window://workspace/original")
	raw := json.RawMessage(`{"view":{"content":{"id":"original"}}}`)
	resolver := &ResourceResolver{Source: &LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: metadataPolicy{}}
	pin, err := resolver.Resolve(context.Background(), ResourceRef{URI: uri.String()})
	if err != nil || !pin.ValidUntil.IsZero() {
		t.Fatalf("event-bound source failed: %v", err)
	}
	_, fresh, err := resolver.ReadResolved(context.Background(), *pin)
	if err != nil || !fresh.ValidUntil.IsZero() {
		t.Fatalf("event-bound selectedread failed: %v", err)
	}
}

type metadataPolicy struct{}

func (metadataPolicy) SelectRevision(_ context.Context, _ ResourceRef, c []ResourceCandidate) (ResourceDecision, error) {
	return ResourceDecision{Candidate: c[0], AuthorityBinding: "source"}, nil
}
