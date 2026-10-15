// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

type renewalPolicy struct {
	revisionPolicyFunc
	lease  time.Time
	denied bool
}

func (p *renewalPolicy) AuthorizeRenewal(context.Context, ResolvedResource) (time.Time, error) {
	if p.denied {
		return time.Time{}, ErrResourceDenied
	}
	return p.lease, nil
}
func TestRenewResolvedExactCurrentCandidate(t *testing.T) {
	now := time.Now()
	source := &resourceFixture{content: map[string]json.RawMessage{"1": json.RawMessage(`{"old":true}`)}}
	policy := &renewalPolicy{lease: now.Add(time.Hour)}
	policy.revisionPolicyFunc = func(_ context.Context, _ ResourceRef, c []ResourceCandidate) (ResourceDecision, error) {
		if policy.denied {
			return ResourceDecision{}, ErrResourceDenied
		}
		return ResourceDecision{Candidate: c[0], AuthorityBinding: "fresh credential revision", ValidUntil: now.Add(2 * time.Hour)}, nil
	}
	resolver := &ResourceResolver{ProviderIdentity: "owner", Source: source, Policy: policy, Now: func() time.Time { return now }}
	original := ResolvedResource{ProviderIdentity: "owner", URI: "report://team/report", ResourceCandidate: ResourceCandidate{Kind: StampedCandidate, Revision: "1", ContentFingerprint: ContentFingerprint(source.content["1"])}, AuthorityBinding: "historical", ValidUntil: now.Add(-time.Minute)}
	raw, fresh, err := resolver.RenewResolved(context.Background(), original)
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != string(source.content["1"]) || fresh.AuthorityBinding == original.AuthorityBinding || fresh.ValidUntil.After(policy.lease) {
		t.Fatal("incorrect fresh lease")
	}
	if !original.ValidUntil.Before(now) {
		t.Fatal("original mutated")
	}
	policy.denied = true
	if _, _, err = resolver.RenewResolved(context.Background(), original); err == nil {
		t.Fatal("revocation accepted")
	}
	policy.denied = false
	source.content["1"] = json.RawMessage(`{"changed":true}`)
	if _, _, err = resolver.RenewResolved(context.Background(), original); err == nil {
		t.Fatal("source drift accepted")
	}
	delete(source.content, "1")
	source.content["2"] = json.RawMessage(`{}`)
	if _, _, err = resolver.RenewResolved(context.Background(), original); err == nil {
		t.Fatal("revision switched")
	}
}
