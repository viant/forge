package resource

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
)

type contractCacheClient struct {
	*fixtureProvider
	tools atomic.Int64
}

func (c *contractCacheClient) ListTools(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	c.tools.Add(1)
	return c.fixtureProvider.ListTools(ctx, cursor, options...)
}
func TestNamespaceContractCachePreservesDiscoveryAndFreshWorkingReads(t *testing.T) {
	provider := provider("owner")
	provider.definition = json.RawMessage(`{"synthetic":"original"}`)
	client := &contractCacheClient{fixtureProvider: provider}
	gateway, actor, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": provider})
	// Replace only the configured client factory with a counting standard interface.
	gateway.Manager.CloseConversation("")
	options := fixtureOptions{"remote": &cfg.MCPClient{PrimitiveProviderIdentity: "owner", ClientOptions: &mcp.ClientOptions{Name: "counting", Version: "1"}}}
	manager, err := newContractCacheManager(options, client)
	require.NoError(t, err)
	defer manager.CloseConversation("")
	original := gateway
	gateway = NewGateway(manager, original.Actor, original.Verify, original.GatewayProviderIdentity)
	original.Close()
	defer gateway.Close()
	ctx := authctx.WithBearer(context.Background(), "first-credential")
	first, err := gateway.Discover(ctx)
	require.NoError(t, err)
	require.Zero(t, client.tools.Load(), "trusted configured namespace owner should not fetch all tool schemas")
	connection := first[0].Connection
	initialList, initialDetail := provider.calls["namespaces/list"], provider.calls["namespaces/get"]
	for i := 0; i < 450; i++ {
		_, err = Get[json.RawMessage](ctx, gateway, connection, identity.ResourceRef{URI: "window://example/sales"}, nil)
		require.NoError(t, err)
	}
	require.Equal(t, 450, provider.calls["windows/get"], "working definitions are read freshly while namespace discovery stays warm")
	require.Equal(t, initialList, provider.calls["namespaces/list"])
	require.Equal(t, initialDetail, provider.calls["namespaces/get"])
	provider.resourceChanged()
	_, err = Get[json.RawMessage](ctx, gateway, connection, identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.NoError(t, err)
	require.Equal(t, 451, provider.calls["windows/get"], "a standard source event retains fresh owning reads")
	first[0].Kinds[0].Methods["get"] = "caller-mutated"
	_, err = Get[json.RawMessage](ctx, gateway, connection, identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.NoError(t, err, "exported namespace maps must not mutate cached dispatch metadata")
	rotated := authctx.WithBearer(ctx, "second-credential")
	_, err = Get[json.RawMessage](rotated, gateway, connection, identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.NoError(t, err)
	require.Greater(t, provider.calls["namespaces/get"], initialDetail, "credential rotation must select a different exact contract binding")
	beforeConfig := provider.calls["namespaces/get"]
	options["remote"].PrimitiveNamespaces = []string{"example"}
	_, err = Get[json.RawMessage](rotated, gateway, connection, identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.NoError(t, err)
	require.Greater(t, provider.calls["namespaces/get"], beforeConfig, "configuration changes must refresh the contract")
	beforeClient := provider.calls["namespaces/get"]
	_, err = manager.Reconnect(rotated, "", "remote")
	require.NoError(t, err)
	_, err = Get[json.RawMessage](rotated, gateway, connection, identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.Error(t, err, "reconnect must fence the old connection generation")
	updated, err := gateway.Discover(rotated)
	require.NoError(t, err)
	connection = updated[0].Connection
	_, err = Get[json.RawMessage](rotated, gateway, connection, identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.NoError(t, err)
	require.Greater(t, provider.calls["namespaces/get"], beforeClient, "replaced client identity must refresh the contract")
	actor.IdentityRevision = "changed"
	_, err = gateway.Discover(rotated)
	require.NoError(t, err)
	require.Zero(t, client.tools.Load())
}
func newContractCacheManager(options fixtureOptions, client mcpclient.Interface) (*manager.Manager, error) {
	return manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return client, nil }))
}
func TestNamespaceContractCacheUnconfiguredAndPartialProvidersKeepOrdinaryDiscovery(t *testing.T) {
	p := provider("owner")
	p.definition = json.RawMessage(`{"synthetic":"original"}`)
	client := &contractCacheClient{fixtureProvider: p}
	options := fixtureOptions{"remote": &cfg.MCPClient{}}
	manager, err := newContractCacheManager(options, client)
	require.NoError(t, err)
	defer manager.CloseConversation("")
	gateway, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"unused": p})
	original := gateway
	gateway = NewGateway(manager, original.Actor, original.Verify, original.GatewayProviderIdentity)
	original.Close()
	defer gateway.Close()
	namespaces, err := gateway.Discover(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 1, client.tools.Load(), "unconfigured providers retain standard tool discovery")
	require.Len(t, namespaces[0].Kinds, 1)
	require.Equal(t, "window", namespaces[0].Kinds[0].Kind)
	_, err = Get[json.RawMessage](context.Background(), gateway, namespaces[0].Connection, identity.ResourceRef{URI: "report://example/unsupported"}, nil)
	require.Error(t, err)
	require.Zero(t, p.calls["reports/get"], "partial kind support must not become fabricated capability")
	_, err = gateway.Discover(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 1, client.tools.Load())
}
