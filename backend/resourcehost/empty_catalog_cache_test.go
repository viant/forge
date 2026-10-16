package resource

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

type emptyResourceCatalogClient struct {
	*fixtureProvider
	lists   atomic.Int64
	visible atomic.Bool
}

func (p *emptyResourceCatalogClient) Initialize(context.Context, ...mcpclient.RequestOption) (*schema.InitializeResult, error) {
	return &schema.InitializeResult{ProtocolVersion: schema.LatestProtocolVersion, Capabilities: schema.ServerCapabilities{Resources: &schema.ServerCapabilitiesResources{}}}, nil
}
func (p *emptyResourceCatalogClient) ListTools(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	return &schema.ListToolsResult{}, nil
}
func (p *emptyResourceCatalogClient) ListResources(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	p.lists.Add(1)
	out := &schema.ListResourcesResult{CacheScope: schema.ListResourcesResultCacheScopePrivate}
	if p.visible.Load() {
		out.Resources = []schema.Resource{{Uri: "window://ordinary/new", Name: "New window"}}
	}
	return out, nil
}
func TestEmptyStandardResourceCatalogRetainedUntilNotification(t *testing.T) {
	client := &emptyResourceCatalogClient{fixtureProvider: provider("ordinary")}
	mgr, err := manager.New(fixtureOptions{"ordinary": {}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return client, nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	actor, verify := PublicReadActors()
	gateway := NewGateway(mgr, actor, verify, "host")
	defer gateway.Close()
	for range 3 {
		rows, err := gateway.Discover(context.Background())
		require.NoError(t, err)
		require.Empty(t, rows)
	}
	require.EqualValues(t, 1, client.lists.Load(), "empty standard MCPs must not be polled for every window")
	client.visible.Store(true)
	client.resourceChanged()
	rows, err := gateway.Discover(context.Background())
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "ordinary", rows[0].Namespace)
	require.EqualValues(t, 2, client.lists.Load())
}
