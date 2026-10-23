package resource

import (
	"context"

	"github.com/viant/forge/backend/clientpool"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

// gatewayAuthClient binds each operation's current credential. The underlying
// manager client may be cached, but this wrapper never retains a request token.
type gatewayAuthClient struct {
	mcpclient.Interface
	manager *manager.Manager
	name    string
}

func (c *gatewayAuthClient) Initialize(ctx context.Context, options ...mcpclient.RequestOption) (*schema.InitializeResult, error) {
	return c.Interface.Initialize(c.manager.WithAuthTokenContext(ctx, c.name), options...)
}

func (c *gatewayAuthClient) NegotiatedServer() (*schema.InitializeResult, error) {
	negotiated, ok := c.Interface.(interface {
		NegotiatedServer() (*schema.InitializeResult, error)
	})
	if !ok {
		return nil, ErrUnavailable
	}
	return negotiated.NegotiatedServer()
}

func (c *gatewayAuthClient) ListTools(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	return c.Interface.ListTools(c.manager.WithAuthTokenContext(ctx, c.name), cursor, options...)
}

func (c *gatewayAuthClient) Discover(ctx context.Context, options ...mcpclient.RequestOption) (*schema.DiscoverResult, error) {
	discovery, ok := c.Interface.(mcpclient.DiscoveryInterface)
	if !ok {
		return nil, ErrUnavailable
	}
	return discovery.Discover(c.manager.WithAuthTokenContext(ctx, c.name), options...)
}

func (c *gatewayAuthClient) ListResources(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	return c.Interface.ListResources(c.manager.WithAuthTokenContext(ctx, c.name), cursor, options...)
}

func (c *gatewayAuthClient) ReadResource(ctx context.Context, params *schema.ReadResourceRequestParams, options ...mcpclient.RequestOption) (*schema.ReadResourceResult, error) {
	return c.Interface.ReadResource(c.manager.WithAuthTokenContext(ctx, c.name), params, options...)
}

func (c *gatewayAuthClient) CallTool(ctx context.Context, params *schema.CallToolRequestParams, options ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	return c.Interface.CallTool(c.manager.WithAuthTokenContext(ctx, c.name), params, options...)
}

func (c *gatewayAuthClient) ListResourcesWithParams(ctx context.Context, params *schema.ListResourcesRequestParams, options ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	filtered, ok := c.Interface.(filteredResourceClient)
	if !ok {
		return nil, ErrUnavailable
	}
	return filtered.ListResourcesWithParams(c.manager.WithAuthTokenContext(ctx, c.name), params, options...)
}

func (c *gatewayAuthClient) ResourceListParamsSupported(ctx context.Context) bool {
	if capability, ok := c.Interface.(interface{ ResourceListParamsSupported(context.Context) bool }); ok {
		return capability.ResourceListParamsSupported(ctx)
	}
	_, ok := c.Interface.(filteredResourceClient)
	return ok
}
