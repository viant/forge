// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package resource

import (
	"encoding/json"
	"testing"
	"time"
)

func TestSameResolvedResourceAcrossJSONRoundTrip(t *testing.T) {
	original := ResolvedResource{
		ProviderIdentity:  "internal",
		URI:               "window://workspace/orders",
		ResourceCandidate: ResourceCandidate{Kind: WorkingCandidate, ContentFingerprint: "fingerprint"},
		AuthorityBinding:  "public-local-definition",
		ValidUntil:        time.Now().Add(time.Minute),
	}
	raw, err := json.Marshal(original)
	if err != nil {
		t.Fatal(err)
	}
	var decoded ResolvedResource
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if !SameResolvedResource(original, decoded) {
		t.Fatal("transport round trip changed the resource lease")
	}
	decoded.AuthorityBinding = "other"
	if SameResolvedResource(original, decoded) {
		t.Fatal("different authority binding accepted")
	}
	decoded.AuthorityBinding = original.AuthorityBinding
	decoded.ValidUntil = decoded.ValidUntil.Add(time.Nanosecond)
	if SameResolvedResource(original, decoded) {
		t.Fatal("different expiration accepted")
	}
}
