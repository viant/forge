package artifactcohort

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	protocol "github.com/viant/mcp-protocol/server"
	mcpclient "github.com/viant/mcp/client"
	mcpserver "github.com/viant/mcp/server"
)

type menuTransportOrigin struct {
	*fakeCaller
	MCPCaller
}

// Discovery and immutable fetch use the independent synthetic publisher;
// request-scoped menu execution uses the protected native MCP transport.
func (c menuTransportOrigin) Discover(ctx context.Context) (Manifest, error) {
	return c.fakeCaller.Discover(ctx)
}
func (c menuTransportOrigin) Fetch(ctx context.Context, input FetchInput) (*Artifact, error) {
	return c.fakeCaller.Fetch(ctx, input)
}

// Independently authored public fixtures. The producer owns the authorization
// decision; its error body is deliberately never interpreted by the consumer.
func TestProtectedOriginMenuDenialRetainsMetadataStatus(t *testing.T) {
	ctx := actorContext("synthetic-reader", "operator")
	publisher := NewPublisher()
	artifact, _, err := publisher.Publish(ctx, RootRef{URI: "navigation://example/path/main", Kind: "navigation", Version: 7}, json.RawMessage(`{"schemaVersion":1,"source":{"dataSourceRef":{"resource":{"uri":"datasource://example/rows"},"providerIdentity":"origin"}},"applications":[]}`), allowPublished)
	require.NoError(t, err)
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{artifact.Root}
	_, err = publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation())
	require.NoError(t, err)
	type authenticatedActor struct{}
	var authorizations atomic.Int32
	server, err := mcpserver.New(mcpserver.WithStreamableURI("/mcp"), mcpserver.WithRootRedirect(false), mcpserver.WithNewHandler(protocol.WithDefaultHandler(ctx, func(h *protocol.DefaultHandler) error {
		return protocol.RegisterTool[*primitive.GetRequest, *primitive.GetResult](h.Registry, "resources/get", "Read an authorized synthetic menu", func(requestCtx context.Context, input *primitive.GetRequest) (*schema.CallToolResult, *jsonrpc.Error) {
			if requestCtx.Value(authenticatedActor{}) != "synthetic-reader" || input.URI != artifact.Root.URI || input.Revision != "7" {
				return nil, jsonrpc.NewInvalidParamsError("synthetic identity or resource mismatch", nil)
			}
			authorizations.Add(1)
			failed := true
			return &schema.CallToolResult{IsError: &failed, Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: `{"code":"forbidden","status":403,"message":"synthetic producer detail"}`}}}, nil
		})
	})))
	require.NoError(t, err)
	server.UseStreamableHTTP(true)
	native := server.HTTP(ctx, "").Handler
	protected := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		native.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), authenticatedActor{}, "synthetic-reader")))
	}))
	defer protected.Close()
	client, err := mcp.NewClient(nil, &mcp.ClientOptions{Name: "synthetic-menu-consumer", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: protected.URL + "/mcp"}}})
	require.NoError(t, err)
	_, err = client.Initialize(ctx)
	require.NoError(t, err)
	response, err := client.CallTool(ctx, &schema.CallToolRequestParams{Name: "resources/get", Arguments: map[string]any{"uri": artifact.Root.URI, "revision": "7"}}, mcpclient.WithNoRetry())
	require.NoError(t, err)
	require.NotNil(t, response.IsError)
	require.True(t, *response.IsError, "the native producer denies before consumer decoding")

	origin := menuTransportOrigin{fakeCaller: &fakeCaller{publisher: publisher, fetches: map[string]int{}}, MCPCaller: MCPCaller{Client: client}}
	replica, err := NewReplica(Config{Enabled: true, Source: "origin", Tenant: "tenant", Account: "account", Caller: origin, Facts: &countedFacts{}, SessionKey: fixtureSession})
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	source, err := NewMetadataSource(replica, []string{"example"})
	require.NoError(t, err)
	for i := 0; i < 2; i++ {
		result, err := source.GetMenu(ctx, artifact.Root.URI)
		require.Nil(t, result)
		require.ErrorIs(t, err, ErrDenied)
		var status interface{ HTTPStatusCode() int }
		require.ErrorAs(t, err, &status)
		require.Equal(t, http.StatusForbidden, status.HTTPStatusCode())
		require.NotContains(t, err.Error(), "synthetic producer detail")
	}
	require.EqualValues(t, 3, authorizations.Load(), "every menu pull must ask the producer again")
}
