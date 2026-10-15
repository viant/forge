// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

func TestSelectionBindingNewDeliveryIntegrity(t *testing.T) {
	now := time.Now()
	signer, _ := NewSelectionHMAC(make([]byte, 32))
	signer.Now = func() time.Time { return now }
	actor := VerifiedActor{Issuer: "idp", Subject: "alice", TenantID: "1", AccountID: "2", IdentityRevision: "r1", ValidUntil: now.Add(time.Hour)}
	pin := ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: ResourceCandidate{Kind: WorkingCandidate, ContentFingerprint: ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "old", ValidUntil: now.Add(time.Minute)}
	target := json.RawMessage(`{"platform":"web","selectionToken":"original"}`)
	params := map[string]any{"ids": []any{json.Number("9007199254740993"), "opaque"}, "parent": map[string]any{"account": 2}}
	binding, err := signer.Bind(context.Background(), pin, target, actor, "instance", params)
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(2 * time.Minute)
	actor.IdentityRevision = "r2"
	if signer.Verify(context.Background(), pin, target, *binding, params, actor) == nil {
		t.Fatal("ordinary expired read accepted")
	}
	if err = signer.VerifyOriginalForNewDelivery(context.Background(), pin, target, *binding, params, actor); err != nil {
		t.Fatal(err)
	}
	if signer.VerifyOriginalForNewDelivery(context.Background(), pin, json.RawMessage(`{"platform":"mobile","selectionToken":"original"}`), *binding, params, actor) == nil {
		t.Fatal("changed target accepted")
	}
	reordered := map[string]any{"ids": []any{"opaque", json.Number("9007199254740993")}, "parent": map[string]any{"account": 2}}
	if signer.VerifyOriginalForNewDelivery(context.Background(), pin, target, *binding, reordered, actor) == nil {
		t.Fatal("reordered selection accepted")
	}
	for _, test := range []struct {
		name   string
		mutate func(*ResolvedResource, *VerifiedActor, *SelectionBinding, map[string]any)
	}{
		{"actor", func(_ *ResolvedResource, a *VerifiedActor, _ *SelectionBinding, _ map[string]any) { a.AccountID = "3" }},
		{"expired identity", func(_ *ResolvedResource, a *VerifiedActor, _ *SelectionBinding, _ map[string]any) { a.ValidUntil = now }},
		{"candidate", func(p *ResolvedResource, _ *VerifiedActor, _ *SelectionBinding, _ map[string]any) {
			p.ContentFingerprint = ContentFingerprint([]byte(`{"changed":true}`))
		}},
		{"namespace", func(p *ResolvedResource, _ *VerifiedActor, _ *SelectionBinding, _ map[string]any) {
			p.URI = "window://other/view"
		}},
		{"selection", func(_ *ResolvedResource, _ *VerifiedActor, _ *SelectionBinding, p map[string]any) {
			p["parent"] = map[string]any{"account": 3}
		}},
		{"signature", func(_ *ResolvedResource, _ *VerifiedActor, b *SelectionBinding, _ map[string]any) { b.Token = "forged" }},
	} {
		t.Run(test.name, func(t *testing.T) {
			p, a, b := pin, actor, *binding
			ps := map[string]any{"ids": []any{json.Number("9007199254740993"), "opaque"}, "parent": map[string]any{"account": 2}}
			test.mutate(&p, &a, &b, ps)
			if signer.VerifyOriginalForNewDelivery(context.Background(), p, target, b, ps, a) == nil {
				t.Fatal("accepted changed provenance")
			}
		})
	}
}

func TestSelectionTargetCanonicalObjectsAndExactArrays(t *testing.T) {
	now := time.Now()
	signer, _ := NewSelectionHMAC(make([]byte, 32))
	signer.Now = func() time.Time { return now }
	actor := VerifiedActor{Issuer: "idp", Subject: "alice", TenantID: "1", AccountID: "2", IdentityRevision: "v1", ValidUntil: now.Add(time.Hour)}
	pin := ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: ResourceCandidate{Kind: WorkingCandidate, ContentFingerprint: ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "admitted", ValidUntil: now.Add(time.Minute)}
	original := json.RawMessage(`{"platform":"web","selection":{"z":9007199254740993,"a":["opaque",9007199254740995]}}`)
	binding, err := signer.Bind(context.Background(), pin, original, actor, "instance", nil)
	if err != nil {
		t.Fatal(err)
	}
	equivalent := json.RawMessage(" { \"selection\" : { \"a\" : [\"opaque\", 9007199254740995], \"z\" : 9007199254740993 }, \"platform\" : \"web\" } ")
	if err := signer.Verify(context.Background(), pin, equivalent, *binding, nil, actor); err != nil {
		t.Fatalf("equivalent reconstructed target denied: %v", err)
	}
	for _, target := range []json.RawMessage{
		json.RawMessage(`{"platform":"mobile","selection":{"z":9007199254740993,"a":["opaque",9007199254740995]}}`),
		json.RawMessage(`{"platform":"web","selection":{"z":9007199254740993,"a":[9007199254740995,"opaque"]}}`),
		json.RawMessage(`{"platform":"web","selection":{"z":9007199254740992,"a":["opaque",9007199254740995]}}`),
		json.RawMessage(`{"platform":"web"} {"other":true}`),
	} {
		if signer.Verify(context.Background(), pin, target, *binding, nil, actor) == nil {
			t.Fatalf("changed or trailing target accepted: %s", target)
		}
	}
}
