package resource

import (
	"context"
	"encoding/json"
	"fmt"
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

type definitionCacheProvider struct {
	*dependencyMCPProvider
	mu   sync.Mutex
	gets map[string]int
}

func (p *definitionCacheProvider) CallTool(ctx context.Context, request *schema.CallToolRequestParams, opts ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	result, err := p.dependencyMCPProvider.CallTool(ctx, request, opts...)
	if err != nil || request.Name == "namespaces/list" || request.Name == "namespaces/get" {
		return result, err
	}
	if request.Name == "windows/get" || request.Name == "navigations/get" {
		uri, _ := request.Arguments["uri"].(string)
		p.mu.Lock()
		p.gets[uri]++
		p.mu.Unlock()
		if request.Name == "navigations/get" {
			value := result.StructuredContent.(primitive.GetResult)
			visible, _ := json.Marshal(map[string]any{"schemaVersion": 1, "applications": []any{map[string]any{"id": authctx.EffectiveUserID(ctx), "menus": []any{}}}})
			value.Resource.Definition = nil
			value.Resource.DefinitionBytes = nil
			value.MenuProjection = &primitive.MenuProjection{SchemaVersion: 1, DefinitionBytes: visible, ContentFingerprint: identity.ContentFingerprint(visible)}
			result.StructuredContent = value
		}
	}
	return result, err
}
func (p *definitionCacheProvider) count(uri string) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.gets[uri]
}
func cacheUser(subject, token, conversation string) context.Context {
	ctx := authctx.WithCanonicalUserID(authctx.WithProvider(authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: subject}), "fixture"), subject)
	ctx = authctx.WithIDToken(ctx, token)
	return requestctx.WithConversationID(ctx, conversation)
}

func TestGenericPrivateDefinitionCacheSeparatesAccountAndIdentityRevision(t *testing.T) {
	const uri = "window://private/original"
	source := &definitionCacheProvider{dependencyMCPProvider: &dependencyMCPProvider{
		owner: "private-provider",
		items: map[string]*dependencyResource{uri: {raw: json.RawMessage(`{"title":"private"}`), formatVersion: 1, revision: "1", authorityBinding: "owner-policy"}},
	}, gets: map[string]int{}}
	mgr, err := manager.New(fixtureOptions{"source": {PrimitiveProviderIdentity: source.owner, ResourceCacheScopes: map[string]string{"private": cfg.ResourceCacheUser}}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	type authority struct{ account, revision string }
	key := &struct{}{}
	g := NewGateway(mgr, func(ctx context.Context) (identity.VerifiedActor, error) {
		value := ctx.Value(key).(authority)
		return identity.VerifiedActor{Issuer: "fixture", Subject: "alice", TenantID: "team", AccountID: value.account, IdentityRevision: value.revision, ValidUntil: time.Now().Add(time.Minute)}, nil
	}, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer g.Close()
	get := func(account, revision string) {
		ctx := context.WithValue(cacheUser("alice", "same-token", "same-conversation"), key, authority{account, revision})
		connection, err := g.ConnectionForResource(ctx, mustCacheURI(t, uri), source.owner)
		require.NoError(t, err)
		_, err = Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri, Revision: "1"}, nil)
		require.NoError(t, err)
	}
	get("one", "r1")
	get("one", "r1")
	require.Equal(t, 1, source.count(uri))
	get("two", "r1")
	get("one", "r2")
	require.Equal(t, 3, source.count(uri), "private definitions must not cross account or identity revisions")
	get("one", "r1")
	require.Equal(t, 3, source.count(uri), "original authority partition should remain warm")
}

func TestGenericDefinitionCachePublicImmutableWindowAndPrivateWorkingMenu(t *testing.T) {
	windowURI, menuURI := "window://shared/original", "navigation://shared/layout"
	item := func(raw string, version int64) *dependencyResource {
		return &dependencyResource{raw: json.RawMessage(raw), formatVersion: version, revision: "1", authorityBinding: "neutral-definition"}
	}
	source := &definitionCacheProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "original-provider", items: map[string]*dependencyResource{windowURI: item(`{"view":{"content":{"id":"original"}}}`, 2), menuURI: item(`{"schemaVersion":1,"applications":[]}`, 1)}}, gets: map[string]int{}}
	source.items[menuURI].revision = identity.WorkingCandidate
	options := fixtureOptions{"source": {PrimitiveProviderIdentity: source.owner, ResourceCacheScopes: map[string]string{"shared": cfg.ResourceCachePublic, "shared/navigation": cfg.ResourceCacheUser}}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) {
		return identity.VerifiedActor{PublicRead: true}, nil
	}, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer g.Close()
	alice, bob := cacheUser("alice", "alice-token", "browser-a"), cacheUser("bob", "bob-token", "browser-b")
	get := func(ctx context.Context, uri string) *Result[json.RawMessage] {
		connection, err := g.ConnectionForResource(ctx, mustCacheURI(t, uri), source.owner)
		require.NoError(t, err)
		revision := "1"
		if uri == menuURI {
			revision = identity.WorkingCandidate
		}
		value, err := Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri, Revision: revision}, nil)
		require.NoError(t, err)
		return value
	}
	first := get(alice, windowURI)
	get(bob, windowURI)
	require.Equal(t, 1, source.count(windowURI), "public definition shared across users")
	first.Definition[0] = 'X'
	fresh := get(alice, windowURI)
	require.JSONEq(t, `{"view":{"content":{"id":"original"}}}`, string(fresh.Definition))
	a, b := get(alice, menuURI), get(bob, menuURI)
	require.Contains(t, string(a.Definition), "alice")
	require.NotContains(t, string(a.Definition), "bob")
	require.Contains(t, string(b.Definition), "bob")
	require.Equal(t, 2, source.count(menuURI))
	get(alice, menuURI)
	require.Equal(t, 2, source.count(menuURI), "working projections reuse the same user metadata partition")
	get(cacheUser("alice", "rotated-token", "browser-a"), menuURI)
	require.Equal(t, 3, source.count(menuURI), "changed credential isolates private metadata")
	get(cacheUser("alice", "alice-token", "another-conversation"), menuURI)
	require.Equal(t, 3, source.count(menuURI), "logical conversations reuse the same user metadata partition")
	mgr.CloseConversation("")
	get(alice, windowURI)
	require.Equal(t, 2, source.count(windowURI), "reconnect invalidates existing metadata slots")
}
func mustCacheURI(t *testing.T, text string) identity.ResourceURI {
	t.Helper()
	uri, err := identity.ParseResourceURI(text)
	require.NoError(t, err)
	return uri
}

func TestGenericDefinitionCacheHonorsRealSourceExpiry(t *testing.T) {
	uri := "window://shared/timed"
	deadline := time.Now().Add(100 * time.Millisecond)
	source := &definitionCacheProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "provider", items: map[string]*dependencyResource{uri: {raw: json.RawMessage(`{"view":{"content":{"id":"original"}}}`), formatVersion: 2, revision: identity.WorkingCandidate, authorityBinding: "source", validUntil: deadline}}}, gets: map[string]int{}}
	options := fixtureOptions{"source": {PrimitiveProviderIdentity: "provider", ResourceCacheScopes: map[string]string{"shared": cfg.ResourceCachePublic}}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) {
		return identity.VerifiedActor{PublicRead: true}, nil
	}, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer g.Close()
	ctx := cacheUser("alice", "token", "browser")
	connection, err := g.ConnectionForResource(ctx, mustCacheURI(t, uri), "provider")
	require.NoError(t, err)
	first, err := Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri}, nil)
	require.NoError(t, err)
	require.True(t, deadline.Equal(first.ResolvedResource.ValidUntil))
	<-time.After(time.Until(deadline) + time.Millisecond)
	source.items[uri].raw = json.RawMessage(`{"view":{"content":{"id":"renewed"}}}`)
	source.items[uri].validUntil = time.Now().Add(time.Minute)
	second, err := Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri}, nil)
	require.NoError(t, err)
	require.Contains(t, string(second.Definition), "renewed")
	require.Equal(t, 2, source.count(uri))
	_, err = Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri}, first.ResolvedResource)
	require.Error(t, err, "realexpiredoriginalsourcepin cannot reuse refreshed metadata")
}

func TestGenericDefinitionCache450ResourcesRetainWarmNamespaceAndDefinitions(t *testing.T) {
	items := map[string]*dependencyResource{}
	for i := 0; i < 450; i++ {
		uri := fmt.Sprintf("window://shared/%03d", i)
		items[uri] = &dependencyResource{raw: json.RawMessage(`{"view":{"content":{"id":"original"}}}`), formatVersion: 2, revision: "1", authorityBinding: "neutral"}
	}
	source := &definitionCacheProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "provider", items: items}, gets: map[string]int{}}
	options := fixtureOptions{"source": {PrimitiveProviderIdentity: "provider", ResourceCacheScopes: map[string]string{"shared": cfg.ResourceCachePublic}}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) {
		return identity.VerifiedActor{PublicRead: true}, nil
	}, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer g.Close()
	ctx := cacheUser("alice", "token", "browser")
	connection, err := g.ConnectionForProvider(ctx, "provider")
	require.NoError(t, err)
	for repeat := 0; repeat < 2; repeat++ {
		for i := 0; i < 450; i++ {
			uri := fmt.Sprintf("window://shared/%03d", i)
			_, err := Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri, Revision: "1"}, nil)
			require.NoError(t, err)
			require.Equal(t, 1, source.count(uri))
		}
	}
}

func TestBrowserAndDeclaredSessionMetadataScopeRetainsConversation(t *testing.T) {
	ctx := cacheUser("alice", "token", "conversation-a")
	ordinary := definitionCacheScopeContext(ctx, &cfg.MCPClient{}, cfg.ResourceCacheUser)
	require.Empty(t, requestctx.ConversationIDFromContext(ordinary))
	require.Equal(t, "conversation-a", requestctx.ConversationIDFromContext(ctx), "actual invocation context unchanged")
	browser := definitionCacheScopeContext(ctx, &cfg.MCPClient{ExecutionLocation: "browser"}, cfg.ResourceCacheUser)
	require.Equal(t, "conversation-a", requestctx.ConversationIDFromContext(browser))
	explicit := definitionCacheScopeContext(ctx, &cfg.MCPClient{}, cfg.ResourceCacheConversation)
	require.Equal(t, "conversation-a", requestctx.ConversationIDFromContext(explicit))
}

func TestGenericDefinitionCacheDeclaredConversationScopeSeparatesLogicalConversations(t *testing.T) {
	uri := "window://shared/session"
	source := &definitionCacheProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "provider", items: map[string]*dependencyResource{uri: {raw: json.RawMessage(`{"view":{"content":{"id":"original"}}}`), formatVersion: 2, revision: "1", authorityBinding: "neutral"}}}, gets: map[string]int{}}
	options := fixtureOptions{"source": {PrimitiveProviderIdentity: "provider", ResourceCacheScopes: map[string]string{"shared": cfg.ResourceCacheConversation}}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) {
		return identity.VerifiedActor{PublicRead: true}, nil
	}, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer g.Close()
	for _, conversation := range []string{"a", "a", "b", "b", "a"} {
		ctx := cacheUser("alice", "token", conversation)
		connection, err := g.ConnectionForProvider(ctx, "provider")
		require.NoError(t, err)
		_, err = Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri, Revision: "1"}, nil)
		require.NoError(t, err)
	}
	require.Equal(t, 2, source.count(uri), "same credential and connection, two distinct conversation metadata slots")
}

func TestPublicWorkingDefinitionCachesUntilInvalidation(t *testing.T) {
	for _, revision := range []string{"", identity.WorkingCandidate} {
		t.Run("selector="+revision, func(t *testing.T) {
			const uri = "window://shared/live"
			source := &definitionCacheProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "provider", items: map[string]*dependencyResource{uri: {raw: json.RawMessage(`{"title":"original"}`), formatVersion: 1, revision: identity.WorkingCandidate, authorityBinding: "neutral-definition"}}}, gets: map[string]int{}}
			mgr, err := manager.New(fixtureOptions{"source": {PrimitiveProviderIdentity: "provider", ResourceCacheScopes: map[string]string{"shared": cfg.ResourceCachePublic}}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
			require.NoError(t, err)
			defer mgr.CloseConversation("")
			g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) {
				return identity.VerifiedActor{PublicRead: true}, nil
			}, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
			defer g.Close()
			get := func(subject string) *Result[json.RawMessage] {
				ctx := cacheUser(subject, subject+"-token", subject+"-conversation")
				connection, err := g.ConnectionForResource(ctx, mustCacheURI(t, uri), "provider")
				require.NoError(t, err)
				result, err := Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri, Revision: revision}, nil)
				require.NoError(t, err)
				return result
			}
			first := get("alice")
			first.Definition[0] = 'X'
			require.JSONEq(t, `{"title":"original"}`, string(get("bob").Definition))
			require.Equal(t, 1, source.count(uri), "public working metadata must not be reconstructed for every user or request")
			source.items[uri].raw = json.RawMessage(`{"title":"updated"}`)
			require.JSONEq(t, `{"title":"original"}`, string(get("alice").Definition))
			g.Invalidate("source")
			require.JSONEq(t, `{"title":"updated"}`, string(get("alice").Definition))
			require.Equal(t, 2, source.count(uri))
		})
	}
}
