package resource

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	mcpclient "github.com/viant/mcp/client"
	authcfg "github.com/viant/mcp/client/auth/config"
)

func TestGatewayAggregateSkipsOnlyTypedUnlinkedConnector(t *testing.T) {
	upstream := &authcfg.OAuthLinkRequiredError{ServerName: "optional", ProviderRef: "optional-oauth", Resource: "https://optional.example/mcp"}
	converted, ok := manager.LinkRequired(upstream)
	require.True(t, ok)
	for _, tc := range []struct {
		name    string
		failure error
		skip    bool
	}{
		{"upstream", upstream, true},
		{"manager-wrapped", fmt.Errorf("initialize: %w", converted), true},
		{"denial", identity.ErrResourceDenied, false},
		{"integrity", identity.ErrResourceStale, false},
		{"offline", errors.New("offline fixture"), false},
		{"text-is-not-type", errors.New("mcp_oauth_link_required"), false},
		{"joined-denial", errors.Join(upstream, identity.ErrResourceDenied), false},
		{"joined-network", errors.Join(upstream, errors.New("network unavailable")), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			available := provider("available-owner")
			options := fixtureOptions{"optional": {PrimitiveProviderIdentity: "optional-owner"}, "available": {PrimitiveProviderIdentity: "available-owner"}}
			mgr, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) {
				if name == "optional" {
					return nil, tc.failure
				}
				return available, nil
			}))
			require.NoError(t, err)
			defer mgr.CloseConversation("")
			actor := identity.VerifiedActor{Issuer: "fixture", Subject: "alice", TenantID: "team", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
			g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "aggregate")
			defer g.Close()
			entries, err := g.List(context.Background(), "window", "example")
			if !tc.skip {
				require.ErrorIs(t, err, tc.failure)
				return
			}
			require.NoError(t, err)
			require.Len(t, entries, 1)
			require.Equal(t, "available-owner", entries[0].Connection.ProviderIdentity)
			got, err := g.Get(context.Background(), entries[0].Connection, identity.ResourceRef{URI: entries[0].Resource.URI}, nil)
			require.NoError(t, err)
			require.NotNil(t, got.ResolvedResource)
			// Directly selecting the unlinked owner preserves the typed requirement.
			_, err = g.Get(context.Background(), Connection{Name: "optional", ProviderIdentity: "optional-owner"}, identity.ResourceRef{URI: "window://example/sales"}, nil)
			required, ok := manager.LinkRequired(err)
			require.True(t, ok)
			require.Equal(t, "optional-oauth", required.ProviderRef)
		})
	}
}
