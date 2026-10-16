package resource

import (
	"context"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	protocol "github.com/viant/mcp-protocol/server"
	authctx "github.com/viant/mcp/client/auth/link"
	transport "github.com/viant/mcp/client/auth/transport"
	cfg "github.com/viant/mcp/client/config"
	mcpserver "github.com/viant/mcp/server"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestHostedNativeResourceReadBindsCurrentCredentialOnCachedClient(t *testing.T) {
	var mu sync.Mutex
	expected := "Bearer fixture-first"
	seen := map[string]int{}
	rejected := 0
	factory := protocol.WithDefaultHandler(context.Background(), func(handler *protocol.DefaultHandler) error {
		handler.RegisterResource(schema.Resource{Name: "compiled-entry", Uri: "ui://owned/compiled-entry"}, func(context.Context, *schema.ReadResourceRequest) (*schema.ReadResourceResult, *jsonrpc.Error) {
			mime := "text/html;profile=mcp-app"
			return &schema.ReadResourceResult{ResultType: schema.ResultTypeComplete, CacheScope: schema.ReadResourceResultCacheScopePrivate, Contents: []schema.ReadResourceResultContentsElem{{Uri: "ui://owned/compiled-entry", MimeType: &mime, Text: "<main>Owned compiled resource</main>"}}}, nil
		})
		return nil
	})
	endpoint, err := mcpserver.New(mcpserver.WithNewHandler(factory), mcpserver.WithStreamableURI("/mcp"), mcpserver.WithRootRedirect(false))
	require.NoError(t, err)
	endpoint.UseStreamableHTTP(true)
	nativeHandler := endpoint.HTTP(context.Background(), "").Handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		accepted := r.Header.Get("Authorization") == expected
		if accepted {
			seen[expected]++
		} else {
			rejected++
		}
		mu.Unlock()
		if !accepted {
			http.Error(w, "current fixture credential required", 401)
			return
		}
		nativeHandler.ServeHTTP(w, r)
	})
	server := httptest.NewServer(handler)
	defer server.Close()
	roundTripper, err := transport.New(transport.WithTransport(http.DefaultTransport))
	require.NoError(t, err)
	bff := true
	options := fixtureOptions{"owned": &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{Name: "owned", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Auth: &mcp.ClientAuth{UseIdToken: true, BackendForFrontend: &bff}, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}}}}
	mgr, err := manager.New(options, manager.WithAuthRoundTripper(roundTripper))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	first, cancel := context.WithTimeout(authctx.WithIDToken(context.Background(), "fixture-first"), 5*time.Second)
	client, err := mgr.Get(mgr.WithAuthTokenContext(first, "owned"), "", "owned")
	require.NoError(t, err)
	_, err = client.ReadResource(mgr.WithAuthTokenContext(first, "owned"), &schema.ReadResourceRequestParams{Uri: "ui://owned/compiled-entry"})
	require.NoError(t, err)
	cancel()
	mu.Lock()
	expected = "Bearer fixture-second"
	mu.Unlock()
	second, finish := context.WithTimeout(authctx.WithIDToken(context.Background(), "fixture-second"), 5*time.Second)
	defer finish()
	cached, err := mgr.Get(mgr.WithAuthTokenContext(second, "owned"), "", "owned")
	require.NoError(t, err)
	_, err = cached.ReadResource(mgr.WithAuthTokenContext(second, "owned"), &schema.ReadResourceRequestParams{Uri: "ui://owned/compiled-entry"})
	require.NoError(t, err, "resource dispatch must not capture the first request's credential or canceled context")
	stale, staleCancel := context.WithTimeout(authctx.WithIDToken(context.Background(), "fixture-first"), 5*time.Second)
	defer staleCancel()
	_, err = cached.ReadResource(mgr.WithAuthTokenContext(stale, "owned"), &schema.ReadResourceRequestParams{Uri: "ui://owned/compiled-entry"})
	require.Error(t, err, "stale credentials must be rejected by the protected resource endpoint")
	mu.Lock()
	defer mu.Unlock()
	require.Positive(t, rejected)
	require.Positive(t, seen["Bearer fixture-first"])
	require.Positive(t, seen["Bearer fixture-second"])
}
