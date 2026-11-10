package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	schema "github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
)

// Independently authored real HTTP fixtures exercise the ordinary manager pool.
func TestNativeSkillSourceReusesMetadataConnectionWithoutSharingExecution(t *testing.T) {
	var initializes atomic.Int32
	var actorChecks, rejectCheck atomic.Int32
	var executionSession string
	var mu sync.Mutex
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var request struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
		}
		if json.NewDecoder(r.Body).Decode(&request) != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		var result any
		switch request.Method {
		case "initialize":
			session := initializes.Add(1)
			w.Header().Set("Mcp-Session-Id", fmt.Sprint(session))
			result = map[string]any{"protocolVersion": "2025-11-25", "capabilities": map[string]any{"tools": map[string]any{}}, "serverInfo": map[string]any{"name": "ordinary", "version": "1"}}
		case "tools/call":
			mu.Lock()
			executionSession = r.Header.Get("Mcp-Session-Id")
			mu.Unlock()
			result = map[string]any{"content": []any{map[string]any{"type": "text", "text": "synthetic operation complete"}}}
		default:
			w.WriteHeader(http.StatusAccepted)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": request.ID, "result": result})
	}))
	defer server.Close()
	options := fixtureOptions{"ordinary": {ClientOptions: &mcp.ClientOptions{ProtocolVersion: "2025-11-25", Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL}}}}}
	mgr, err := manager.New(options)
	require.NoError(t, err)
	for _, conversation := range []string{"", "first", "second", "other-user", "execution"} {
		defer mgr.CloseConversation(conversation)
	}
	g := NewGateway(mgr, func(ctx context.Context) (identity.VerifiedActor, error) {
		return identity.VerifiedActor{Issuer: "fixture", Subject: authctx.EffectiveUserID(ctx), TenantID: "team", AccountID: "account", IdentityRevision: "current", ValidUntil: time.Now().Add(time.Minute)}, nil
	}, func(context.Context, identity.VerifiedActor) error {
		if actorChecks.Add(1) == rejectCheck.Load() {
			return identity.ErrResourceStale
		}
		return nil
	}, "aggregate")
	defer g.Close()
	source := &NativeSkillSource{Gateway: g}
	alice := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "alice"})
	warmed, err := mgr.Get(alice, "", "ordinary")
	require.NoError(t, err)
	var metadataClients []mcpclient.Interface
	for _, conversation := range []string{"first", "second"} {
		got, err := source.Get(alice, conversation, "ordinary")
		require.NoError(t, err)
		metadataClients = append(metadataClients, got.(*nativeSkillClient).Interface)
		_, reusable, err := source.CatalogScope(alice, conversation, []string{"ordinary"})
		require.NoError(t, err)
		require.True(t, reusable)
	}
	require.EqualValues(t, 1, initializes.Load(), "skill metadata must reuse the already-negotiated gateway connection")
	for _, metadata := range metadataClients {
		require.Same(t, warmed, metadata)
	}
	bob := authctx.WithUserInfo(context.Background(), &authctx.UserInfo{Subject: "bob"})
	other, err := source.Get(bob, "other-user", "ordinary")
	require.NoError(t, err)
	require.NotSame(t, warmed, other.(*nativeSkillClient).Interface)
	require.EqualValues(t, 2, initializes.Load(), "the manager still isolates authenticated users")
	execution, err := mgr.Get(alice, "execution", "ordinary")
	require.NoError(t, err)
	require.NotSame(t, warmed, execution)
	_, err = execution.CallTool(alice, &schema.CallToolRequestParams{Name: "execute"})
	require.NoError(t, err)
	require.EqualValues(t, 3, initializes.Load(), "action execution keeps its conversation connection")
	mu.Lock()
	observed := executionSession
	mu.Unlock()
	require.Equal(t, "3", observed)
	rejectCheck.Store(actorChecks.Load() + 2)
	stale, err := source.Get(alice, "first", "ordinary")
	require.ErrorIs(t, err, identity.ErrResourceStale)
	require.Nil(t, stale, "a stale actor must not obtain even the already-negotiated metadata client")
	require.EqualValues(t, 3, initializes.Load())
	rejectCheck.Store(0)
	current, err := source.Get(alice, "second", "ordinary")
	require.NoError(t, err)
	require.Same(t, warmed, current.(*nativeSkillClient).Interface)
}

func TestNativeSkillSourceMetadataReusePreservesActorFences(t *testing.T) {
	for _, mode := range []string{"denied before get", "stale after get", "current"} {
		t.Run(mode, func(t *testing.T) {
			gets, checks := 0, 0
			mgr, err := manager.New(fixtureOptions{"ordinary": {}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) {
				gets++
				return provider("owner"), nil
			}))
			require.NoError(t, err)
			defer mgr.CloseConversation("chat")
			actor := identity.VerifiedActor{Issuer: "fixture", Subject: "alice", TenantID: "team", AccountID: "account", IdentityRevision: "current", ValidUntil: time.Now().Add(time.Minute)}
			g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error {
				checks++
				if mode == "denied before get" {
					return identity.ErrResourceDenied
				}
				if mode == "stale after get" && checks == 2 {
					return identity.ErrResourceStale
				}
				return nil
			}, "aggregate")
			defer g.Close()
			got, err := (&NativeSkillSource{Gateway: g}).Get(context.Background(), "chat", "ordinary")
			if mode == "current" {
				require.NoError(t, err)
				require.NotNil(t, got)
				require.Equal(t, 2, checks)
				return
			}
			require.Nil(t, got)
			var required interface{ RequiredSkillDiscoveryFailure() bool }
			require.ErrorAs(t, err, &required)
			require.True(t, required.RequiredSkillDiscoveryFailure())
			if mode == "denied before get" {
				require.ErrorIs(t, err, identity.ErrResourceDenied)
				require.Zero(t, gets)
			} else {
				require.ErrorIs(t, err, identity.ErrResourceStale)
				require.Equal(t, 1, gets)
			}
		})
	}
}

func TestNativeSkillSourcePreservesCallerManagedConnectionScopes(t *testing.T) {
	for _, mode := range []string{"custom factory", "local", "browser", "unknown transport"} {
		t.Run(mode, func(t *testing.T) {
			settings := &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{Transport: mcp.ClientTransport{Type: "streamable"}}}
			var managerOptions []manager.Option
			if mode == "custom factory" {
				managerOptions = append(managerOptions, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return provider("owner"), nil }))
			}
			if mode == "browser" {
				settings.ExecutionLocation = "browser"
			}
			if mode == "unknown transport" {
				settings.Transport.Type = "unknown"
			}
			options := fixtureOptions{"ordinary": settings}
			if mode == "local" {
				options = fixtureOptions{}
			}
			mgr, err := manager.New(options, managerOptions...)
			require.NoError(t, err)
			defer mgr.CloseConversation("chat")
			if mode == "local" {
				settings.PrimitiveProviderIdentity = "synthetic"
				require.NoError(t, mgr.RegisterLocal(context.Background(), "ordinary", settings, func(context.Context) (mcpclient.Interface, error) { return provider("owner"), nil }))
			}
			require.Equal(t, "chat", mgr.MetadataConnectionScope(context.Background(), "chat", "ordinary"))
			actor := identity.VerifiedActor{Issuer: "fixture", Subject: "alice", TenantID: "team", AccountID: "account", IdentityRevision: "current", ValidUntil: time.Now().Add(time.Minute)}
			g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "aggregate")
			defer g.Close()
			expected, directErr := mgr.Get(context.Background(), "chat", "ordinary")
			got, err := (&NativeSkillSource{Gateway: g}).Get(context.Background(), "chat", "ordinary")
			if directErr != nil {
				require.Error(t, err)
				if mode == "unknown transport" {
					require.Contains(t, err.Error(), "no transport configured")
				} else {
					require.Equal(t, directErr.Error(), err.Error())
				}
				return
			}
			require.NoError(t, err)
			require.Same(t, expected, got.(*nativeSkillClient).Interface)
		})
	}
}
