package resource

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	mcpclient "github.com/viant/mcp/client"
	authcfg "github.com/viant/mcp/client/auth/config"
)

func TestNativeSkillScopeHonorsParticipantsAndSkipsOnlyOptionalLink(t *testing.T) {
	missing := &authcfg.OAuthLinkRequiredError{ServerName: "optional", ProviderRef: "optional-oauth"}
	for _, tc := range []struct {
		name    string
		failure error
		skip    bool
	}{
		{"unlinked", missing, true},
		{"offline", errors.New("offline fixture"), false},
		{"denied", identity.ErrResourceDenied, false},
		{"joined", errors.Join(missing, identity.ErrResourceDenied), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			optionalCalls, availableCalls := 0, 0
			linked := false
			options := fixtureOptions{"available": {}, "optional": {}}
			mgr, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) {
				if name == "optional" {
					optionalCalls++
					if !linked {
						return nil, tc.failure
					}
				} else {
					availableCalls++
				}
				return provider(name + "-owner"), nil
			}))
			require.NoError(t, err)
			defer mgr.CloseConversation("")
			actor := identity.VerifiedActor{Issuer: "fixture", Subject: "alice", TenantID: "team", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
			g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "aggregate")
			defer g.Close()
			source := &NativeSkillSource{Gateway: g}
			empty, _, err := source.CatalogScope(context.Background(), "skill-catalog", nil)
			require.NoError(t, err)
			require.Zero(t, availableCalls)
			require.Zero(t, optionalCalls, "an empty participant set must never expand to every connector")
			available, _, err := source.CatalogScope(context.Background(), "skill-catalog", []string{"available"})
			require.NoError(t, err)
			require.NotEqual(t, empty, available)
			require.Zero(t, optionalCalls, "unrelated connector credentials must not be inspected")
			partial, reusable, err := source.CatalogScope(context.Background(), "skill-catalog", []string{"optional", "available"})
			if !tc.skip {
				require.ErrorIs(t, err, tc.failure)
				return
			}
			require.NoError(t, err)
			require.False(t, reusable, "partial metadata must not cache across a credential-state change")
			_, err = source.Get(context.Background(), "skill-catalog", "optional")
			require.ErrorIs(t, err, missing, "explicit selected-provider use must still require credentials")
			linked = true
			current, reusable, err := source.CatalogScope(context.Background(), "skill-catalog", []string{"available", "optional"})
			require.NoError(t, err)
			require.True(t, reusable)
			require.NotEqual(t, partial, current, "newly linked participants must change the scope")
		})
	}
}
