// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import (
	"encoding/json"
	"testing"
	"time"

	identity "github.com/viant/forge/backend/resource"
)

func TestExecutionProofRoundTripIsSeparateFromDefinitionAndConsumerLease(t *testing.T) {
	provider := identity.ResolvedResource{ProviderIdentity: "provider", URI: "window://example/overview", ResourceCandidate: identity.ResourceCandidate{Kind: "working", ContentFingerprint: identity.ContentFingerprint([]byte("definition"))}, AuthorityBinding: "verified-actor", ValidUntil: time.Now().UTC().Add(time.Minute)}
	consumer := provider
	consumer.ValidUntil = provider.ValidUntil.Add(-time.Second)
	input := GetResult{Resource: &ResourceState{Definition: json.RawMessage(`{"view":{}}`)}, ResolvedResource: &consumer, ExecutionProof: &ExecutionProof{Resource: provider, Binding: "opaque-binding", Token: "opaque-signature"}}
	raw, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	var output GetResult
	if err = json.Unmarshal(raw, &output); err != nil {
		t.Fatal(err)
	}
	if output.ExecutionProof == nil || output.ExecutionProof.Resource != provider || output.ExecutionProof.Token != "opaque-signature" || output.ExecutionProof.Binding != "opaque-binding" {
		t.Fatalf("proof roundtrip lost original provider pin: %+v", output.ExecutionProof)
	}
	if !output.ResolvedResource.ValidUntil.Equal(consumer.ValidUntil) || !output.ExecutionProof.Resource.ValidUntil.After(output.ResolvedResource.ValidUntil) {
		t.Fatal("proof replaced consumer lease")
	}
	if string(output.Resource.Definition) != `{"view":{}}` {
		t.Fatal("runtime proof changed authored definition")
	}
}
