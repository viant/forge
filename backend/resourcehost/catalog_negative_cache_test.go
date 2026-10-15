package resource

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

type optionalPrimitiveClient struct {
	*fixtureProvider
	active  bool
	lists   int
	listErr error
}

func (p *optionalPrimitiveClient) Initialize(context.Context, ...mcpclient.RequestOption) (*schema.InitializeResult, error) {
	return &schema.InitializeResult{ProtocolVersion: schema.LatestProtocolVersion}, nil
}

func (p *optionalPrimitiveClient) ListTools(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	p.lists++
	if p.listErr != nil {
		return nil, p.listErr
	}
	if !p.active {
		return &schema.ListToolsResult{}, nil
	}
	return p.fixtureProvider.ListTools(ctx, cursor, options...)
}

func (p *optionalPrimitiveClient) announceToolsChanged() {
	p.notificationMu.RLock()
	h := p.handler
	p.notificationMu.RUnlock()
	if h != nil {
		h.OnNotification(context.Background(), &jsonrpc.Notification{Jsonrpc: jsonrpc.Version, Method: "notifications/tools/list_changed"})
	}
}

func TestOrdinaryMCPNegativeCapabilityCacheRefreshesOnEventNotWallClock(t *testing.T) {
	provider := &optionalPrimitiveClient{fixtureProvider: provider("ordinary")}
	options := fixtureOptions{"ordinary": {}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) {
		return provider, nil
	}))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	now := time.Now()
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://idp.example", TenantID: "team", AccountID: "account", IdentityRevision: "1", ValidUntil: now.Add(time.Hour)}
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "host")
	defer gateway.Close()
	gateway.Now = func() time.Time { return now }
	ctx := context.Background()
	for range 3 {
		_, err = gateway.catalogCapability(ctx, actor, "ordinary")
		require.True(t, errors.Is(err, ErrUnavailable))
	}
	require.Equal(t, 1, provider.lists, "an ordinary MCP must not be rediscovered on every report datasource")
	other := actor
	other.Subject = "bob"
	_, err = gateway.catalogCapability(ctx, other, "ordinary")
	require.ErrorIs(t, err, ErrUnavailable)
	require.Equal(t, 2, provider.lists, "one user's negative catalog must not be reused as another user's visibility")
	provider.active = true
	provider.announceToolsChanged()
	got, err := gateway.catalogCapability(ctx, actor, "ordinary")
	require.NoError(t, err)
	require.NotEmpty(t, got.namespaces, "a newly advertised primitive must become visible after notification")
	require.Equal(t, 3, provider.lists)
	temporary := errors.New("temporary tool discovery failure")
	provider.listErr = temporary
	provider.announceToolsChanged()
	for range 2 {
		_, err = gateway.catalogCapability(ctx, actor, "ordinary")
		require.ErrorIs(t, err, temporary)
	}
	require.Equal(t, 5, provider.lists, "transport failures must not become negative capability hits")

	provider.listErr = nil
	provider.active = false
	provider.announceToolsChanged()
	_, err = gateway.catalogCapability(ctx, actor, "ordinary")
	require.ErrorIs(t, err, ErrUnavailable)
	require.Equal(t, 6, provider.lists)
	now = now.Add(31 * time.Second)
	_, err = gateway.catalogCapability(ctx, actor, "ordinary")
	require.ErrorIs(t, err, ErrUnavailable)
	require.Equal(t, 6, provider.lists, "unchanged MCP capabilities must not be polled again because time passed")
	provider.active = true
	provider.announceToolsChanged()
	_, err = gateway.catalogCapability(ctx, actor, "ordinary")
	require.NoError(t, err)
	require.Equal(t, 7, provider.lists, "notification must replace the cached unsupported result")
}
