package types

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

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
