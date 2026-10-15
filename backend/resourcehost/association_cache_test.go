package resource

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	schema "github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type blockingCatalogClient struct {
	*fixtureProvider
	listCalls atomic.Int32
	entered   chan struct{}
	release   chan struct{}
}

func (c *blockingCatalogClient) ListTools(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	if c.listCalls.Add(1) == 1 {
		close(c.entered)
		select {
		case <-c.release:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return c.fixtureProvider.ListTools(ctx, cursor, options...)
}

func TestRemoteCatalogDoesNotRediscoverForDifferentReadAssociations(t *testing.T) {
	upstream := provider("studio")
	gateway, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": upstream})
	defer gateway.Close()
	first, err := requestctx.WithResourceReadAssociation(context.Background(), &identity.ResolvedResource{URI: "window://example/first"}, nil)
	require.NoError(t, err)
	second, err := requestctx.WithResourceReadAssociation(context.Background(), &identity.ResolvedResource{URI: "window://example/second"}, nil)
	require.NoError(t, err)
	for _, ctx := range []context.Context{first, second} {
		rows, listErr := gateway.List(ctx, "window", "example")
		require.NoError(t, listErr)
		require.Len(t, rows, 1)
	}
	require.Equal(t, 1, upstream.calls["namespaces/list"], "read associations must not rebuild the remote capability catalog")
}

func TestLocalCatalogRetainsReadAssociationIsolation(t *testing.T) {
	upstream := provider("studio")
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(context.Background(), "local", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "studio"}, func(context.Context) (mcpclient.Interface, error) {
		return upstream, nil
	}))
	t.Cleanup(func() { mgr.CloseConversation("") })
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://idp.example", TenantID: "example", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "consumer")
	t.Cleanup(gateway.Close)
	for _, name := range []string{"first", "second"} {
		ctx, associationErr := requestctx.WithResourceReadAssociation(context.Background(), &identity.ResolvedResource{URI: "window://example/" + name}, nil)
		require.NoError(t, associationErr)
		rows, listErr := gateway.List(ctx, "window", "example")
		require.NoError(t, listErr)
		require.Len(t, rows, 1)
	}
	require.Equal(t, 2, upstream.calls["namespaces/list"], "in-process providers may inspect the target association")
}

func TestColdRemoteCatalogCoalescesConcurrentReadAssociations(t *testing.T) {
	upstream := &blockingCatalogClient{fixtureProvider: provider("studio"), entered: make(chan struct{}), release: make(chan struct{})}
	mgr, err := manager.New(fixtureOptions{"remote": &cfg.MCPClient{}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) {
		return upstream, nil
	}))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://idp.example", TenantID: "example", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "consumer")
	t.Cleanup(gateway.Close)
	const readers = 8
	start := make(chan struct{})
	results := make(chan error, readers)
	for i := 0; i < readers; i++ {
		ctx, associationErr := requestctx.WithResourceReadAssociation(context.Background(), &identity.ResolvedResource{URI: fmt.Sprintf("window://example/parent-%d", i)}, nil)
		require.NoError(t, associationErr)
		go func(ctx context.Context) {
			<-start
			rows, listErr := gateway.List(ctx, "window", "example")
			if listErr == nil && len(rows) != 1 {
				listErr = identity.ErrResource
			}
			results <- listErr
		}(ctx)
	}
	close(start)
	select {
	case <-upstream.entered:
	case <-time.After(5 * time.Second):
		t.Fatal("catalog discovery did not start")
	}
	time.Sleep(20 * time.Millisecond)
	close(upstream.release)
	for i := 0; i < readers; i++ {
		require.NoError(t, <-results)
	}
	require.EqualValues(t, 1, upstream.listCalls.Load(), "cold concurrent reads must share one tools/list")
	require.Equal(t, 1, upstream.calls["namespaces/list"], "cold concurrent reads must share one namespace discovery")
}

func TestColdRemoteCatalogRetriesAfterLeaderCancellation(t *testing.T) {
	upstream := &blockingCatalogClient{fixtureProvider: provider("studio"), entered: make(chan struct{}), release: make(chan struct{})}
	mgr, err := manager.New(fixtureOptions{"remote": &cfg.MCPClient{}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) {
		return upstream, nil
	}))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://idp.example", TenantID: "example", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "consumer")
	t.Cleanup(gateway.Close)
	base, cancel := context.WithCancel(context.Background())
	defer cancel()
	leader, err := requestctx.WithResourceReadAssociation(base, &identity.ResolvedResource{URI: "window://example/leader"}, nil)
	require.NoError(t, err)
	follower, err := requestctx.WithResourceReadAssociation(context.Background(), &identity.ResolvedResource{URI: "window://example/follower"}, nil)
	require.NoError(t, err)
	leaderResult := make(chan error, 1)
	followerResult := make(chan error, 1)
	go func() { _, listErr := gateway.List(leader, "window", "example"); leaderResult <- listErr }()
	select {
	case <-upstream.entered:
	case <-time.After(5 * time.Second):
		t.Fatal("leader discovery did not start")
	}
	go func() { _, listErr := gateway.List(follower, "window", "example"); followerResult <- listErr }()
	time.Sleep(20 * time.Millisecond)
	cancel()
	require.ErrorIs(t, <-leaderResult, context.Canceled)
	require.NoError(t, <-followerResult, "a canceled request cannot poison an independent reader")
	require.EqualValues(t, 2, upstream.listCalls.Load())
}
