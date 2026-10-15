package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

func TestSelectedMetadataAllowsNoExpiryButExecutionProofRequiresDeadline(t *testing.T) {
	for _, condition := range []string{"notification-bound", "expired-metadata", "missing-execution-deadline", "expired-execution-deadline"} {
		t.Run(condition, func(t *testing.T) {
			raw := json.RawMessage(`{"approved":"original"}`)
			pin := identity.ResolvedResource{URI: "window://workspace/original", ProviderIdentity: "owner", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(raw)}}
			if condition == "expired-metadata" {
				pin.ValidUntil = time.Now().Add(-time.Second)
			}
			connection := Connection{Name: "internal", ProviderIdentity: "owner"}
			result := primitive.GetResult{Resource: &primitive.ResourceState{URI: pin.URI, Definition: raw, ContentFingerprint: pin.ContentFingerprint}, ResolvedResource: &pin}
			if condition == "missing-execution-deadline" || condition == "expired-execution-deadline" {
				result.ExecutionProof = &primitive.ExecutionProof{Resource: pin}
				if condition == "expired-execution-deadline" {
					result.ExecutionProof.Resource.ValidUntil = time.Now().Add(-time.Second)
				}
			}
			state := &resourceReadSequence{gateway: &Gateway{Now: time.Now}, active: true, selection: &selectedDatasourceBundle{resources: map[string]selectedResourceRead{selectionResourceID(connection, pin): {connection: connection, pin: pin, result: result, key: "original-binding"}}}}
			got, found, err := state.selectedRead(context.Background(), connection, &pin, "original-binding")
			if condition == "notification-bound" {
				require.NoError(t, err)
				require.True(t, found)
				require.Equal(t, raw, got.Resource.Definition)
				require.True(t, got.ResolvedResource.ValidUntil.IsZero())
			} else {
				require.ErrorIs(t, err, identity.ErrResourceDenied)
				require.False(t, found)
			}
		})
	}
}
