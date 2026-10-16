package resource

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type routingDiscoveryClient struct {
	*optionalPrimitiveClient
	started chan<- string
	release <-chan struct{}
	name    string
}

func (p *routingDiscoveryClient) ListTools(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	p.started <- p.name
	select {
	case <-p.release:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return p.optionalPrimitiveClient.ListTools(ctx, cursor, options...)
}

func TestWindowRoutingUsesBoundedDiscoveryAndWarmCapabilityCache(t *testing.T) {
	started := make(chan string, 10)
	release := make(chan struct{})
	released := false
	defer func() {
		if !released {
			close(release)
		}
	}()
	options := fixtureOptions{}
	clients := map[string]*routingDiscoveryClient{}
	for i := 0; i < 5; i++ {
		name := fmt.Sprintf("provider-%d", i)
		options[name] = &cfg.MCPClient{}
		clients[name] = &routingDiscoveryClient{optionalPrimitiveClient: &optionalPrimitiveClient{fixtureProvider: provider(name), active: i == 4}, started: started, release: release, name: name}
	}
	// These are ordinary MCP clients: no configured primitive-owner shortcut.
	mgr, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) { return clients[name], nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "fixture", TenantID: "team", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "host")
	defer gateway.Close()
	collector := &observe.Collector{}
	ctx := observe.WithObserver(context.Background(), collector)
	uri, err := identity.ParseResourceURI("window://example/sales")
	require.NoError(t, err)
	done := make(chan error, 1)
	go func() {
		connection, err := gateway.ConnectionForResource(ctx, uri, "")
		if err == nil && connection.Name != "provider-4" {
			err = fmt.Errorf("wrong provider %s", connection.Name)
		}
		done <- err
	}()
	// Four providers must reach the barrier before any returns. This fails for
	// sequential routing without relying on a machine-specific timing threshold.
	for range 4 {
		select {
		case <-started:
		case <-time.After(3 * time.Second):
			t.Fatal("window routing serialized provider discovery")
		}
	}
	select {
	case <-started:
		t.Fatal("discovery exceeded four concurrent providers")
	default:
	}
	close(release)
	released = true
	require.NoError(t, <-done)
	_, err = gateway.ConnectionForResource(ctx, uri, "")
	require.NoError(t, err)
	for i := 0; i < 4; i++ {
		require.Equal(t, 1, clients[fmt.Sprintf("provider-%d", i)].lists, "warm routing rediscovered an ordinary MCP with no primitives")
	}
	for _, phase := range []string{"gateway.routing", "gateway.discovery", "gateway.provider.work", "gateway.provider.queue", "gateway.provider.discovery", "mcp.pool.acquire", "mcp.pool.create", "gateway.tools.list"} {
		require.Positive(t, collector.Totals()[phase+".calls"], phase)
	}
	// An advertised capability change must defeat the negative hint.
	clients["provider-0"].active = true
	clients["provider-0"].announceToolsChanged()
	_, err = gateway.ConnectionForResource(ctx, uri, "")
	require.ErrorIs(t, err, ErrCollision)
	require.Equal(t, 2, clients["provider-0"].lists)
}

func TestProviderFanoutCancellationNeverDispatches(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	results := providerFanout(ctx, []string{"a", "b", "c", "d", "e"}, func(context.Context, string) (int, error) { t.Error("cancelled discovery dispatched"); return 0, nil })
	for _, result := range results {
		require.ErrorIs(t, result.err, context.Canceled)
	}
}
