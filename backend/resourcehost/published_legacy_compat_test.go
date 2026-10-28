package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
	"github.com/viant/jsonrpc/transport"
	"github.com/viant/mcp"
	protoclient "github.com/viant/mcp-protocol/client"
	"github.com/viant/mcp-protocol/logger"
	"github.com/viant/mcp-protocol/schema"
	protoserver "github.com/viant/mcp-protocol/server"
	mcpserver "github.com/viant/mcp/server"
)

func TestPublishedRegistrationPreservesOlderOrdinaryMCPToolsAndResources(t *testing.T) {
	var syncCalls atomic.Int64
	protocol, err := mcpserver.New(mcpserver.WithNewHandler(func(_ context.Context, notifier transport.Notifier, log logger.Logger, client protoclient.Operations) (protoserver.Handler, error) {
		handler := protoserver.NewDefaultHandler(notifier, log, client)
		handler.Registry.RegisterToolWithSchema("legacy/read", "Synthetic ordinary tool", schema.ToolInputSchema{Type: "object"}, nil, func(context.Context, *schema.CallToolRequest) (*schema.CallToolResult, *jsonrpc.Error) {
			return &schema.CallToolResult{Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: `{"value":"Example"}`}}}, nil
		})
		require.NoError(t, handler.Registry.RegisterResource(schema.Resource{Uri: "prompt://legacy/example", Name: "Example"}, func(context.Context, *schema.ReadResourceRequest) (*schema.ReadResourceResult, *jsonrpc.Error) {
			return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{{Uri: "prompt://legacy/example", Text: `{"text":"Example"}`}}}, nil
		}))
		return handler, nil
	}))
	require.NoError(t, err)
	protocol.UseStreamableHTTP(true)
	httpHandler := protocol.HTTP(context.Background(), "").Handler
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			raw, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			r.Body = io.NopCloser(bytes.NewReader(raw))
			var request struct {
				Method string
				Params struct{ Name string }
			}
			_ = json.Unmarshal(raw, &request)
			if request.Method == schema.MethodToolsCall && (request.Params.Name == "namespaces/get" || request.Params.Name == "artifact/discover" || request.Params.Name == "artifact/fetch") {
				syncCalls.Add(1)
			}
		}
		httpHandler.ServeHTTP(w, r)
	}))
	defer server.Close()
	pool, err := manager.New(fixtureOptions{"older": {ClientOptions: &mcp.ClientOptions{ProtocolVersion: schema.LegacyProtocolVersion, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}}}})
	require.NoError(t, err)
	defer pool.CloseConversation("")
	actor, verify := PublicReadActors()
	gateway := NewGateway(pool, actor, verify, "host")
	defer gateway.Close()
	source := &syntheticPublishedSource{states: map[string]primitive.ResourceState{}}
	require.NoError(t, gateway.RegisterPublishedMetadataSource(Connection{Name: "published", ProviderIdentity: "publisher"}, []string{"example"}, source))
	ctx := context.Background()
	client, err := pool.Get(ctx, "", "older")
	require.NoError(t, err)
	tool, err := client.CallTool(ctx, &schema.CallToolRequestParams{Name: "legacy/read", Arguments: map[string]any{}})
	require.NoError(t, err)
	require.NotEmpty(t, tool.Content)
	resources, err := client.ListResources(ctx, nil)
	require.NoError(t, err)
	require.Len(t, resources.Resources, 1)
	rows, err := gateway.List(ctx, "prompt", "legacy")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	got, err := gateway.Get(ctx, rows[0].Connection, identity.ResourceRef{URI: "prompt://legacy/example"}, nil)
	require.NoError(t, err)
	require.Equal(t, `{"text":"Example"}`, string(got.Resource.Definition))
	require.Equal(t, identity.WorkingCandidate, got.ResolvedResource.Kind)
	require.Zero(t, syncCalls.Load())
}
