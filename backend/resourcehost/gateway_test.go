package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
	mcp "github.com/viant/mcp"
	protoclient "github.com/viant/mcp-protocol/client"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

type fixtureOptions map[string]*cfg.MCPClient

func (p fixtureOptions) Options(_ context.Context, n string) (*cfg.MCPClient, error) {
	return p[n], nil
}

func TestGatewayUsesLocalProviderOverProtectedOrdinaryMCPTools(t *testing.T) {
	p, source, actor, _ := localFixture(t)
	var pretty bytes.Buffer
	require.NoError(t, json.Indent(&pretty, source.bytes(), "", "  "))
	source.mu.Lock()
	source.raw = append(json.RawMessage(nil), pretty.Bytes()...)
	source.mu.Unlock()
	handler, err := NewMCPHandler(p, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), localTestRequest{}, true)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})
	require.NoError(t, err)
	httpServer := httptest.NewServer(handler)
	defer httpServer.Close()
	provider := fixtureOptions{"local": {ClientOptions: &mcp.ClientOptions{Name: "local", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: httpServer.URL + "/mcp"}}}}}
	mgr, err := manager.New(provider)
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(_ context.Context, expected identity.VerifiedActor) error {
		if expected.Subject != actor.Subject || expected.AccountID != actor.AccountID || !expected.Valid(time.Now()) {
			return identity.ErrResourceDenied
		}
		return nil
	}, "gateway-is-not-local")
	ctx := context.Background()
	listed, err := gateway.List(ctx, "window", "team")
	require.NoError(t, err)
	require.Len(t, listed, 1)
	require.Equal(t, "local-workspace", listed[0].Connection.ProviderIdentity)
	require.Equal(t, "window://team/sales", listed[0].Resource.URI)
	got, err := gateway.Get(ctx, listed[0].Connection, identity.ResourceRef{URI: listed[0].Resource.URI}, nil)
	require.NoError(t, err)
	require.NotNil(t, got.ResolvedResource)
	require.Equal(t, "local-workspace", got.ResolvedResource.ProviderIdentity)
	require.Equal(t, identity.WorkingCandidate, got.ResolvedResource.Selector())
	require.Equal(t, pretty.Bytes(), got.Resource.DefinitionBytes, "lossless raw bytes must survive tools/call transport")
}
func (p fixtureOptions) Names(context.Context) ([]string, error) {
	var names []string
	for n := range p {
		names = append(names, n)
	}
	return names, nil
}

type fixtureNotificationPort struct {
	notificationMu sync.RWMutex
	handler        protoclient.Handler
}

func (p *fixtureNotificationPort) SetNotificationHandler(h protoclient.Handler) {
	p.notificationMu.Lock()
	p.handler = h
	p.notificationMu.Unlock()
}
func (p *fixtureNotificationPort) resourceChanged() {
	p.notificationMu.RLock()
	h := p.handler
	p.notificationMu.RUnlock()
	if h == nil {
		panic("fixture notification receiver not connected")
	}
	h.OnNotification(context.Background(), &jsonrpc.Notification{Jsonrpc: jsonrpc.Version, Method: "notifications/resources/list_changed"})
}

type fixtureProvider struct {
	fixtureNotificationPort
	mcpclient.Interface
	owner      string
	definition json.RawMessage
	carrier    []byte
	projection json.RawMessage
	lease      time.Time
	mu         sync.Mutex
	calls      map[string]int
	after      func(string)
}

func (p *fixtureProvider) ListResources(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	return nil, jsonrpc.NewMethodNotFound("resources unavailable", nil)
}

func (p *fixtureProvider) ListTools(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	meta := map[string]any{primitive.AuthoringExtension: map[string]any{"version": 1, "providerIdentity": p.owner, "transport": "tools/call"}}
	return &schema.ListToolsResult{Tools: []schema.Tool{{Name: "namespaces/list", Meta: meta}, {Name: "namespaces/get", Meta: meta}, {Name: "windows/list", Meta: meta}, {Name: "windows/get", Meta: meta}}}, nil
}
func (p *fixtureProvider) CallTool(ctx context.Context, r *schema.CallToolRequestParams, options ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !mcpclient.NewRequestOptions(options).NoRetry {
		return nil, errors.New("fixture requires no replay")
	}
	p.calls[r.Name]++
	var value any
	switch r.Name {
	case "namespaces/list":
		value = primitive.NamespaceListResult{ProviderIdentity: p.owner, Namespaces: []primitive.Namespace{{Name: "example", Kinds: []string{"window"}}}, Complete: true}
	case "namespaces/get":
		value = primitive.NamespaceCapabilities{ProviderIdentity: p.owner, Namespace: "example", Kinds: []primitive.KindSupport{{Kind: "window", FormatVersions: []int64{2}, Operations: []string{"list", "get"}, Methods: primitive.Methods("window", []string{"list", "get"})}}}
	case "windows/list":
		value = map[string]any{"windows": []primitive.ResourceState{{URI: "window://example/sales", Kind: "window", Namespace: "example", Name: "sales"}}, "complete": true}
	case "windows/get":
		candidate := identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(p.definition)}
		projection := p.definition
		if len(p.projection) > 0 {
			projection = p.projection
		}
		value = primitive.GetResult{Resource: &primitive.ResourceState{URI: "window://example/sales", Definition: projection, DefinitionBytes: p.carrier, ContentFingerprint: candidate.ContentFingerprint}, ResolvedResource: &identity.ResolvedResource{ProviderIdentity: p.owner, URI: "window://example/sales", ResourceCandidate: candidate, AuthorityBinding: "verified-profile", ValidUntil: p.lease}}
	default:
		return nil, ErrUnavailable
	}
	if p.after != nil {
		p.after(r.Name)
	}
	return &schema.CallToolResult{StructuredContent: value}, nil
}
func fixtureGateway(t *testing.T, providers map[string]*fixtureProvider) (*Gateway, *identity.VerifiedActor, *bool) {
	t.Helper()
	options := fixtureOptions{}
	for name := range providers {
		options[name] = &cfg.MCPClient{}
	}
	mgr, e := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) { return providers[name], nil }))
	require.NoError(t, e)
	t.Cleanup(func() { mgr.CloseConversation("") })
	actor := &identity.VerifiedActor{Subject: "alice", Issuer: "https://idp.example", TenantID: "example", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	revoked := new(bool)
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(_ context.Context, expected identity.VerifiedActor) error {
		if *revoked || expected.Subject != actor.Subject || expected.Issuer != actor.Issuer || expected.TenantID != actor.TenantID || expected.AccountID != actor.AccountID || expected.IdentityRevision != actor.IdentityRevision {
			return identity.ErrResourceDenied
		}
		return nil
	}, "local-yaml")
	return gateway, actor, revoked
}
func provider(owner string) *fixtureProvider {
	return &fixtureProvider{owner: owner, definition: json.RawMessage(`{"schemaVersion":2,"view":{"title":"Sales"}}`), lease: time.Now().Add(time.Minute), calls: map[string]int{}}
}

func TestGatewayOrdinaryToolsDiscoveryAndPinnedDrift(t *testing.T) {
	p := provider("studio-a")
	g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": p})
	ctx := context.Background()
	resources, e := g.List(ctx, "window", "")
	require.NoError(t, e)
	require.Len(t, resources, 1)
	connection, e := ResolveLocator(resources, "window://example/sales", "")
	require.NoError(t, e)
	result, e := g.Get(ctx, connection, identity.ResourceRef{URI: "window://example/sales"}, nil)
	require.NoError(t, e)
	_, e = g.Get(ctx, connection, identity.ResourceRef{URI: result.Resource.URI}, result.ResolvedResource)
	require.NoError(t, e)
	p.definition = json.RawMessage(`{"schemaVersion":2,"view":{"title":"Changed"}}`)
	p.resourceChanged()
	_, e = g.Get(ctx, connection, identity.ResourceRef{URI: result.Resource.URI}, result.ResolvedResource)
	require.ErrorIs(t, e, identity.ErrResourceDenied)
	require.GreaterOrEqual(t, p.calls["namespaces/list"], 1) // only discovery, never extension dispatch
	g.Invalidate("remote")
	_, e = g.Get(ctx, connection, identity.ResourceRef{URI: result.Resource.URI}, result.ResolvedResource)
	require.ErrorIs(t, e, identity.ErrResourceDenied)
}
func TestGatewayPartitionAndBufferedRevocation(t *testing.T) {
	p := provider("studio-a")
	g, actor, revoked := fixtureGateway(t, map[string]*fixtureProvider{"remote": p})
	ctx := context.Background()
	_, e := g.Discover(ctx)
	require.NoError(t, e)
	before := p.calls["namespaces/get"]
	_, e = g.Discover(ctx)
	require.NoError(t, e)
	require.Equal(t, p.calls["namespaces/get"], before, "unchanged scoped namespace metadata should reuse the advertised contract")
	actor.IdentityRevision = "2"
	_, e = g.Discover(ctx)
	require.NoError(t, e)
	require.Greater(t, p.calls["namespaces/get"], before)
	p.after = func(method string) {
		if method == "windows/list" {
			*revoked = true
		}
	}
	result, e := g.List(ctx, "window", "")
	require.ErrorIs(t, e, identity.ErrResourceDenied)
	require.Nil(t, result)
}
func TestGatewayExplicitCollisionsAndSelfDiscovery(t *testing.T) {
	g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"a": provider("studio-a"), "b": provider("studio-b")})
	rows, e := g.List(context.Background(), "window", "")
	require.NoError(t, e)
	require.Len(t, rows, 2)
	_, e = ResolveLocator(rows, "window://example/sales", "")
	require.ErrorIs(t, e, ErrCollision)
	selected, e := ResolveLocator(rows, "window://example/sales", "studio-b")
	require.NoError(t, e)
	require.Equal(t, "b", selected.Name)
	g, _, _ = fixtureGateway(t, map[string]*fixtureProvider{"self": provider("local-yaml")})
	_, e = g.Discover(context.Background())
	require.ErrorIs(t, e, ErrCollision)
	g, _, _ = fixtureGateway(t, map[string]*fixtureProvider{"a": provider("same"), "b": provider("same")})
	_, e = g.Discover(context.Background())
	require.ErrorIs(t, e, ErrCollision)
}
