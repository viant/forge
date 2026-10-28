package resource

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	"github.com/viant/jsonrpc"
	"github.com/viant/jsonrpc/transport"
	"github.com/viant/mcp"
	protoclient "github.com/viant/mcp-protocol/client"
	"github.com/viant/mcp-protocol/logger"
	"github.com/viant/mcp-protocol/schema"
	protoserver "github.com/viant/mcp-protocol/server"
	mcpserver "github.com/viant/mcp/server"
)

func TestModernNamespaceSyncAdvertisementOverMCPPreservesStrictDecoding(t *testing.T) {
	var mutation atomic.Int32
	opaque := "ns://" + strings.Repeat("a", 64)
	protocol, err := mcpserver.New(mcpserver.WithNewHandler(func(_ context.Context, notifier transport.Notifier, log logger.Logger, client protoclient.Operations) (protoserver.Handler, error) {
		handler := protoserver.NewDefaultHandler(notifier, log, client)
		register := func(name string, run func(*schema.CallToolRequest) any) {
			handler.Registry.RegisterToolWithSchema(name, "Synthetic namespace contract", schema.ToolInputSchema{Type: "object"}, nil, func(_ context.Context, request *schema.CallToolRequest) (*schema.CallToolResult, *jsonrpc.Error) {
				raw, _ := json.Marshal(run(request))
				return &schema.CallToolResult{Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: string(raw)}}}, nil
			})
		}
		register("namespaces/list", func(*schema.CallToolRequest) any {
			advert := map[string]any{"version": 1, "method": "namespaces/get", "fetchMethod": "artifact/fetch"}
			entry := map[string]any{"uri": opaque, "name": "example", "synchronization": advert}
			result := map[string]any{"namespaces": []any{entry}}
			switch mutation.Load() {
			case 1:
				entry["unknown"] = true
			case 2:
				result["unknown"] = true
			case 3:
				advert["unknown"] = true
			}
			return result
		})
		register("namespaces/get", func(request *schema.CallToolRequest) any {
			require.Equal(t, opaque, request.Params.Arguments["uri"])
			return map[string]any{"namespace": map[string]any{"uri": opaque, "name": "example"}, "resources": []any{map[string]any{"uri": "window://example/overview", "kind": "window", "name": "Example"}}}
		})
		return handler, nil
	}))
	require.NoError(t, err)
	protocol.UseStreamableHTTP(true)
	server := httptest.NewServer(protocol.HTTP(context.Background(), "").Handler)
	defer server.Close()
	options := fixtureOptions{"catalog": {ClientOptions: &mcp.ClientOptions{ProtocolVersion: schema.LatestProtocolVersion, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}}, PrimitiveProviderIdentity: "producer"}}
	pool, err := manager.New(options)
	require.NoError(t, err)
	defer pool.CloseConversation("")
	actor, verify := PublicReadActors()
	gateway := NewGateway(pool, actor, verify, "host")
	defer gateway.Close()
	// This uses actual MCP transport and the modern collection decoder, rather
	// than invoking the synchronization helper or relaxing its JSON decoder.
	namespaces, err := gateway.Discover(context.Background())
	require.NoError(t, err)
	require.Len(t, namespaces, 1)
	require.Equal(t, "example", namespaces[0].Namespace)
	for _, invalid := range []int32{1, 2, 3} {
		mutation.Store(invalid)
		gateway.Invalidate("catalog")
		_, err = gateway.Discover(context.Background())
		require.Error(t, err, "unknown field at level %d must remain rejected", invalid)
	}
}
