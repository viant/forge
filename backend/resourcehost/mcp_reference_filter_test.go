package resource

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp"
	protoclient "github.com/viant/mcp-protocol/client"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
)

type mcpOnlyDefinitionClient struct {
	mcpclient.Interface
	t             *testing.T
	filters       int
	reads         int
	denied        bool
	allowGeneric  bool
	reportedOwner string
	initializes   int
	discovers     int
	handler       protoclient.Handler
}

func (c *mcpOnlyDefinitionClient) SetNotificationHandler(handler protoclient.Handler) {
	c.handler = handler
}

func (c *mcpOnlyDefinitionClient) Initialize(context.Context, ...mcpclient.RequestOption) (*schema.InitializeResult, error) {
	c.initializes++
	return c.NegotiatedServer()
}
func (c *mcpOnlyDefinitionClient) NegotiatedServer() (*schema.InitializeResult, error) {
	return &schema.InitializeResult{Capabilities: schema.ServerCapabilities{Resources: &schema.ServerCapabilitiesResources{}, Extensions: map[string]map[string]any{resourceFilterExtension: {"schemaVersion": 1, "fields": []string{"namespace", "kind", "query", "limit"}}}}}, nil
}
func (c *mcpOnlyDefinitionClient) Discover(context.Context, ...mcpclient.RequestOption) (*schema.DiscoverResult, error) {
	c.discovers++
	c.t.Fatal("negotiated resource capability must not rediscover")
	return nil, nil
}
func (c *mcpOnlyDefinitionClient) ListResources(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	c.t.Fatal("unfiltered catalog walk must not run for MCP definitions")
	return nil, nil
}
func (c *mcpOnlyDefinitionClient) ListTools(context.Context, *string, ...mcpclient.RequestOption) (*schema.ListToolsResult, error) {
	return &schema.ListToolsResult{Tools: []schema.Tool{{Name: "namespaces/list"}, {Name: "namespaces/get"}, {Name: "resource/get"}}}, nil
}
func (c *mcpOnlyDefinitionClient) CallTool(_ context.Context, params *schema.CallToolRequestParams, _ ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	require.Equal(c.t, "namespaces/list", params.Name)
	return &schema.CallToolResult{StructuredContent: map[string]any{"namespaces": []any{map[string]any{"uri": "ns://dspui", "name": "DSPUI"}}}}, nil
}
func (c *mcpOnlyDefinitionClient) ListResourcesWithParams(_ context.Context, params *schema.ListResourcesRequestParams, _ ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	c.filters++
	raw, err := json.Marshal(params.Meta)
	require.NoError(c.t, err)
	var meta map[string]any
	require.NoError(c.t, json.Unmarshal(raw, &meta))
	filter := meta[resourceFilterExtension].(map[string]any)
	require.Equal(c.t, "ns://dspui", filter["namespace"])
	if filter["kind"] != "mcp" {
		if !c.allowGeneric {
			c.t.Fatal("MCP definition lookup walked unrelated resource kinds")
		}
	}
	require.EqualValues(c.t, 100, filter["limit"])
	resources := []schema.Resource{{Uri: "mcp://dspui/platform", Name: "mcp://dspui/platform"}, {Uri: "mcp://dspui/steward", Name: "mcp://dspui/steward"}}
	if filter["kind"] != "mcp" {
		resources = append(resources, schema.Resource{Uri: "window://dspui/other", Name: "window://dspui/other"})
	}
	return &schema.ListResourcesResult{Resources: resources}, nil
}
func (c *mcpOnlyDefinitionClient) ReadResource(_ context.Context, params *schema.ReadResourceRequestParams, _ ...mcpclient.RequestOption) (*schema.ReadResourceResult, error) {
	c.reads++
	if c.denied {
		return nil, errors.New("owning producer denied")
	}
	require.Equal(c.t, "mcp://dspui/platform", params.Uri)
	text := `{"name":"platform","transport":{"type":"streamable","url":"https://example.invalid/mcp"}}`
	item := schema.ReadResourceResultContentsElem{Uri: params.Uri, Text: text}
	if c.reportedOwner != "" {
		item.Meta = map[string]any{"resource": identity.ResolvedResource{URI: params.Uri, ProviderIdentity: c.reportedOwner, ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(text))}, ValidUntil: time.Now().Add(time.Hour)}}
	}
	return &schema.ReadResourceResult{Contents: []schema.ReadResourceResultContentsElem{item}}, nil
}

func TestMCPReferenceReaderFiltersOnlyDefinitionsAndRetainsExactReadGuard(t *testing.T) {
	client := &mcpOnlyDefinitionClient{t: t}
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(context.Background(), "owned", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "producer", PrimitiveNamespaces: []string{"ns://dspui"}, ResourceCacheScopes: map[string]string{"*": cfg.ResourceCachePublic}}, func(context.Context) (mcpclient.Interface, error) { return client, nil }))
	defer mgr.CloseConversation("")
	actor, verify := PublicReadActors()
	g := NewGateway(mgr, actor, verify, "consumer")
	defer g.Close()
	reader := &MCPReferenceReader{gateway: g, internal: MCPDefinitionSource{ConnectionName: "configuration", ProviderIdentity: "configuration", Namespace: "workspace"}}
	rows, err := reader.rows(context.Background(), Connection{Name: "owned", ProviderIdentity: "producer"}, "")
	require.NoError(t, err)
	require.Len(t, rows, 2)
	require.Equal(t, 1, client.filters)
	selected := rows[0]
	proof := mcpReferenceProof{connection: selected.Connection, uri: selected.Resource.URI}
	readCtx := context.WithValue(context.Background(), mcpReferenceProofKey{}, proof)
	client.denied = true
	_, err = Get[json.RawMessage](readCtx, g, selected.Connection, identity.ResourceRef{URI: selected.Resource.URI}, nil)
	require.ErrorContains(t, err, "owning producer denied")
	client.denied = false
	client.reportedOwner = "wrong-owner"
	_, err = Get[json.RawMessage](readCtx, g, selected.Connection, identity.ResourceRef{URI: selected.Resource.URI}, nil)
	require.Error(t, err, "a producer-reported owner cannot differ from configured authority")
	client.reportedOwner = "producer"
	got, err := Get[json.RawMessage](readCtx, g, selected.Connection, identity.ResourceRef{URI: selected.Resource.URI}, nil)
	require.NoError(t, err)
	require.Equal(t, selected.Resource.URI, got.Resource.URI)
	require.Equal(t, 3, client.reads)
}

type mcpReferenceTestProvider struct {
	reader manager.DefinitionReader
	names  []string
}

func (p *mcpReferenceTestProvider) Options(ctx context.Context, name string) (*cfg.MCPClient, error) {
	if p.reader == nil {
		return nil, identity.ErrResourceDenied
	}
	return p.reader.Load(ctx, name)
}
func (p *mcpReferenceTestProvider) Names(ctx context.Context) ([]string, error) {
	return append([]string(nil), p.names...), nil
}
func (p *mcpReferenceTestProvider) BindDefinitionReader(reader manager.DefinitionReader, _ []string) error {
	p.reader = reader
	return nil
}

func TestMCPReferenceReaderFullLoadUsesKindScopedIndexWithoutChangingGenericInventory(t *testing.T) {
	remote := &mcpOnlyDefinitionClient{t: t}
	_, err := remote.Initialize(context.Background()) // one completed handshake
	require.NoError(t, err)
	localURI, err := identity.ParseResourceURI("mcp://workspace/owned")
	require.NoError(t, err)
	localRaw := json.RawMessage(`{"name":"owned","transport":{"type":"streamable","url":"https://example.invalid/mcp"},"primitiveProviderIdentity":"producer","primitiveNamespaces":["ns://dspui"],"resourceCacheScopes":{"*":"user"}}`)
	localSource := &indexedWindowSource{uri: localURI, raw: localRaw}
	unrelatedURI, err := identity.ParseResourceURI("mcp://workspace/datastudio")
	require.NoError(t, err)
	unrelatedSource := &indexedWindowSource{uri: unrelatedURI, raw: json.RawMessage(`{"name":"datastudio","transport":{"type":"streamable","url":"https://unrelated.invalid/mcp"},"primitiveProviderIdentity":"datastudio-owner","primitiveNamespaces":["ns://datastudio"],"resourceCacheScopes":{"*":"user"}}`)}
	overlapURI, err := identity.ParseResourceURI("mcp://workspace/overlap")
	require.NoError(t, err)
	overlapSource := &indexedWindowSource{uri: overlapURI, raw: json.RawMessage(`{"name":"overlap","transport":{"type":"streamable","url":"https://overlap.invalid/mcp"},"primitiveProviderIdentity":"second-producer","primitiveNamespaces":["ns://dspui"],"resourceCacheScopes":{"*":"user"}}`)}
	localActor, localVerify := PublicReadActors()
	binding := func(uri identity.ResourceURI, source *indexedWindowSource) LocalResourceBinding {
		return LocalResourceBinding{URI: uri.String(), FormatVersion: 1, Resolver: func(_ context.Context, _ identity.VerifiedActor, _ string) (*identity.ResourceResolver, error) {
			return &identity.ResourceResolver{ProviderIdentity: "configuration", Source: source, Policy: indexedWindowPolicy(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
				return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "configuration", ValidUntil: time.Now().Add(time.Hour)}, nil
			})}, nil
		}}
	}
	localProvider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "configuration", Actor: localActor, Verify: localVerify, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: []LocalResourceBinding{binding(localURI, localSource), binding(unrelatedURI, unrelatedSource), binding(overlapURI, overlapSource)}, Validators: map[string]LocalResourceValidator{"mcp": ValidateMCPDefinition}})
	require.NoError(t, err)
	provider := &mcpReferenceTestProvider{names: []string{"owned", "datastudio", "overlap"}}
	unrelatedCalls := 0
	overlapClient := &mcpOnlyDefinitionClient{t: t}
	mgr, err := manager.New(provider, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) {
		if name == "overlap" {
			return overlapClient, nil
		}
		if name == "datastudio" {
			unrelatedCalls++
			return nil, errors.New("unrelated restricted provider contacted")
		}
		if name != "owned" {
			return nil, identity.ErrResourceDenied
		}
		return remote, nil
	}), manager.WithUserIDExtractor(authctx.EffectiveUserID))
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(context.Background(), "configuration", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "configuration", ResourceCacheScopes: map[string]string{"workspace": cfg.ResourceCachePublic}}, func(context.Context) (mcpclient.Interface, error) { return NewLocalMCPClient(localProvider) }))
	defer mgr.CloseConversation("")
	identityRevision := "v1"
	resolve := func(ctx context.Context) (identity.VerifiedActor, error) {
		subject := authctx.EffectiveUserID(ctx)
		if subject == "" {
			return identity.VerifiedActor{}, identity.ErrResourceDenied
		}
		return identity.VerifiedActor{Subject: subject, Issuer: "fixture", TenantID: "tenant", AccountID: "account", IdentityRevision: identityRevision, ValidUntil: time.Now().Add(time.Hour)}, nil
	}
	verify := func(ctx context.Context, actor identity.VerifiedActor) error {
		if actor.Subject != authctx.EffectiveUserID(ctx) || !actor.Valid(time.Now()) {
			return identity.ErrResourceDenied
		}
		return nil
	}
	g := NewGateway(mgr, resolve, verify, "consumer")
	defer g.Close()
	reader, err := NewMCPReferenceReader(g, MCPDefinitionSource{ConnectionName: "configuration", ProviderIdentity: "configuration", Namespace: "workspace"}, []identity.ResourceRef{{URI: "mcp://workspace/datastudio"}, {URI: "mcp://workspace/owned"}})
	require.NoError(t, err)
	// RegisterLocal is the only local definition source. The reader must own
	// every dynamic external name after binding, as in Core startup.
	bound, err := mgr.BindDefinitionReader(reader)
	require.NoError(t, err)
	require.True(t, bound)
	alice := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "alice"})
	bob := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "bob"})
	definition, err := reader.Load(alice, "mcp://dspui/platform")
	require.NoError(t, err)
	require.Equal(t, "mcp://dspui/platform", definition.ResolvedIdentity.ResourceURI)
	require.Equal(t, "producer", definition.ResolvedIdentity.ProviderIdentity)
	require.Equal(t, 1, remote.reads)
	require.Positive(t, remote.filters)
	require.Zero(t, unrelatedCalls, "an exact DSPUI URI must skip the Data Studio namespace root")
	firstFilters := remote.filters
	for i := 0; i < 100; i++ {
		cached, err := reader.Load(alice, "mcp://dspui/platform")
		require.NoError(t, err)
		require.Equal(t, definition.ResolvedIdentity, cached.ResolvedIdentity)
	}
	require.Equal(t, 1, remote.reads, "stable user-scoped source proof should retain the canonical definition")
	require.Equal(t, firstFilters, remote.filters, "warm canonical URI selection must not relist producer metadata")
	require.Equal(t, 1, remote.initializes, "warm definition loads must reuse negotiated capabilities")
	require.Zero(t, remote.discovers)
	require.NotNil(t, remote.handler)
	remote.handler.OnNotification(context.Background(), &jsonrpc.Notification{Method: "notifications/resources/updated", Params: json.RawMessage(`{"uri":"mcp://dspui/platform"}`)})
	beforeUpdate := remote.filters
	_, err = reader.Load(alice, "mcp://dspui/platform")
	require.NoError(t, err)
	require.Greater(t, remote.filters, beforeUpdate, "source content update must invalidate the selection memo")
	beforeReconnect := remote.filters
	_, err = mgr.Reconnect(alice, "", "owned")
	require.NoError(t, err)
	_, err = reader.Load(alice, "mcp://dspui/platform")
	require.NoError(t, err)
	require.Greater(t, remote.filters, beforeReconnect, "connection replacement must relist the owning provider")
	rotated := authctx.WithIDToken(alice, "fixture-rotated-credential")
	_, err = reader.Load(rotated, "mcp://dspui/platform")
	require.NoError(t, err)
	require.Greater(t, remote.filters, firstFilters, "credential change must relist the source")
	beforeRevision := remote.filters
	identityRevision = "v2"
	_, err = reader.Load(alice, "mcp://dspui/platform")
	require.NoError(t, err)
	require.Greater(t, remote.filters, beforeRevision, "verified identity revision must relist the source")
	// Bob's visible catalog is different and cannot reuse Alice's selection.
	remote.denied = true
	_, err = reader.Load(bob, "mcp://dspui/platform")
	require.Error(t, err)
	require.Zero(t, unrelatedCalls)
	remote.denied = false
	// A normal window query still uses the full-kind namespace index. Its
	// unrelated resource remains visible once the producer allows that query.
	remote.allowGeneric = true
	provider.names = []string{"owned"}
	rows, err := g.List(alice, "window", "dspui")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "window://dspui/other", rows[0].Resource.URI)
	readerWithOverlap, err := NewMCPReferenceReader(g, MCPDefinitionSource{ConnectionName: "configuration", ProviderIdentity: "configuration", Namespace: "workspace"}, []identity.ResourceRef{{URI: "mcp://workspace/owned"}, {URI: "mcp://workspace/overlap"}})
	require.NoError(t, err)
	_, err = readerWithOverlap.Load(alice, "mcp://dspui/platform")
	require.ErrorIs(t, err, ErrCollision, "same canonical URI from two eligible owners must remain ambiguous")
	// Configuration readers may use a fixed public actor. Distinct caller
	// credentials must coexist under that actor rather than evicting each
	// other's proven URI-to-owner selection on alternating requests.
	g.Actor, g.Verify = PublicReadActors()
	publicReader, err := NewMCPReferenceReader(g, MCPDefinitionSource{ConnectionName: "configuration", ProviderIdentity: "configuration", Namespace: "workspace"}, []identity.ResourceRef{{URI: "mcp://workspace/owned"}})
	require.NoError(t, err)
	credentialA := authctx.WithIDToken(alice, "fixture-credential-a")
	credentialB := authctx.WithIDToken(alice, "fixture-credential-b")
	_, err = publicReader.Load(credentialA, "mcp://dspui/platform")
	require.NoError(t, err)
	_, err = publicReader.Load(credentialB, "mcp://dspui/platform")
	require.NoError(t, err)
	filtersAfterBoth := remote.filters
	_, err = publicReader.Load(credentialA, "mcp://dspui/platform")
	require.NoError(t, err)
	require.Equal(t, filtersAfterBoth, remote.filters, "returning to an authorized credential must reuse its own selection")
	require.Len(t, publicReader.memo, 2)
}
