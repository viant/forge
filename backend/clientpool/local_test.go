package manager

import (
	"context"
	"github.com/stretchr/testify/require"
	"github.com/viant/mcp"
	mcpclient "github.com/viant/mcp/client"
	mcpcfg "github.com/viant/mcp/client/config"
	"sync/atomic"
	"testing"
)

type localPoolClient struct{ mcpclient.Interface }

type localInventoryProvider struct{ names []string }

func (p *localInventoryProvider) Names(context.Context) ([]string, error) {
	return append([]string(nil), p.names...), nil
}
func (p *localInventoryProvider) Options(context.Context, string) (*mcpcfg.MCPClient, error) {
	return &mcpcfg.MCPClient{ClientOptions: &mcp.ClientOptions{}}, nil
}
func TestRegisterLocalReservesNameAndUsesOrdinaryPool(t *testing.T) {
	ctx := context.Background()
	external := &localInventoryProvider{names: []string{"external"}}
	manager, err := New(external)
	require.NoError(t, err)
	var count atomic.Int32
	factory := func(context.Context) (mcpclient.Interface, error) {
		count.Add(1)
		return &localPoolClient{}, nil
	}
	config := &mcpcfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "internal"}
	require.Error(t, manager.RegisterLocal(ctx, "external", config, factory))
	require.NoError(t, manager.RegisterLocal(ctx, "internal", config, factory))
	require.Error(t, manager.RegisterLocal(ctx, "internal", config, factory))
	config.PrimitiveProviderIdentity = "caller-mutation"
	options, err := manager.Options(ctx, "internal")
	require.NoError(t, err)
	require.Equal(t, "internal", options.PrimitiveProviderIdentity)
	require.Equal(t, mcpcfg.ToolsListVisibilityPrivate, options.ToolsListVisibility)
	options.PrimitiveProviderIdentity = "mutation"
	options, err = manager.Options(ctx, "internal")
	require.NoError(t, err)
	require.Equal(t, "internal", options.PrimitiveProviderIdentity)
	names, err := manager.Names(ctx)
	require.NoError(t, err)
	require.Equal(t, []string{"external", "internal"}, names)
	a, err := manager.Get(ctx, "same-conversation", "internal")
	require.NoError(t, err)
	b, err := manager.Get(ctx, "same-conversation", "internal")
	require.NoError(t, err)
	require.Same(t, a, b)
	require.EqualValues(t, 1, count.Load())
	external.names = append(external.names, "internal")
	_, err = manager.Names(ctx)
	require.Error(t, err)
	_, err = manager.Get(ctx, "same-conversation", "internal")
	require.Error(t, err)
	_, err = manager.Options(ctx, "internal")
	require.Error(t, err)
}
