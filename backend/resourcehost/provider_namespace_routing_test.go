package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
	client "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"testing"
	"time"
)

func TestPublishedProviderNamespacesRouteIndependently(t *testing.T) {
	g, _, trap, _ := publishedFixture(t)
	raw := json.RawMessage(`{"name":"secondary","transport":{"type":"streamable","url":"https://example.invalid/mcp"}}`)
	uri := "mcp://secondary/data"
	other := &syntheticPublishedSource{owner: "publisher", namespace: "secondary", states: map[string]primitive.ResourceState{
		uri: {URI: uri, Kind: "mcp", Namespace: "secondary", Name: "data", FormatVersion: 1, DefinitionBytes: raw, ContentFingerprint: identity.ContentFingerprint(raw)},
	}}
	require.NoError(t, g.RegisterPublishedMetadataSource(Connection{Name: "second", ProviderIdentity: "publisher"}, []string{"secondary"}, other))
	all, err := g.Discover(context.Background())
	require.NoError(t, err)
	require.Len(t, all, 2)
	page, err := ListPage[json.RawMessage](context.Background(), g, "mcp", CatalogQuery{}, true)
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	for _, value := range []string{"mcp://example/sample", uri} {
		ref, err := identity.ParseResourceURI(value)
		require.NoError(t, err)
		route, err := g.ConnectionForResource(context.Background(), ref, "publisher")
		require.NoError(t, err)
		want := "catalog"
		if ref.Namespace == "secondary" {
			want = "second"
		}
		require.Equal(t, want, route.Name)
		result, err := g.GetForProvider(context.Background(), "publisher", identity.ResourceRef{URI: value}, nil)
		require.NoError(t, err)
		require.Equal(t, value, result.Resource.URI)
	}
	selected, err := ResolveDefinitionIn[json.RawMessage](context.Background(), g, "mcp", "data", DefinitionScope{ProviderIdentity: "publisher", Namespace: "secondary"}, func(json.RawMessage) string { return "data" })
	require.NoError(t, err)
	require.Equal(t, uri, selected.Resource.URI)
	_, err = g.ConnectionForProvider(context.Background(), "publisher")
	require.ErrorIs(t, err, ErrCollision, "an owner without namespace cannot select arbitrarily")
	require.ErrorIs(t, g.RegisterPublishedMetadataSource(Connection{Name: "overlap", ProviderIdentity: "publisher"}, []string{"secondary"}, other), ErrCollision)
	require.Zero(t, trap.calls, "preloaded namespace routing must remain local")
}

func TestConfiguredOwnerRoutingUsesNamespaceClaims(t *testing.T) {
	options := fixtureOptions{
		"first":  &cfg.MCPClient{PrimitiveProviderIdentity: "shared", PrimitiveNamespaces: []string{"ns://first"}},
		"second": &cfg.MCPClient{PrimitiveProviderIdentity: "shared", PrimitiveNamespaces: []string{"ns://second"}},
	}
	m, err := manager.New(options)
	require.NoError(t, err)
	defer m.CloseConversation("")
	g := NewGateway(m, nil, nil, "host")
	defer g.Close()
	for _, namespace := range []string{"first", "second"} {
		route, found, err := g.configuredOwnerNamespaceConnection(context.Background(), "shared", namespace)
		require.NoError(t, err)
		require.True(t, found)
		require.Equal(t, namespace, route.Name)
	}
	_, _, err = g.configuredOwnerConnection(context.Background(), "shared")
	require.ErrorIs(t, err, ErrCollision)
	options["second"].PrimitiveNamespaces = []string{"ns://first"}
	_, _, err = g.configuredOwnerNamespaceConnection(context.Background(), "shared", "first")
	require.ErrorIs(t, err, ErrCollision)
}

type namespaceRoutingProvider struct {
	*fixtureProvider
	owner, namespace string
}

func (p namespaceRoutingProvider) CallTool(ctx context.Context, in *schema.CallToolRequestParams, options ...client.RequestOption) (*schema.CallToolResult, error) {
	var body any
	switch in.Name {
	case "namespaces/list":
		body = primitive.NamespaceListResult{ProviderIdentity: p.owner, Namespaces: []primitive.Namespace{{Name: p.namespace, Kinds: []string{"window"}}}, Complete: true}
	case "namespaces/get":
		body = primitive.NamespaceCapabilities{ProviderIdentity: p.owner, Namespace: p.namespace, Kinds: []primitive.KindSupport{{Kind: "window", FormatVersions: []int64{2}, Operations: []string{"list", "get"}, Methods: primitive.Methods("window", []string{"list", "get"})}}}
	default:
		return p.fixtureProvider.CallTool(ctx, in, options...)
	}
	return &schema.CallToolResult{StructuredContent: body}, nil
}
func TestDiscoveredProviderNamespacesMustNotOverlap(t *testing.T) {
	for _, overlap := range []bool{false, true} {
		t.Run(map[bool]string{false: "disjoint", true: "overlap"}[overlap], func(t *testing.T) {
			second := "second"
			if overlap {
				second = "first"
			}
			options := fixtureOptions{"first": {PrimitiveProviderIdentity: "shared", PrimitiveNamespaces: []string{"first"}}, "second": {PrimitiveProviderIdentity: "shared", PrimitiveNamespaces: []string{second}}}
			m, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _ string, name string) (client.Interface, error) {
				ns := "first"
				if name == "second" {
					ns = second
				}
				return namespaceRoutingProvider{fixtureProvider: provider("shared"), owner: "shared", namespace: ns}, nil
			}))
			require.NoError(t, err)
			defer m.CloseConversation("")
			actor := identity.VerifiedActor{Issuer: "fixture", Subject: "reader", TenantID: "tenant", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Hour)}
			g := NewGateway(m, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "host")
			defer g.Close()
			rows, err := g.Discover(context.Background())
			if overlap {
				require.ErrorIs(t, err, ErrCollision)
				return
			}
			require.NoError(t, err)
			require.Len(t, rows, 2)
			for _, ns := range []string{"first", "second"} {
				route, err := g.ConnectionForResource(context.Background(), identity.ResourceURI{Kind: "window", Namespace: ns, Name: "sample"}, "shared")
				require.NoError(t, err)
				require.Equal(t, ns, route.Name)
			}
		})
	}
}
