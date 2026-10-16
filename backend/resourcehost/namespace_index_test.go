package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"sort"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp"
	namespaces "github.com/viant/mcp-protocol/extension/namespaces"
	"github.com/viant/mcp-protocol/schema"
	protocolserver "github.com/viant/mcp-protocol/server"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
	mcpserver "github.com/viant/mcp/server"
)

type namespaceIndexTestProvider struct{ options *cfg.MCPClient }

func (p namespaceIndexTestProvider) Options(context.Context, string) (*cfg.MCPClient, error) {
	return p.options, nil
}
func (p namespaceIndexTestProvider) Names(context.Context) ([]string, error) {
	return []string{"index"}, nil
}

type namespaceIndexCounters struct {
	personal              atomic.Bool
	standardRead          atomic.Bool
	list, get, definition atomic.Int32
	malformed, denied     atomic.Bool
}

func namespaceIndexServer(t *testing.T, counts *namespaceIndexCounters, extra ...map[string]json.RawMessage) *mcpserver.Server {
	first, _ := namespaces.URI("opaque/Group A")
	second, _ := namespaces.URI("Opaque Group B")
	catalog := []namespaces.Namespace{{URI: first, Name: "Not a resource authority"}, {URI: second, Name: "Also a display label"}}
	inventories := map[string][]namespaces.Resource{
		first:  {{URI: "window://remote/sales", Kind: "window", Name: "Sales authored title", MimeType: "application/json"}, {URI: "intent://remote/start", Kind: "intent", Name: "Start"}, {URI: "lookup://remote/orders", Kind: "lookup", Name: "Order lookup"}},
		second: {{URI: "window://separate/help", Kind: "window", Name: "Help"}, {URI: "mcp://separate/catalog", Kind: "mcp", Name: "Connection catalog"}},
	}
	definitions := map[string]json.RawMessage{
		"window://remote/sales":  json.RawMessage(`{"title":"Sales authored title","windowKey":"sales","view":{"content":{"id":"original","text":"Original content"}},"dataSource":{}}`),
		"window://separate/help": json.RawMessage(`{"title":"Help","view":{"content":{"id":"help"}},"dataSource":{}}`),
		"intent://remote/start":  json.RawMessage(`{"id":"start","name":"Start","enabled":true}`),
		"lookup://remote/orders": json.RawMessage(`{"id":"orders","target":{},"bindings":[]}`),
		"mcp://separate/catalog": json.RawMessage(`{"name":"catalog","transport":{"type":"streamable","url":"https://example.test/mcp"}}`),
	}
	for _, configured := range extra {
		for uri, raw := range configured {
			parsed, err := identity.ParseResourceURI(uri)
			require.NoError(t, err)
			definitions[uri] = raw
			inventories[first] = append(inventories[first], namespaces.Resource{URI: uri, Kind: parsed.Kind, Name: parsed.Name, Description: "Authored Studio management fixture", MimeType: "application/json"})
		}
	}
	for uri := range inventories {
		sort.Slice(inventories[uri], func(i, j int) bool { return inventories[uri][i].URI < inventories[uri][j].URI })
	}
	result := func(v any) (*schema.CallToolResult, *jsonrpc.Error) {
		raw, err := json.Marshal(v)
		if err != nil {
			return nil, &jsonrpc.Error{Code: -32603, Message: err.Error()}
		}
		return &schema.CallToolResult{Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: string(raw)}}}, nil
	}
	handler := protocolserver.WithDefaultHandler(context.Background(), func(h *protocolserver.DefaultHandler) error {
		if err := protocolserver.RegisterTool[namespaces.ListRequest, namespaces.ListResult](h.Registry, namespaces.ListToolName, "List accessible namespaces", func(ctx context.Context, in namespaces.ListRequest) (*schema.CallToolResult, *jsonrpc.Error) {
			counts.list.Add(1)
			rows, next, err := namespaces.Paginate(catalog, in.Cursor, 1)
			if err != nil {
				return nil, &jsonrpc.Error{Code: -32602, Message: err.Error()}
			}
			return result(namespaces.ListResult{Namespaces: rows, NextCursor: next})
		}); err != nil {
			return err
		}
		if err := protocolserver.RegisterTool[namespaces.GetRequest, namespaces.GetResult](h.Registry, namespaces.GetToolName, "List namespace resources", func(ctx context.Context, in namespaces.GetRequest) (*schema.CallToolResult, *jsonrpc.Error) {
			counts.get.Add(1)
			if counts.malformed.Load() {
				return result(map[string]any{"namespace": catalog[0]})
			}
			rows, ok := inventories[in.URI]
			if !ok {
				return nil, &jsonrpc.Error{Code: -32602, Message: "exact opaque namespace locator required"}
			}
			if in.Kind != "" {
				return nil, &jsonrpc.Error{Code: -32602, Message: "discovery must obtain a complete index, not separate per-kind catalogs"}
			}
			page, next, err := namespaces.Paginate(rows, in.Cursor, 1)
			if err != nil {
				return nil, &jsonrpc.Error{Code: -32602, Message: err.Error()}
			}
			return result(namespaces.GetResult{Resources: page, NextCursor: next})
		}); err != nil {
			return err
		}
		if counts.standardRead.Load() {
			mime := "application/json"
			for uri, definition := range definitions {
				uri, definition := uri, definition
				if err := h.Registry.RegisterResource(schema.Resource{Uri: uri, Name: uri, MimeType: &mime}, func(ctx context.Context, request *schema.ReadResourceRequest) (*schema.ReadResourceResult, *jsonrpc.Error) {
					counts.definition.Add(1)
					if counts.denied.Load() || request.Params.Uri != uri {
						return nil, jsonrpc.NewInvalidParamsError("resource unavailable", nil)
					}
					return &schema.ReadResourceResult{ResultType: schema.ResultTypeComplete, Contents: []schema.ReadResourceResultContentsElem{{Uri: uri, MimeType: &mime, Text: string(definition)}}}, nil
				}); err != nil {
					return err
				}
			}
			return nil
		}
		return protocolserver.RegisterTool[namespaces.ResourceGetRequest, struct{}](h.Registry, namespaces.ResourceGetToolName, "Read exact definition", func(ctx context.Context, in namespaces.ResourceGetRequest) (*schema.CallToolResult, *jsonrpc.Error) {
			counts.definition.Add(1)
			if counts.denied.Load() {
				yes := true
				return &schema.CallToolResult{IsError: &yes, Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: "Owning MCP denied"}}}, nil
			}
			raw, ok := definitions[in.URI]
			if counts.personal.Load() {
				value := map[string]any{}
				_ = json.Unmarshal(raw, &value)
				value["owner"] = authctx.EffectiveUserID(ctx)
				raw, _ = json.Marshal(value)
			}
			if !ok {
				return nil, &jsonrpc.Error{Code: -32602, Message: "missing"}
			}
			return result(raw)
		})
	})
	server, err := mcpserver.New(mcpserver.WithImplementation(schema.Implementation{Name: "index-only", Version: "1"}), mcpserver.WithStreamableURI("/mcp"), mcpserver.WithRootRedirect(false), mcpserver.WithNewHandler(handler))
	require.NoError(t, err)
	return server
}

func TestSharedNamespaceIndexUsesRealMCPWithoutKindToolsOrAuthoringMetadata(t *testing.T) {
	for _, transport := range []string{"memory", "http"} {
		t.Run(transport, func(t *testing.T) {
			counts := &namespaceIndexCounters{}
			server := namespaceIndexServer(t, counts)
			var mgr *manager.Manager
			var err error
			if transport == "memory" {
				mgr, err = manager.New(nil)
				require.NoError(t, err)
				require.NoError(t, mgr.RegisterLocal(context.Background(), "index", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "index"}, func(ctx context.Context) (mcpclient.Interface, error) { return server.AsClient(ctx), nil }))
			} else {
				server.UseStreamableHTTP(true)
				httpServer := httptest.NewServer(server.HTTP(context.Background(), "").Handler)
				t.Cleanup(httpServer.Close)
				mgr, err = manager.New(namespaceIndexTestProvider{&cfg.MCPClient{ClientOptions: &mcp.ClientOptions{ProtocolVersion: "2025-11-25", Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: httpServer.URL + "/mcp"}}}}})
				require.NoError(t, err)
			}
			t.Cleanup(func() { mgr.CloseConversation("") })
			actor, verify := PublicReadActors()
			gateway := NewGateway(mgr, actor, verify, "consumer")
			t.Cleanup(gateway.Close)
			rows, err := ListPage[json.RawMessage](context.Background(), gateway, "window", CatalogQuery{Limit: 1})
			require.NoError(t, err)
			require.Len(t, rows.Items, 1)
			require.False(t, rows.Complete)
			require.EqualValues(t, 2, counts.list.Load())
			require.EqualValues(t, 5, counts.get.Load())
			require.Zero(t, counts.definition.Load())
			next, err := ListPage[json.RawMessage](context.Background(), gateway, "window", CatalogQuery{Limit: 1, Cursor: rows.NextCursor})
			require.NoError(t, err)
			require.Len(t, next.Items, 1)
			require.True(t, next.Complete)
			intents, err := ListPage[json.RawMessage](context.Background(), gateway, "intent", CatalogQuery{Limit: 10})
			require.NoError(t, err)
			require.Len(t, intents.Items, 1)
			require.EqualValues(t, 2, counts.list.Load(), "per-kind cached discovery must not enumerate namespace pages again")
			require.EqualValues(t, 5, counts.get.Load(), "no redundant kind-list calls")
			located := rows.Items[0]
			if located.Resource.URI != "window://remote/sales" {
				located = next.Items[0]
			}
			require.Equal(t, "sales", located.Resource.Name)
			require.Equal(t, "Sales authored title", located.Resource.Title)
			require.Equal(t, "application/json", located.Resource.MimeType)
			require.Equal(t, "remote", located.Resource.Namespace)
			got, err := Get[json.RawMessage](context.Background(), gateway, located.Connection, identity.ResourceRef{URI: located.Resource.URI}, nil)
			require.NoError(t, err)
			require.Contains(t, string(got.Definition), "Original content")
			require.Empty(t, got.ResolvedResource.AuthorityBinding)
			require.True(t, got.ResolvedResource.ValidUntil.IsZero())
			require.Nil(t, got.ExecutionProof)
			again, err := Get[json.RawMessage](context.Background(), gateway, located.Connection, identity.ResourceRef{URI: located.Resource.URI}, got.ResolvedResource)
			require.NoError(t, err)
			require.JSONEq(t, string(got.Definition), string(again.Definition))
			require.EqualValues(t, 2, counts.definition.Load(), "a separate pinned working read reaches the owner")
			proof, err := types.NewWindowTargetHMAC(bytes.Repeat([]byte{7}, 32))
			require.NoError(t, err)
			catalog := &WindowCatalog{Gateway: gateway, TargetProof: proof}
			window, err := catalog.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: located.Resource.URI, Resource: &identity.ResourceRef{URI: located.Resource.URI}, ProviderIdentity: located.Connection.ProviderIdentity})
			require.NoError(t, err)
			require.Equal(t, "Sales authored title", window.Definition.Title)
			require.NotEmpty(t, window.Definition.ResourceTarget.SelectionToken)
			require.EqualValues(t, 3, counts.definition.Load(), "window delivery obtains a fresh working definition")
			counts.denied.Store(true)
			_, err = Get[json.RawMessage](context.Background(), gateway, Connection{Name: "index", ProviderIdentity: "index", Generation: gateway.generation("index")}, identity.ResourceRef{URI: "window://separate/help"}, nil)
			require.ErrorIs(t, err, identity.ErrResourceDenied, "owning denial must be terminal")
		})
	}
}

func TestSharedNamespaceIndexReadsDefinitionsThroughStandardMCPResources(t *testing.T) {
	ctx := context.Background()
	counts := &namespaceIndexCounters{}
	counts.standardRead.Store(true)
	server := namespaceIndexServer(t, counts)
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(ctx, "index", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "index"}, func(ctx context.Context) (mcpclient.Interface, error) { return server.AsClient(ctx), nil }))
	t.Cleanup(func() { mgr.CloseConversation("") })
	actor, verify := PublicReadActors()
	gateway := NewGateway(mgr, actor, verify, "consumer")
	t.Cleanup(gateway.Close)
	rows, err := gateway.List(ctx, "window", "remote")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	located := rows[0]
	got, err := Get[json.RawMessage](ctx, gateway, located.Connection, identity.ResourceRef{URI: located.Resource.URI}, nil)
	require.NoError(t, err)
	require.Contains(t, string(got.Definition), "Original content")
	require.EqualValues(t, 1, counts.definition.Load(), "standard resources/read must deliver the selected definition")
	counts.denied.Store(true)
	_, err = Get[json.RawMessage](ctx, gateway, located.Connection, identity.ResourceRef{URI: located.Resource.URI}, nil)
	require.Error(t, err, "owning resources/read denial must remain terminal")
}

func TestSharedNamespaceIndexMissingResourcesNeverLooksComplete(t *testing.T) {
	counts := &namespaceIndexCounters{}
	counts.malformed.Store(true)
	server := namespaceIndexServer(t, counts)
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(context.Background(), "index", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "index"}, func(ctx context.Context) (mcpclient.Interface, error) { return server.AsClient(ctx), nil }))
	actor, verify := PublicReadActors()
	gateway := NewGateway(mgr, actor, verify, "consumer")
	defer gateway.Close()
	_, err = ListPage[json.RawMessage](context.Background(), gateway, "window", CatalogQuery{Limit: 10})
	require.Error(t, err)
	counts.malformed.Store(false)
	rows, err := ListPage[json.RawMessage](context.Background(), gateway, "window", CatalogQuery{Limit: 10})
	require.NoError(t, err)
	require.Len(t, rows.Items, 2, "malformed partial index must not be cached as empty/complete")
}

func TestSharedNamespaceIndexDeliversAuthoredStudioWindowAndDatasource(t *testing.T) {
	windowRaw, err := os.ReadFile("testdata/namespace-index/studio-window.json")
	require.NoError(t, err)
	datasourceRaw, err := os.ReadFile("testdata/namespace-index/studio-datasource.json")
	require.NoError(t, err)
	server := namespaceIndexServer(t, &namespaceIndexCounters{}, map[string]json.RawMessage{"window://dstudio/namespaces": windowRaw, "datasource://dstudio/namespaces": datasourceRaw})
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(context.Background(), "index", &cfg.MCPClient{PrimitiveProviderIdentity: "studio-management", ClientOptions: &mcp.ClientOptions{}}, func(ctx context.Context) (mcpclient.Interface, error) { return server.AsClient(ctx), nil }))
	actor, verify := PublicReadActors()
	gateway := NewGateway(mgr, actor, verify, "consumer")
	defer gateway.Close()
	proof, err := types.NewWindowTargetHMAC(bytes.Repeat([]byte{7}, 32))
	require.NoError(t, err)
	catalog := &WindowCatalog{Gateway: gateway, TargetProof: proof}
	got, err := catalog.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: "window://dstudio/namespaces", ProviderIdentity: "studio-management"})
	require.NoError(t, err)
	require.Equal(t, "namespaces", got.Definition.WindowKey)
	require.Equal(t, "Namespaces", got.Definition.View.Content.Title)
	require.NotEmpty(t, got.Definition.ResourceTarget.SelectionToken)
	require.Len(t, got.Definition.ResourceTarget.DependencyPins, 1)
	require.Empty(t, got.Definition.Resource.AuthorityBinding, "no managing authorization receipt invented")
	projected := got.Definition.DataSource["namespaces"]
	require.Equal(t, "agentlyAPI", projected.Service.Endpoint)
	require.Equal(t, "/v1/api/datasources/namespaces/fetch", projected.Service.URI)
	child, err := gateway.GetForProvider(context.Background(), "studio-management", identity.ResourceRef{URI: "datasource://dstudio/namespaces"}, nil)
	require.NoError(t, err)
	definition, err := DecodeDatasourceDefinition(child.Resource.Definition)
	require.NoError(t, err)
	require.Equal(t, "studio-management", definition.Backend.Service)
	require.Equal(t, "studio.sdk.namespaces.list", definition.Backend.Method)
	require.Equal(t, "items", definition.Selectors.Data)
	require.EqualValues(t, 25, definition.Paging.Size)
}

func TestSharedNamespaceIndexWorkingDefinitionReadsStayPerUser(t *testing.T) {
	counts := &namespaceIndexCounters{}
	counts.personal.Store(true)
	server := namespaceIndexServer(t, counts)
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(context.Background(), "index", &cfg.MCPClient{PrimitiveProviderIdentity: "index", ClientOptions: &mcp.ClientOptions{}}, func(ctx context.Context) (mcpclient.Interface, error) { return server.AsClient(ctx), nil }))
	actor, verify := PublicReadActors()
	gateway := NewGateway(mgr, actor, verify, "consumer")
	defer gateway.Close()
	for _, subject := range []string{"alice", "bob", "alice"} {
		ctx := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: subject})
		located, err := gateway.ConnectionForResource(ctx, identity.ResourceURI{Kind: "window", Namespace: "remote", Name: "sales"}, "index")
		require.NoError(t, err)
		got, err := Get[map[string]any](ctx, gateway, located, identity.ResourceRef{URI: "window://remote/sales"}, nil)
		require.NoError(t, err)
		require.Equal(t, subject, got.Definition["owner"], "raw definitions retain existing manager principal partitions")
	}
	require.EqualValues(t, 3, counts.definition.Load(), "each working read reaches its owner with the current user")
}
