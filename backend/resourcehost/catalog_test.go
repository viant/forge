package resource

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
)

type queryProvider struct {
	*dependencyMCPProvider
	mu      sync.Mutex
	calls   map[string]int
	badArgs bool
}

func (p *queryProvider) CallTool(ctx context.Context, r *schema.CallToolRequestParams, opts ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	p.mu.Lock()
	p.calls[r.Name]++
	if r.Name != "namespaces/get" {
		for key := range r.Arguments {
			if key != "namespace" && key != "cursor" && key != "limit" {
				p.badArgs = true
			}
		}
	}
	p.mu.Unlock()
	result, err := p.dependencyMCPProvider.CallTool(ctx, r, opts...)
	if err == nil && r.Name == "namespaces/list" {
		list := result.StructuredContent.(primitive.NamespaceListResult)
		for i := range list.Namespaces {
			list.Namespaces[i].Description = "Published sales namespace"
			list.Namespaces[i].UseCases = []string{"Review sales"}
		}
		result.StructuredContent = list
	}
	if err == nil && r.Name == "windows/list" {
		list := result.StructuredContent.(map[string]any)
		rows := list["windows"].([]primitive.ResourceState)
		for i := range rows {
			rows[i].Description = "Sales details"
		}
		list["windows"] = rows
	}
	return result, err
}
func (p *queryProvider) count(name string) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.calls[name]
}
func TestGatewayCatalogPagesAcrossPartialProvidersPrivateScopesAndFreshGet(t *testing.T) {
	item := func() *dependencyResource {
		return &dependencyResource{raw: json.RawMessage(`{"title":"original"}`), formatVersion: 1, revision: identity.WorkingCandidate, authorityBinding: "binding", validUntil: time.Now().Add(time.Minute)}
	}
	p := &queryProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "windows", items: map[string]*dependencyResource{"window://a/Zulu": item(), "window://a/alpha": item(), "window://b/Beta": item(), "datasource://a/rows": item()}}, calls: map[string]int{}}
	intents := &queryProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "intents", items: map[string]*dependencyResource{"intent://b/review": item()}}, calls: map[string]int{}}
	options := fixtureOptions{"windows": &cfg.MCPClient{ToolsListVisibility: "public"}, "intents": &cfg.MCPClient{}, "ordinary": &cfg.MCPClient{}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) {
		if name == "ordinary" {
			return &ordinarySubsetSkills{calls: map[string]int{}}, nil
		}
		if name == "windows" {
			return p, nil
		}
		return intents, nil
	}))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	actor := func(ctx context.Context) (identity.VerifiedActor, error) {
		return identity.VerifiedActor{Subject: authctx.EffectiveUserID(ctx), Issuer: "issuer", TenantID: "tenant", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}, nil
	}
	gateway := NewGateway(mgr, actor, func(context.Context, identity.VerifiedActor) error { return nil }, "local")
	alice := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "alice"})
	query := CatalogQuery{Limit: 1}
	first, err := ListPage[map[string]string](alice, gateway, "window", query)
	require.NoError(t, err)
	require.Equal(t, "alpha", first.Items[0].Resource.Name)
	query.Cursor = first.NextCursor
	second, err := ListPage[map[string]string](alice, gateway, "window", query)
	require.NoError(t, err)
	require.Equal(t, "Beta", second.Items[0].Resource.Name)
	var wg sync.WaitGroup
	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			namespace := "a"
			if i%2 != 0 {
				namespace = "b"
			}
			page, e := gateway.ListPage(alice, "window", CatalogQuery{Namespace: namespace, NameTerms: []string{"ALPHA", "BETA"}, DescriptionTerms: []string{"Sales"}})
			if e != nil || len(page.Items) != 1 {
				t.Errorf("partition query %v %v", page, e)
			}
		}(i)
	}
	wg.Wait()
	require.Equal(t, 2, p.count("windows/list"), "one load per provider namespace, never per filter or page")
	require.Zero(t, intents.count("windows/list"))
	require.False(t, p.badArgs)
	first.Items[0].Resource.Name = "modified"
	again, err := gateway.ListPage(alice, "window", CatalogQuery{Namespace: "a", NameTerms: []string{"alpha"}})
	require.NoError(t, err)
	require.Equal(t, "alpha", again.Items[0].Resource.Name)
	bob := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "bob"})
	_, err = gateway.ListPage(bob, "window", CatalogQuery{})
	require.NoError(t, err)
	require.Equal(t, 4, p.count("windows/list"), "public tool list never shares resource visibility")
	_, err = gateway.ListPage(authctx.WithBearer(alice, "new-auth-context"), "window", CatalogQuery{})
	require.NoError(t, err)
	require.Equal(t, 6, p.count("windows/list"))
	_, err = gateway.ListPage(requestctx.WithConversationID(alice, "other-session"), "window", CatalogQuery{})
	require.NoError(t, err)
	require.Equal(t, 8, p.count("windows/list"), "same principal sessions keep independent visible snapshots")
	ns, err := gateway.NamespacePage(alice, CatalogQuery{DescriptionTerms: []string{"sales"}})
	require.NoError(t, err)
	require.Len(t, ns.Items, 3)
	require.Equal(t, []string{"Review sales"}, ns.Items[0].UseCases)
	_, err = gateway.ListPage(alice, "intent", CatalogQuery{Namespace: "b"})
	require.NoError(t, err)
	require.Equal(t, 1, intents.count("intents/list"))
	require.Zero(t, p.count("intents/list"))
	_, err = gateway.ListPage(alice, "datasource", CatalogQuery{})
	require.NoError(t, err)
	require.Equal(t, 1, p.count("datasources/list"))
	// Metadata remains visible, but Get still asks its managing provider freshly.
	p.items["window://a/alpha"].denied = true
	_, err = Get[map[string]string](alice, gateway, again.Items[0].Connection, identity.ResourceRef{URI: "window://a/alpha"}, nil)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Equal(t, 1, p.count("windows/get"))
	gateway.Invalidate("windows")
	_, err = gateway.ListPage(alice, "window", query)
	require.ErrorIs(t, err, primitive.ErrCatalogCursor)
}

func TestGatewayCatalogDiscoversNewlySupportingProviderAfterItsToolChange(t *testing.T) {
	resource := func() *dependencyResource {
		return &dependencyResource{raw: json.RawMessage(`{"title":"visible"}`), formatVersion: 1, revision: identity.WorkingCandidate, authorityBinding: "owner", validUntil: time.Now().Add(time.Minute)}
	}
	windows := &dependencyMCPProvider{owner: "windows", items: map[string]*dependencyResource{
		"window://team/alpha": resource(),
		"window://team/beta":  resource(),
	}}
	partial := &dependencyMCPProvider{owner: "partial", items: map[string]*dependencyResource{
		"datasource://team/rows": resource(),
	}}
	mgr, err := manager.New(fixtureOptions{"windows": &cfg.MCPClient{}, "partial": &cfg.MCPClient{}}, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) {
		if name == "partial" {
			return partial, nil
		}
		return windows, nil
	}))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	actor := identity.VerifiedActor{Issuer: "fixture", Subject: "alice", TenantID: "team", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer g.Close()
	ctx := context.Background()
	first, err := ListPage[json.RawMessage](ctx, g, "window", CatalogQuery{Limit: 1})
	require.NoError(t, err)
	require.Equal(t, 2, first.Total)
	require.NotEmpty(t, first.NextCursor)

	partial.items["window://team/new"] = resource()
	g.Invalidate("partial") // Manager's tools/list notification refreshes discovery.
	current, err := ListPage[json.RawMessage](ctx, g, "window", CatalogQuery{Limit: 10})
	require.NoError(t, err)
	require.Equal(t, 3, current.Total)
	_, err = ListPage[json.RawMessage](ctx, g, "window", CatalogQuery{Limit: 1, Cursor: first.NextCursor})
	require.ErrorIs(t, err, primitive.ErrCatalogCursor)
}
