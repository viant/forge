package resource

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

type genericWindow struct {
	SchemaVersion int `json:"schemaVersion"`
	View          struct {
		Title string `json:"title"`
	} `json:"view"`
}

func TestGenericGatewaySharedStateAndTypedDefinition(t *testing.T) {
	p := provider("original")
	gateway, actor, revoked := fixtureGateway(t, map[string]*fixtureProvider{"shared": p})
	defer gateway.Close()
	ctx := context.Background()
	rows, err := List[genericWindow](ctx, gateway, "window", "example")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	ref := identity.ResourceRef{URI: rows[0].Resource.URI}
	typed, err := Get[genericWindow](ctx, gateway, rows[0].Connection, ref, nil)
	require.NoError(t, err)
	require.Equal(t, "Sales", typed.Definition.View.Title)
	raw, err := Get[json.RawMessage](ctx, gateway, rows[0].Connection, ref, typed.ResolvedResource)
	require.NoError(t, err)
	require.Equal(t, p.definition, raw.Definition)
	require.Equal(t, typed.ResolvedResource, raw.ResolvedResource)
	gateway.mu.Lock()
	require.Len(t, gateway.cache, 1, "type instantiations share one actor cache")
	gateway.mu.Unlock()
	actor.Subject = "bob"
	_, err = List[json.RawMessage](ctx, gateway, "window", "example")
	require.NoError(t, err)
	gateway.mu.Lock()
	require.Len(t, gateway.cache, 2, "different actors retain isolated capability entries")
	gateway.mu.Unlock()
	*revoked = true
	denied, err := Get[genericWindow](ctx, gateway, rows[0].Connection, ref, nil)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Nil(t, denied)
}

func TestGenericGatewaySignedInActorPublicUpstreamHTTP(t *testing.T) {
	provider, _, actor, _ := localFixture(t)
	var mu sync.Mutex
	calls := 0
	handler, err := NewMCPHandler(provider, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "" {
				t.Error("public upstream received unexpected auth header")
			}
			mu.Lock()
			calls++
			mu.Unlock()
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), localTestRequest{}, true)))
		})
	})
	require.NoError(t, err)
	server := httptest.NewServer(handler)
	defer server.Close()
	options := fixtureOptions{"public": {ClientOptions: &mcp.ClientOptions{Name: "public", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}}}}
	mgr, err := manager.New(options)
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer gateway.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	rows, err := List[json.RawMessage](ctx, gateway, "window", "team")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			got, err := Get[map[string]any](ctx, gateway, rows[0].Connection, identity.ResourceRef{URI: rows[0].Resource.URI}, nil)
			if err != nil || got == nil {
				t.Errorf("typed public read: %v", err)
			}
		}()
	}
	wg.Wait()
	mu.Lock()
	require.Positive(t, calls)
	mu.Unlock()
	// Public MCP transport does not turn an unsigned workspace request into an actor.
	actor.ValidUntil = time.Now().Add(-time.Second)
	denied, err := List[json.RawMessage](ctx, gateway, "window", "team")
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Nil(t, denied)
}

type genericPagedClient struct {
	mcpclient.Interface
	paged     bool
	mu        sync.Mutex
	positions []any
}

func (c *genericPagedClient) CallTool(ctx context.Context, r *schema.CallToolRequestParams, options ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	if r.Name != "windows/list" {
		return c.Interface.CallTool(ctx, r, options...)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.positions = append(c.positions, r.Arguments["cursor"])
	name := "first"
	complete := true
	next := ""
	if c.paged && r.Arguments["cursor"] == nil {
		complete = false
		next = "opaque"
	}
	if r.Arguments["cursor"] == "opaque" {
		name = "second"
	}
	out := map[string]any{"windows": []map[string]any{{"uri": "window://example/" + name}}, "complete": complete}
	if next != "" {
		out["nextCursor"] = next
	}
	return &schema.CallToolResult{StructuredContent: out}, nil
}
func TestGenericGatewayOptionalPagination(t *testing.T) {
	for _, paged := range []bool{false, true} {
		t.Run(map[bool]string{false: "one-page", true: "cursor-pages"}[paged], func(t *testing.T) {
			p := provider("original")
			original, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"upstream": p})
			defer original.Close()
			client := &genericPagedClient{Interface: p, paged: paged}
			mgr, err := manager.New(fixtureOptions{"upstream": {}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return client, nil }))
			require.NoError(t, err)
			defer mgr.CloseConversation("")
			gateway := NewGateway(mgr, original.Actor, original.Verify, "gateway")
			defer gateway.Close()
			rows, err := List[json.RawMessage](context.Background(), gateway, "window", "example")
			require.NoError(t, err)
			expected := 1
			if paged {
				expected = 2
			}
			require.Len(t, rows, expected)
			require.Equal(t, expected, len(client.positions))
			require.Nil(t, client.positions[0], "optional cursor omitted on first page")
			if paged {
				require.Equal(t, "opaque", client.positions[1])
			}
		})
	}
}
