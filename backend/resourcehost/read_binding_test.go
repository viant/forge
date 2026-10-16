package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
)

type changingReadCredential struct {
	context.Context
	changed bool
}

func (c *changingReadCredential) Value(key any) any {
	value := c.Context.Value(key)
	if c.changed && value == "initial-credential" {
		return "changed-credential"
	}
	return value
}

func TestReadBindingRejectsMidInvocationDriftBeforeRPCAndAfterRead(t *testing.T) {
	for _, boundary := range []string{"before-rpc", "after-read"} {
		for _, change := range []string{"credential", "options", "session", "generation"} {
			t.Run(boundary+"/"+change, func(t *testing.T) {
				g, provider, _, options := readSequenceFixture(t)
				credentials := &changingReadCredential{Context: authctx.WithIDToken(context.Background(), "initial-credential")}
				ctx, finish, err := g.BeginReadSequence(credentials, nil)
				require.NoError(t, err)
				hook := "namespaces/get"
				if boundary == "after-read" {
					hook = "windows/get"
				}
				provider.after = func(method string) {
					if method != hook {
						return
					}
					provider.after = nil
					switch change {
					case "credential":
						credentials.changed = true
					case "options":
						options["remote"].PrimitiveProviderIdentity = "foreign-owner"
					case "generation":
						g.Invalidate("remote")
					case "session":
						replacement := &mutableNamespaceFixture{fixtureProvider: providerFixtureForBinding()}
						mgr, err := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return replacement, nil }))
						require.NoError(t, err)
						t.Cleanup(func() { mgr.CloseConversation("") })
						g.Manager = mgr
					}
				}
				result, err := g.Get(ctx, Connection{Name: "remote", ProviderIdentity: "owned"}, identity.ResourceRef{URI: "window://example/sales"}, nil)
				require.Error(t, err)
				require.Nil(t, result)
				if boundary == "before-rpc" {
					require.Zero(t, provider.calls["windows/get"], "binding drift must stop the resource RPC")
				} else {
					require.Equal(t, 1, provider.calls["windows/get"])
				}
				require.Error(t, finish())
			})
		}
	}
}
func providerFixtureForBinding() *fixtureProvider { return provider("owned") }

func TestReadBindingPreservesDetachedOpaqueNumericClientOptions(t *testing.T) {
	g, _, actor, options := readSequenceFixture(t)
	options["remote"].Metadata = map[string]interface{}{"opaque-setting": json.Number("9007199254740993")}
	held, err := g.resolveReadBinding(context.Background(), *actor, "remote")
	require.NoError(t, err)
	require.Equal(t, json.Number("9007199254740993"), held.options.Metadata["opaque-setting"])
	require.NoError(t, g.checkReadBinding(context.Background(), *actor, held))
	options["remote"].Metadata["opaque-setting"] = json.Number("9007199254740994")
	require.Equal(t, json.Number("9007199254740993"), held.options.Metadata["opaque-setting"], "provider mutation cannot alter the original invocation snapshot")
	require.Error(t, g.checkReadBinding(context.Background(), *actor, held))
}
