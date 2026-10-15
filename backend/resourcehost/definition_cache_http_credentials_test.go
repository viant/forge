package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	authctx "github.com/viant/mcp/client/auth/link"
	authstore "github.com/viant/mcp/client/auth/store"
	transport "github.com/viant/mcp/client/auth/transport"
	"golang.org/x/oauth2"
)

type unwitnessedCredentialStore struct{ authstore.Store }

func TestGenericPrivateDefinitionHTTPUsesEffectiveCredentialWitness(t *testing.T) {
	for _, custom := range []bool{false, true} {
		name := "default-store"
		if custom {
			name = "unsupported-custom-store"
		}
		t.Run(name, func(t *testing.T) {
			provider, _, actor, _ := menuFixtureProvider(t)
			binding := localProviderBinding(provider, "navigation://team/navigation")
			immutable := &stampedMenuSource{raw: json.RawMessage(menuFixture)}
			binding.Resolver = func(context.Context, identity.VerifiedActor, string) (*identity.ResourceResolver, error) {
				return &identity.ResourceResolver{ProviderIdentity: provider.ProviderIdentity(), Source: immutable, Policy: stampMenuPolicy{until: actor.ValidUntil}}, nil
			}
			updateLocalProvider(t, provider, func(config *LocalConfig) { setLocalConfigBinding(config, binding) })
			var gets atomic.Int32
			handler, err := NewMCPHandler(provider, func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer fixture-") {
						http.Error(w, "required", 401)
						return
					}
					if r.Body != nil && r.Method == http.MethodPost {
						raw, err := io.ReadAll(r.Body)
						require.NoError(t, err)
						r.Body = io.NopCloser(bytes.NewReader(raw))
						var packet struct {
							Method string `json:"method"`
							Params struct {
								Name string `json:"name"`
							} `json:"params"`
						}
						if json.Unmarshal(raw, &packet) == nil && packet.Method == "tools/call" && packet.Params.Name == "navigations/get" {
							gets.Add(1)
						}
					}
					next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), localTestRequest{}, true)))
				})
			})
			require.NoError(t, err)
			server := httptest.NewServer(handler)
			defer server.Close()
			endpoint, err := url.Parse(server.URL + "/mcp")
			require.NoError(t, err)
			jars := map[string]http.CookieJar{}
			transports := map[string]*transport.RoundTripper{}
			for _, user := range []string{"alice", "bob"} {
				jar, err := cookiejar.New(nil)
				require.NoError(t, err)
				jars[user] = jar
				options := []transport.Option{transport.WithCookieJar(jar), transport.WithTransport(http.DefaultTransport)}
				if custom {
					options = append(options, transport.WithStore(unwitnessedCredentialStore{authstore.NewMemoryStore()}))
				}
				rt, err := transport.New(options...)
				require.NoError(t, err)
				transports[user] = rt
			}
			bff := true
			options := fixtureOptions{"protected": {ClientOptions: &mcp.ClientOptions{Name: "protected", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Auth: &mcp.ClientAuth{UseIdToken: true, BackendForFrontend: &bff}, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: endpoint.String()}}}}}
			mgr, err := manager.New(options, manager.WithCookieJarProvider(func(ctx context.Context) (http.CookieJar, error) { return jars[authctx.CanonicalUserID(ctx)], nil }), manager.WithAuthRoundTripperProvider(func(ctx context.Context) *transport.RoundTripper { return transports[authctx.CanonicalUserID(ctx)] }))
			require.NoError(t, err)
			defer mgr.CloseConversation("")
			g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
			defer g.Close()
			get := func(user, token, conversation string) {
				ctx, cancel := context.WithTimeout(cacheUser(user, token, conversation), 5*time.Second)
				defer cancel()
				connection, err := g.ConnectionForProvider(ctx, provider.ProviderIdentity())
				require.NoError(t, err)
				_, err = Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: "navigation://team/navigation", Revision: "release-7"}, nil)
				require.NoError(t, err)
			}
			get("alice", "fixture-alice", "a")
			get("alice", "fixture-alice", "another")
			if custom {
				require.EqualValues(t, 2, gets.Load(), "opaque custom credential store must bypass metadata cache")
				return
			}
			require.EqualValues(t, 1, gets.Load(), "ordinary server metadata reused across conversations")
			get("bob", "fixture-bob", "a")
			get("bob", "fixture-bob", "b")
			require.EqualValues(t, 2, gets.Load(), "each authenticated user has its own definition slot")
			jars["alice"].SetCookies(endpoint, []*http.Cookie{{Name: "session", Value: "rotated", Path: "/"}})
			get("alice", "fixture-alice", "a")
			get("alice", "fixture-alice", "b")
			require.EqualValues(t, 3, gets.Load(), "cookie credential changes invalidate only owning user")
			get("bob", "fixture-bob", "b")
			require.EqualValues(t, 3, gets.Load())
			require.NoError(t, transports["alice"].Store().AddToken(authstore.TokenKey{Issuer: "fixture", Scopes: "metadata"}, &oauth2.Token{AccessToken: "stored-rotation", Expiry: time.Now().Add(time.Hour)}))
			get("alice", "fixture-alice", "a")
			get("alice", "fixture-alice", "b")
			require.EqualValues(t, 4, gets.Load(), "fallback token store rotation changes witness")
			get("alice", "fixture-new", "a")
			get("alice", "fixture-new", "b")
			require.EqualValues(t, 5, gets.Load(), "current context token changes witness")
		})
	}
}
