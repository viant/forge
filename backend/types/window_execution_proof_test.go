package types

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/agently-core/protocol/primitive"
	identity "github.com/viant/agently-core/protocol/resource"
)

func TestWindowTargetProviderProofIsCopiedComparedSignedAndNeverAuthored(t *testing.T) {
	ctx := context.Background()
	provider := identity.ResolvedResource{URI: "window://example/view", ProviderIdentity: "provider", ResourceCandidate: identity.ResourceCandidate{Kind: "working", ContentFingerprint: identity.ContentFingerprint([]byte("definition"))}, AuthorityBinding: "verified-owner", ValidUntil: time.Now().UTC().Add(time.Minute)}
	host := provider
	host.ValidUntil = provider.ValidUntil.Add(-time.Second)
	target := WindowTarget{ExecutionProof: &primitive.ExecutionProof{Resource: provider, Binding: "exact-variant", Token: "provider-proof"}}
	normalized, err := target.Normalize()
	require.NoError(t, err)
	require.NotSame(t, target.ExecutionProof, normalized.ExecutionProof)
	target.ExecutionProof.Token = "caller-mutated"
	require.Equal(t, "provider-proof", normalized.ExecutionProof.Token)
	require.False(t, SameWindowTarget(&target, &normalized))
	signer, err := NewWindowTargetHMAC(make([]byte, 32))
	require.NoError(t, err)
	mac, err := signer.Sign(ctx, host, normalized, "variant")
	require.NoError(t, err)
	require.NoError(t, signer.Verify(ctx, host, normalized, "variant", mac))
	altered := normalized
	proof := *normalized.ExecutionProof
	proof.Resource.ValidUntil = proof.Resource.ValidUntil.Add(time.Second)
	altered.ExecutionProof = &proof
	require.Error(t, signer.Verify(ctx, host, altered, "variant", mac))
	raw := json.RawMessage(`{"view":{"content":{"id":"root"}}}`)
	var window Window
	require.NoError(t, json.Unmarshal(raw, &window))
	variant := WindowResourceVariant{Window: &window, DataSources: map[string]json.RawMessage{}}
	fingerprint, err := WindowVariantFingerprint(variant)
	require.NoError(t, err)
	envelope := WindowResourceEnvelope{SchemaVersion: 2, Format: WindowBundleFormat, Targets: []WindowTargetBinding{{Variant: fingerprint}}, Variants: map[string]WindowResourceVariant{fingerprint: variant}}
	require.NoError(t, envelope.Validate())
	envelope.Targets[0].Target.ExecutionProof = normalized.ExecutionProof
	require.Error(t, envelope.Validate(), "runtime proof cannot persist in authored/stamped bytes")
}
