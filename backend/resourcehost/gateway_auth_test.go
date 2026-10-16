package resource

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	authctx "github.com/viant/mcp/client/auth/link"
	transport "github.com/viant/mcp/client/auth/transport"
	cfg "github.com/viant/mcp/client/config"
)

func TestGatewayBindsCurrentConfiguredIDTokenForOrdinaryMCP(t *testing.T) {
	provider, _, actor, _ := localFixture(t)
	var mu sync.Mutex
	expected := "Bearer fixture-first"
	seen := map[string]int{}
	handler, err := NewMCPHandler(provider, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			accepted := r.Header.Get("Authorization") == expected
			if accepted {
				seen[expected]++
			}
			mu.Unlock()
			if !accepted {
				http.Error(w, "fixture credential required", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), localTestRequest{}, true)))
		})
	})
	require.NoError(t, err)
	server := httptest.NewServer(handler)
	defer server.Close()
	rt, err := transport.New(transport.WithTransport(http.DefaultTransport))
	require.NoError(t, err)
	bff := true
	options := fixtureOptions{"protected": &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{Name: "protected", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Auth: &mcp.ClientAuth{UseIdToken: true, BackendForFrontend: &bff}, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}}}}
	mgr, err := manager.New(options, manager.WithAuthRoundTripper(rt))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer gateway.Close()
	ctx, cancel := context.WithTimeout(authctx.WithIDToken(context.Background(), "fixture-first"), 5*time.Second)
	defer cancel()
	rows, err := gateway.List(ctx, "window", "team")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	mu.Lock()
	expected = "Bearer fixture-second"
	mu.Unlock()
	fresh, cancelFresh := context.WithTimeout(authctx.WithIDToken(context.Background(), "fixture-second"), 5*time.Second)
	defer cancelFresh()
	_, err = gateway.Get(fresh, rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, nil)
	require.NoError(t, err, "cached clients must bind the current request credential")
	mu.Lock()
	defer mu.Unlock()
	require.Positive(t, seen["Bearer fixture-first"])
	require.Positive(t, seen["Bearer fixture-second"])
}
