package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	namespaces "github.com/viant/mcp-protocol/extension/namespaces"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type filteredIndexClient struct {
	mcpclient.Interface
	t                                     *testing.T
	lists, reads, namespaceGets, toolGets int
	repeatCursor                          bool
}

func (c *filteredIndexClient) Initialize(context.Context, ...mcpclient.RequestOption) (*schema.InitializeResult, error) {
	return &schema.InitializeResult{Capabilities: schema.ServerCapabilities{Resources: &schema.ServerCapabilitiesResources{}, Extensions: map[string]map[string]interface{}{resourceFilterExtension: {"schemaVersion": 1, "fields": []string{"namespace", "kind", "query", "limit"}, "pagination": "cursor"}}}}, nil
}
func (c *filteredIndexClient) ListTools(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	return &schema.ListToolsResult{Tools: []schema.Tool{{Name: "namespaces/list"}, {Name: "resource/get"}}}, nil
}
func (c *filteredIndexClient) CallTool(_ context.Context, r *schema.CallToolRequestParams, _ ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if r.Name == "namespaces/get" {
		c.namespaceGets++
		c.t.Fatal("namespace details must not be requested")
	}
	if r.Name == "resource/get" {
		c.toolGets++
		c.t.Fatal("standard read must be preferred")
	}
	require.Equal(c.t, "namespaces/list", r.Name)
	return &schema.CallToolResult{StructuredContent: map[string]any{"namespaces": []any{map[string]any{"uri": "ns://opaque_collection", "name": "Display name only"}}}}, nil
}
func (c *filteredIndexClient) ListResourcesWithParams(_ context.Context, r *schema.ListResourcesRequestParams, _ ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	c.lists++
	raw, err := json.Marshal(r.Meta)
	require.NoError(c.t, err)
	var meta map[string]any
	require.NoError(c.t, json.Unmarshal(raw, &meta))
	filter := meta[resourceFilterExtension].(map[string]any)
	require.Equal(c.t, "ns://opaque_collection", filter["namespace"])
	require.EqualValues(c.t, 100, filter["limit"])
	if c.repeatCursor {
		next := "repeat"
		return &schema.ListResourcesResult{NextCursor: &next}, nil
	}
	return &schema.ListResourcesResult{Resources: []schema.Resource{{Uri: "window://remote/orders", Name: "Orders"}}}, nil
}
func (c *filteredIndexClient) ReadResource(_ context.Context, r *schema.ReadResourceRequestParams, _ ...mcpclient.RequestOption) (*schema.ReadResourceResult, error) {
	c.reads++
	require.Equal(c.t, "window://remote/orders", r.Uri)
	return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{{Uri: r.Uri, Text: `{"title":"Orders","view":{"content":{"id":"orders","text":"Orders"}},"dataSource":{}}`}}}, nil
}
func TestFilteredNamespaceDiscoveryDoesNotNeedNamespaceGet(t *testing.T) {
	client := &filteredIndexClient{t: t}
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(context.Background(), "filtered", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "producer"}, func(context.Context) (mcpclient.Interface, error) { return client, nil }))
	defer mgr.CloseConversation("")
	actor, verify := PublicReadActors()
	gateway := NewGateway(mgr, actor, verify, "consumer")
	defer gateway.Close()
	rows, err := gateway.List(context.Background(), "window", "remote")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Zero(t, client.namespaceGets)
	require.Zero(t, client.reads)
	got, err := gateway.Get(context.Background(), rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, nil)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Positive(t, client.reads)
	require.Zero(t, client.toolGets)
}
func TestFilteredNamespaceRejectsRepeatedCursor(t *testing.T) {
	client := &filteredIndexClient{t: t, repeatCursor: true}
	g := &Gateway{}
	err := g.readFilteredNamespaceIndex(context.Background(), client, namespaces.Namespace{URI: "ns://opaque_collection", Name: "Display"}, map[string]primitive.ResourceState{})
	require.ErrorIs(t, err, identity.ErrResource)
}

func TestFilterCapabilityRequiresActualMetadataTransport(t *testing.T) {
	client := &filteredIndexClient{t: t}
	wrapped := &gatewayAuthClient{Interface: struct{ mcpclient.Interface }{client}}
	require.False(t, resourceFiltersSupported(context.Background(), wrapped), "older transports must keep the working legacy path")
}
