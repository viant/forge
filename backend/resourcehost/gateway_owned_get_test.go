package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

func TestOwnerBoundGetCachesDefinitionsAndRetainsTerminalChecks(t *testing.T) {
	for _, failure := range []string{"none", "content", "revocation", "identity", "generation", "expiry", "owner", "collision"} {
		t.Run(failure, func(t *testing.T) {
			p := provider("owned")
			options := fixtureOptions{"remote": &cfg.MCPClient{PrimitiveProviderIdentity: "owned"}}
			mgr, err := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return p, nil }))
			require.NoError(t, err)
			t.Cleanup(func() { mgr.CloseConversation("") })
			actor := identity.VerifiedActor{Subject: "alice", Issuer: "issuer", TenantID: "tenant", AccountID: "21", IdentityRevision: "initial", ValidUntil: time.Now().Add(time.Minute)}
			revoked := false
			g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(_ context.Context, held identity.VerifiedActor) error {
				if revoked || held != actor {
					return identity.ErrResourceDenied
				}
				return nil
			}, "gateway")
			t.Cleanup(g.Close)
			ref := identity.ResourceRef{URI: "window://example/sales"}
			opened, err := g.GetForProvider(context.Background(), "owned", ref, nil)
			require.NoError(t, err)
			require.Equal(t, 1, p.calls["namespaces/list"])
			require.Equal(t, 1, p.calls["namespaces/get"])
			pin := *opened.ResolvedResource
			switch failure {
			case "content":
				p.definition = []byte(`{"changed":true}`)
			case "revocation":
				p.after = func(method string) {
					if method == "windows/get" {
						revoked = true
					}
				}
			case "identity":
				p.after = func(method string) {
					if method == "windows/get" {
						actor.IdentityRevision = "changed"
					}
				}
			case "generation":
				p.after = func(method string) {
					if method == "windows/get" {
						g.Invalidate("remote")
					}
				}
			case "expiry":
				pin.ValidUntil = time.Now().Add(-time.Second)
			case "owner":
				p.owner = "replacement"
			case "collision":
				options["duplicate"] = &cfg.MCPClient{PrimitiveProviderIdentity: "owned"}
			}
			if failure != "none" && failure != "expiry" && failure != "collision" {
				p.resourceChanged()
			}
			got, err := g.GetForProvider(context.Background(), "owned", ref, &pin)
			if failure == "none" {
				require.NoError(t, err)
				require.NotNil(t, got)
				require.Equal(t, 1, p.calls["namespaces/list"], "unchanged namespace metadata must not repeat authority roundtrips")
				require.Equal(t, 1, p.calls["namespaces/get"])
				require.Equal(t, 2, p.calls["windows/get"], "a new pinned working read reaches its owner")
			} else {
				require.Error(t, err)
				require.Nil(t, got)
			}
		})
	}
}
