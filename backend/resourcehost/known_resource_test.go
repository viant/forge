package resource

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type directReadClient struct {
	*filteredIndexClient
	denied bool
}

func (c *directReadClient) CallTool(context.Context, *schema.CallToolRequestParams, ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	c.t.Fatal("exact resource read must not enumerate namespaces")
	return nil, nil
}
func (c *directReadClient) ListTools(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	c.t.Fatal("exact resource read must not enumerate tools")
	return nil, nil
}
func (c *directReadClient) ListResourcesWithRequest(context.Context, *schema.ListResourcesRequestParams, ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	c.t.Fatal("exact resource read must not enumerate resources")
	return nil, nil
}
func (c *directReadClient) ReadResource(ctx context.Context, r *schema.ReadResourceRequestParams, opts ...mcpclient.RequestOption) (*schema.ReadResourceResult, error) {
	if c.denied {
		c.reads++
		return nil, errors.New("provider denied resource")
	}
	return c.filteredIndexClient.ReadResource(ctx, r, opts...)
}
func TestKnownResourceReadUsesPoolAndDefinitionCacheWithoutCatalog(t *testing.T) {
	for _, denied := range []bool{false, true} {
		t.Run(map[bool]string{false: "cached read", true: "provider denial"}[denied], func(t *testing.T) {
			client := &directReadClient{filteredIndexClient: &filteredIndexClient{t: t}, denied: denied}
			mgr, err := manager.New(nil)
			require.NoError(t, err)
			require.NoError(t, mgr.RegisterLocal(context.Background(), "studio", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "producer", ResourceCacheScopes: map[string]string{"*": cfg.ResourceCachePublic}}, func(context.Context) (mcpclient.Interface, error) { return client, nil }))
			defer mgr.CloseConversation("")
			actor, verify := PublicReadActors()
			g := NewGateway(mgr, actor, verify, "consumer")
			defer g.Close()
			uri, err := identity.ParseResourceURI("window://remote/orders")
			require.NoError(t, err)
			connection, err := g.ConnectionForResource(context.Background(), uri, "producer")
			require.NoError(t, err)
			for i := 0; i < 2; i++ {
				got, err := g.Get(context.Background(), connection, identity.ResourceRef{URI: uri.String()}, nil)
				if denied {
					require.ErrorContains(t, err, "provider denied")
					require.Nil(t, got)
				} else {
					require.NoError(t, err)
					require.Equal(t, uri.String(), got.Resource.URI)
				}
			}
			if denied {
				require.Equal(t, 2, client.reads)
			} else {
				require.Equal(t, 1, client.reads, "reuse existing scoped definition cache")
			}
		})
	}
}
