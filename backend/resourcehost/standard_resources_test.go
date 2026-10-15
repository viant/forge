package resource

import (
	"context"
	"strconv"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	protocolserver "github.com/viant/mcp-protocol/server"
	mcpclient "github.com/viant/mcp/client"
	mcpserver "github.com/viant/mcp/server"
)

type changingStandardResources struct {
	mcpclient.Interface
	hideNavigation *atomic.Bool
	pageSize       int
}

func (c *changingStandardResources) ListResources(ctx context.Context, cursor *string, options ...mcpclient.RequestOption) (*schema.ListResourcesResult, error) {
	serverCursor := cursor
	if c.pageSize > 0 {
		serverCursor = nil
	}
	listed, err := c.Interface.ListResources(ctx, serverCursor, options...)
	if err != nil || !c.hideNavigation.Load() {
		if err != nil || c.pageSize == 0 {
			return listed, err
		}
	}
	copy := *listed
	if c.hideNavigation.Load() {
		copy.Resources = nil
		for _, entry := range listed.Resources {
			if entry.Uri != "navigation://studio/main" {
				copy.Resources = append(copy.Resources, entry)
			}
		}
	}
	if c.pageSize > 0 {
		total := len(copy.Resources)
		start := 0
		if cursor != nil {
			var parseErr error
			start, parseErr = strconv.Atoi(*cursor)
			if parseErr != nil || start < 0 || start >= len(copy.Resources) {
				return nil, identity.ErrResource
			}
		}
		end := min(start+c.pageSize, total)
		copy.Resources = append([]schema.Resource(nil), copy.Resources[start:end]...)
		copy.NextCursor = nil
		if end < total {
			next := strconv.Itoa(end)
			copy.NextCursor = &next
		}
	}
	return &copy, nil
}

func TestStandardMCPResourcesDrivePrimitiveListAndRead(t *testing.T) {
	ctx := context.Background()
	var denied atomic.Bool
	handler := protocolserver.WithDefaultHandler(ctx, func(h *protocolserver.DefaultHandler) error {
		for uri, resource := range map[string]struct{ body, mime string }{
			"window://studio/orders":   {`{"title":"Orders","view":{"content":{"id":"orders"}},"dataSource":{}}`, "application/json"},
			"navigation://studio/main": {`{"schemaVersion":1,"applications":[{"id":"studio","title":"Studio","menus":[]}]}`, "application/json"},
			"mcp://studio/catalog":     {"name: catalog\ntransport:\n  type: streamable\n  url: https://example.test/mcp\n", "application/yaml"},
		} {
			uri, resource := uri, resource
			mime := resource.mime
			if err := h.Registry.RegisterResource(schema.Resource{Uri: uri, Name: uri, MimeType: &mime}, func(_ context.Context, request *schema.ReadResourceRequest) (*schema.ReadResourceResult, *jsonrpc.Error) {
				if denied.Load() || request.Params.Uri != uri {
					return nil, jsonrpc.NewInvalidParamsError("resource unavailable", nil)
				}
				return &schema.ReadResourceResult{ResultType: schema.ResultTypeComplete, Contents: []schema.ReadResourceResultContentsElem{{Uri: uri, MimeType: &mime, Text: resource.body}}}, nil
			}); err != nil {
				return err
			}
		}
		return nil
	})
	server, err := mcpserver.New(mcpserver.WithNewHandler(handler))
	require.NoError(t, err)
	var hideNavigation atomic.Bool
	mgr, err := manager.New(fixtureOptions{"studio": {ClientOptions: &mcp.ClientOptions{}}}, manager.WithClientFactory(func(ctx context.Context, _, _ string) (mcpclient.Interface, error) {
		return &changingStandardResources{Interface: server.AsClient(ctx), hideNavigation: &hideNavigation, pageSize: 1}, nil
	}))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	actor, verify := PublicReadActors()
	gateway := NewGateway(mgr, actor, verify, "consumer")
	t.Cleanup(gateway.Close)
	readCtx, finish, err := gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	sequenced, err := gateway.List(readCtx, "window", "studio")
	require.NoError(t, err)
	require.Len(t, sequenced, 1)
	require.NoError(t, finish(), "a zero cache TTL must not expire the actor's read lease")
	rows, err := gateway.List(ctx, "window", "studio")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "window://studio/orders", rows[0].Resource.URI)
	got, err := Get[map[string]any](ctx, gateway, rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, nil)
	require.NoError(t, err)
	require.Equal(t, "Orders", got.Definition["title"])
	menus, err := gateway.List(ctx, "navigation", "studio")
	require.NoError(t, err)
	require.Len(t, menus, 1)
	hideNavigation.Store(true)
	menus, err = gateway.List(ctx, "navigation", "studio")
	require.NoError(t, err)
	require.Empty(t, menus, "ttlMs:0 must not retain an obsolete standard resource list")
	configuration, err := Get[map[string]any](ctx, gateway, rows[0].Connection, identity.ResourceRef{URI: "mcp://studio/catalog"}, nil)
	require.NoError(t, err)
	require.Equal(t, "catalog", configuration.Definition["name"])
	denied.Store(true)
	_, err = Get[map[string]any](ctx, gateway, rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, nil)
	require.Error(t, err, "owning MCP's standard resources/read denial must remain terminal")
}
