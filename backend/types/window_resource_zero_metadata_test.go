package types

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

func TestWindowTargetPreservesLargeDependencyClosure(t *testing.T) {
	pins := make(map[string]identity.ResolvedResource)
	for i := 0; i < 175; i++ {
		id := fmt.Sprintf("source%d", i)
		pins[id] = identity.ResolvedResource{ProviderIdentity: "source", URI: "datasource://workspace/" + id, ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(id))}}
	}
	target, err := (WindowTarget{DependencyPins: pins}).Normalize()
	require.NoError(t, err)
	require.Len(t, target.DependencyPins, 175)
	pins["source174"] = identity.ResolvedResource{URI: "invalid"}
	_, err = (WindowTarget{DependencyPins: pins}).Normalize()
	require.Error(t, err, "every pin remains validated regardless of closure size")
}

func TestCanonicalWindowTargetAllowsNotificationBoundDependencyButRequiresExecutionDeadline(t *testing.T) {
	pin := identity.ResolvedResource{ProviderIdentity: "source", URI: "datasource://workspace/orders", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte("captured"))}, AuthorityBinding: "source-binding"}
	target, err := (WindowTarget{DependencyPins: map[string]identity.ResolvedResource{"orders": pin}}).Normalize()
	require.NoError(t, err)
	require.True(t, target.DependencyPins["orders"].ValidUntil.IsZero())
	execution := pin
	execution.URI = "window://workspace/orders"
	target.ExecutionProof = &primitive.ExecutionProof{Resource: execution, Binding: "execution", Token: "opaque"}
	_, err = target.Normalize()
	require.Error(t, err, "metadata expiry omission cannot remove the real execution deadline")
	target.ExecutionProof.Resource.ValidUntil = time.Now().Add(time.Minute)
	_, err = target.Normalize()
	require.NoError(t, err)
}
