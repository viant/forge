package resource

import (
	"context"
	"encoding/json"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp"
	namespaces "github.com/viant/mcp-protocol/extension/namespaces"
	"github.com/viant/mcp-protocol/schema"
	protocolserver "github.com/viant/mcp-protocol/server"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	mcpserver "github.com/viant/mcp/server"
)

type descriptionCollection struct {
	namespace namespaces.Namespace
	resources []namespaces.Resource
}

// Synthetic opaque collections deliberately do not resemble resource authorities.
func TestNamespaceIndexPreservesOnlyUnambiguousCollectionDescription(t *testing.T) {
	const description = "Inspect delivery and outcome summaries.\nPreserve source units."
	first := descriptionCollection{namespace: namespaces.Namespace{URI: "ns://opaque_a", Name: "A display label", Description: description}, resources: []namespaces.Resource{{URI: "window://alpha/one", Kind: "window", Name: "One"}, {URI: "intent://alpha/start", Kind: "intent", Name: "Start"}}}
	second := descriptionCollection{namespace: namespaces.Namespace{URI: "ns://opaque_b", Name: "Another display label", Description: "Different analytical guidance."}, resources: []namespaces.Resource{{URI: "window://alpha/two", Kind: "window", Name: "Two"}}}
	same := second
	same.namespace.Description = description
	multi := first
	multi.resources = append(append([]namespaces.Resource{}, first.resources...), namespaces.Resource{URI: "window://beta/three", Kind: "window", Name: "Three"})
	for _, tc := range []struct {
		name        string
		collections []descriptionCollection
		allowed     []string
		want        map[string]string
	}{
		{name: "opaque collection with paged resource membership", collections: []descriptionCollection{first}, want: map[string]string{"alpha": description}},
		{name: "matching contributor descriptions are preserved", collections: []descriptionCollection{first, same}, want: map[string]string{"alpha": description}},
		{name: "conflicting collections do not choose a description", collections: []descriptionCollection{first, second}, want: map[string]string{"alpha": ""}},
		{name: "multiple authorities do not inherit collection description", collections: []descriptionCollection{multi}, want: map[string]string{"alpha": "", "beta": ""}},
		{name: "filtered collection cannot affect description", collections: []descriptionCollection{first, second}, allowed: []string{first.namespace.URI}, want: map[string]string{"alpha": description}},
		{name: "denied collection returns no namespace metadata", collections: []descriptionCollection{first}, allowed: []string{"ns://other"}, want: map[string]string{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := t.Context()
			var mu sync.Mutex
			gets := map[string]int{}
			result := func(value any) (*schema.CallToolResult, *jsonrpc.Error) {
				raw, err := json.Marshal(value)
				require.NoError(t, err)
				return &schema.CallToolResult{Content: []schema.CallToolResultContentElem{schema.TextContent{Type: "text", Text: string(raw)}}}, nil
			}
			factory := protocolserver.WithDefaultHandler(ctx, func(handler *protocolserver.DefaultHandler) error {
				if err := protocolserver.RegisterTool[namespaces.ListRequest, namespaces.ListResult](handler.Registry, namespaces.ListToolName, "List visible collections", func(_ context.Context, in namespaces.ListRequest) (*schema.CallToolResult, *jsonrpc.Error) {
					rows := make([]namespaces.Namespace, 0, len(tc.collections))
					for _, collection := range tc.collections {
						rows = append(rows, collection.namespace)
					}
					page, next, err := namespaces.Paginate(rows, in.Cursor, 1)
					require.NoError(t, err)
					return result(namespaces.ListResult{Namespaces: page, NextCursor: next})
				}); err != nil {
					return err
				}
				return protocolserver.RegisterTool[namespaces.GetRequest, namespaces.GetResult](handler.Registry, namespaces.GetToolName, "Read a visible collection index", func(_ context.Context, in namespaces.GetRequest) (*schema.CallToolResult, *jsonrpc.Error) {
					mu.Lock()
					gets[in.URI]++
					mu.Unlock()
					for _, collection := range tc.collections {
						if collection.namespace.URI == in.URI {
							page, next, err := namespaces.Paginate(collection.resources, in.Cursor, 1)
							require.NoError(t, err)
							return result(namespaces.GetResult{Namespace: &collection.namespace, Resources: page, NextCursor: next})
						}
					}
					return nil, jsonrpc.NewInvalidParamsError("unknown collection", nil)
				})
			})
			server, err := mcpserver.New(mcpserver.WithImplementation(schema.Implementation{Name: "namespace-description-fixture", Version: "1"}), mcpserver.WithNewHandler(factory))
			require.NoError(t, err)
			pool, err := manager.New(nil)
			require.NoError(t, err)
			require.NoError(t, pool.RegisterLocal(ctx, "catalog", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "producer", PrimitiveNamespaces: tc.allowed}, func(ctx context.Context) (mcpclient.Interface, error) { return server.AsClient(ctx), nil }))
			t.Cleanup(func() { pool.CloseConversation("") })
			actor, verify := PublicReadActors()
			gateway := NewGateway(pool, actor, verify, "consumer")
			t.Cleanup(gateway.Close)
			discovered, err := gateway.Discover(ctx)
			require.NoError(t, err)
			got := map[string]string{}
			for _, namespace := range discovered {
				got[namespace.Namespace] = namespace.Description
			}
			require.Equal(t, tc.want, got)
			if len(tc.allowed) > 0 {
				for _, collection := range tc.collections {
					if collection.namespace.URI != tc.allowed[0] {
						require.Zero(t, gets[collection.namespace.URI], "excluded collections must not be fetched")
					}
				}
			}
		})
	}
}

func TestLegacyNamespaceIndexPreservesDescription(t *testing.T) {
	raw := json.RawMessage(`{"providerIdentity":"producer","complete":true,"namespaces":[{"name":"example","uri":"ns://opaque_collection","description":"Keep the producer's exact description."}]}`)
	decoded, err := decodeCollectionIndex(raw, []string{"producer"})
	require.NoError(t, err)
	require.Len(t, decoded.Namespaces, 1)
	require.Equal(t, "Keep the producer's exact description.", decoded.Namespaces[0].Description)
}
