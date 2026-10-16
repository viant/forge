package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

func TestLocalSnapshotReloadInvalidatesExistingSDKCatalogAfterPublication(t *testing.T) {
	for _, mode := range []string{"inprocess", "http"} {
		t.Run(mode, func(t *testing.T) { testSnapshotReloadNotification(t, mode) })
	}
}
func testSnapshotReloadNotification(t *testing.T, mode string) {
	ctx := context.Background()
	root := configuredSnapshotRoot(t)
	snapshot, err := NewNativeAssetSnapshot(ctx, root, []NativeSnapshotDefinition{configuredSnapshotDefinition()})
	require.NoError(t, err)
	actor, verify := PublicReadActors()
	bindings, err := snapshot.Bindings("native", func(_ context.Context, a identity.VerifiedActor, _ identity.ResourceURI, _ string) (identity.ResourceRevisionPolicy, error) {
		return authoredTestPolicy{a}, nil
	})
	require.NoError(t, err)
	p, err := NewLocalProvider(LocalConfig{ProviderIdentity: "native", Actor: actor, Verify: verify, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: bindings, Validators: map[string]LocalResourceValidator{"window": ValidateWindowBundle}})
	require.NoError(t, err)
	var mgr *manager.Manager
	options := &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "native", ResourceCacheScopes: map[string]string{"studio": "public"}}
	if mode == "http" {
		handler, e := NewLocalMCPHandler(p, func(h http.Handler) http.Handler { return h })
		require.NoError(t, e)
		server := httptest.NewServer(handler)
		defer server.Close()
		options.ClientOptions = &mcp.ClientOptions{Name: "reload-test", Version: "1", ProtocolVersion: "2025-11-25", Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}}
		mgr, err = manager.New(fixtureOptions{"native": options})
	} else {
		mgr, err = manager.New(nil)
		require.NoError(t, err)
		require.NoError(t, mgr.RegisterLocal(ctx, "native", options, func(context.Context) (mcpclient.Interface, error) { return NewLocalMCPClient(p) }))
	}
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	g := NewGateway(mgr, actor, verify, "consumer")
	defer g.Close()
	before, err := ListPage[json.RawMessage](ctx, g, "window", CatalogQuery{Namespace: "studio", Limit: 10}, true)
	require.NoError(t, err)
	require.Len(t, before.Items, 1)
	var events atomic.Int32
	stop := mgr.OnResourceCatalogChange(func(server string) {
		require.Equal(t, "native", server)
		current, err := snapshot.Candidates(ctx, identity.ResourceURI{Kind: "window", Namespace: "studio", Name: "overview"})
		require.NoError(t, err)
		require.NotEqual(t, before.Items[0].Resource.ContentFingerprint, current[0].ContentFingerprint)
		events.Add(1)
	})
	defer stop()
	file := filepath.Join(root, "window.json")
	raw, err := os.ReadFile(file)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(file, bytes.Replace(raw, []byte("Original"), []byte("Updated"), 1), 0600))
	require.NoError(t, snapshot.Reload(ctx))
	require.Eventually(t, func() bool { return events.Load() == 1 }, time.Second, time.Millisecond)
	after, err := ListPage[json.RawMessage](ctx, g, "window", CatalogQuery{Namespace: "studio", Limit: 10}, true)
	require.NoError(t, err)
	require.Len(t, after.Items, 1)
	require.Contains(t, string(after.Items[0].Definition), "Updated")
	require.NotEqual(t, before.Items[0].Resource.ContentFingerprint, after.Items[0].Resource.ContentFingerprint)
	require.NoError(t, os.WriteFile(file, []byte("invalid"), 0600))
	require.Error(t, snapshot.Reload(ctx))
	require.EqualValues(t, 1, events.Load())
	held, err := ListPage[json.RawMessage](ctx, g, "window", CatalogQuery{Namespace: "studio", Limit: 10}, true)
	require.NoError(t, err)
	require.Equal(t, after, held)
}
