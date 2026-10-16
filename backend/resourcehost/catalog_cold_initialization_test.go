package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	"github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func coldHTTPGateway(t *testing.T) (*Gateway, *localFixtureSource, fixtureOptions) {
	t.Helper()
	provider, source, actor, _ := localFixture(t)
	handler, err := NewMCPHandler(provider, func(next http.Handler) http.Handler { return next })
	require.NoError(t, err)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Empty(t, r.Header.Get("Authorization"))
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)
	options := fixtureOptions{"cold": {ClientOptions: &mcp.ClientOptions{ProtocolVersion: schema.LatestProtocolVersion, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}}}}
	mgr, err := manager.New(options)
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	t.Cleanup(gateway.Close)
	return gateway, source, options
}
func TestColdCatalogCapturesInitializedSharedOptions(t *testing.T) {
	g, _, options := coldHTTPGateway(t)
	cfg := options["cold"]
	require.Empty(t, cfg.Name)
	require.Empty(t, cfg.Version)
	before, err := json.Marshal(cfg)
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	page, err := ListPage[json.RawMessage](ctx, g, "window", CatalogQuery{}, true)
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	require.NotEmpty(t, cfg.Name)
	require.NotEmpty(t, cfg.Version)
	after, err := json.Marshal(cfg)
	require.NoError(t, err)
	require.NotEqual(t, before, after, "normal MCP Init changes shared options; capture after initialization")
	got, err := Get[json.RawMessage](ctx, g, page.Items[0].Connection, identity.ResourceRef{URI: page.Items[0].Resource.URI}, nil)
	require.NoError(t, err)
	require.NotEmpty(t, got.Definition)
	scope1, _, err := g.Manager.CatalogScope(ctx, "", []string{"cold"})
	require.NoError(t, err)
	scope2, _, err := g.Manager.CatalogScope(ctx, "", []string{"cold"})
	require.NoError(t, err)
	require.Equal(t, scope1, scope2)
}
func TestColdCatalogStillRejectsMidLoadConfigurationDrift(t *testing.T) {
	g, source, options := coldHTTPGateway(t)
	var changed atomic.Bool
	source.onRead = func() {
		if changed.CompareAndSwap(false, true) {
			options["cold"].PrimitiveNamespaces = []string{"team"}
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	page, err := ListPage[json.RawMessage](ctx, g, "window", CatalogQuery{}, true)
	require.ErrorIs(t, err, primitive.ErrCatalogCursor)
	require.Nil(t, page)
	require.True(t, changed.Load())
}
