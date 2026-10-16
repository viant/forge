package resource

import (
	"context"
	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"testing"
)

func TestWindowContentShortAliasesRetainExactURIAndOwner(t *testing.T) {
	proof, err := types.NewWindowTargetHMAC([]byte("0123456789abcdef0123456789abcdef"))
	require.NoError(t, err)
	calls := 0
	c := &WindowCatalog{Gateway: &Gateway{}, TargetProof: proof, DefaultNamespace: "system", DefaultProviderIdentity: "internal", Aliases: map[string]string{"chat/new": "window://system/chat/new"}, ContentCurrent: map[string]WindowContentCheck{"internal": func(context.Context, identity.ResolvedResource) error { calls++; return nil }}}
	pin := identity.ResolvedResource{ProviderIdentity: "internal", URI: "window://system/chat/new", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte("source"))}, AuthorityBinding: "source"}
	require.NoError(t, c.CheckWindowContent(context.Background(), "chat/new", pin, nil))
	require.Equal(t, 1, calls)
	require.ErrorIs(t, c.CheckWindowContent(context.Background(), "chat/history", pin, nil), identity.ErrResourceDenied)
	foreign := pin
	foreign.ProviderIdentity = "foreign"
	require.ErrorIs(t, c.CheckWindowContent(context.Background(), "chat/new", foreign, nil), identity.ErrResourceDenied)
	require.Equal(t, 1, calls, "mismatched short key/owner fails before source check without any routing RPC")
}
