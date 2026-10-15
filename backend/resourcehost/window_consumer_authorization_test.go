package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	bridge "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	authctx "github.com/viant/mcp/client/auth/link"
	transport "github.com/viant/mcp/client/auth/transport"
	cfg "github.com/viant/mcp/client/config"
)

func TestWindowConsumerUsesOwningHTTPServerAuthorizationAndCurrentCredentials(t *testing.T) {
	producer, _, actor, _ := localFixture(t)
	var mu sync.Mutex
	expected := "Bearer window-first"
	denied := false
	var gets []map[string]interface{}
	var credentials []string
	handler, err := NewMCPHandler(producer, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
			raw, readErr := io.ReadAll(request.Body)
			require.NoError(t, readErr)
			request.Body = io.NopCloser(bytes.NewReader(raw))
			var message struct {
				Method string `json:"method"`
				Params struct {
					Name      string                 `json:"name"`
					Arguments map[string]interface{} `json:"arguments"`
				} `json:"params"`
			}
			if len(raw) > 0 {
				require.NoError(t, json.Unmarshal(raw, &message))
			}
			mu.Lock()
			token := request.Header.Get("Authorization")
			accepted := token == expected
			blocked := denied && message.Method == "tools/call" && message.Params.Name == "windows/get"
			if message.Method == "tools/call" && message.Params.Name == "windows/get" {
				credentials = append(credentials, token)
				gets = append(gets, message.Params.Arguments)
			}
			mu.Unlock()
			if !accepted {
				http.Error(w, "current credential required", http.StatusUnauthorized)
				return
			}
			if blocked {
				http.Error(w, "owning server denied window", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, request.WithContext(context.WithValue(request.Context(), localTestRequest{}, true)))
		})
	})
	require.NoError(t, err)
	endpoint := httptest.NewServer(handler)
	defer endpoint.Close()
	roundTripper, err := transport.New(transport.WithTransport(http.DefaultTransport))
	require.NoError(t, err)
	bff := true
	options := fixtureOptions{"owner": &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{Name: "owner", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Auth: &mcp.ClientAuth{UseIdToken: true, BackendForFrontend: &bff}, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: endpoint.URL + "/mcp"}}}}}
	mgr, err := manager.New(options, manager.WithAuthRoundTripper(roundTripper))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "consumer")
	defer gateway.Close()
	proof, err := types.NewWindowTargetHMAC(bytes.Repeat([]byte{7}, 32))
	require.NoError(t, err)
	// The consumer has transport/identity integrity and selection proof, with no
	// resource policy registration. The managing server decides availability.
	catalog := &WindowCatalog{Gateway: gateway, TargetProof: proof}
	first, cancel := context.WithTimeout(authctx.WithIDToken(context.Background(), "window-first"), 5*time.Second)
	defer cancel()
	opened, err := catalog.Get(first, &bridge.WindowDefinitionGetInput{WindowID: "window://team/sales"})
	require.NoError(t, err, "an owning-server grant must pass without host resource policy")
	require.Equal(t, "local-workspace", opened.Definition.Resource.ProviderIdentity)
	mu.Lock()
	expected = "Bearer window-second"
	mu.Unlock()
	second, finish := context.WithTimeout(authctx.WithIDToken(context.Background(), "window-second"), 5*time.Second)
	defer finish()
	input := &bridge.WindowDefinitionGetInput{WindowID: "window://team/sales", ResolvedResource: opened.Definition.Resource, Target: opened.Definition.ResourceTarget}
	originalTarget, _ := json.Marshal(input.Target)
	restored, err := catalog.Get(second, input)
	require.NoError(t, err, "cached consumer connections must use the current credential")
	require.Equal(t, opened.Definition.Resource.ResourceCandidate, restored.Definition.Resource.ResourceCandidate)
	require.Equal(t, opened.Definition.Resource.AuthorityBinding, restored.Definition.Resource.AuthorityBinding)
	targetAfter, _ := json.Marshal(input.Target)
	require.Equal(t, originalTarget, targetAfter, "the caller's selected target must stay intact")
	mu.Lock()
	denied = true
	beforeDenial := len(gets)
	mu.Unlock()
	// This ordinary HTTP wrapper cannot publish resource notifications. A real
	// reconnect invalidates its metadata; the next fresh request reaches owner.
	mgr.CloseConversation("")
	unavailable, err := catalog.Get(second, &bridge.WindowDefinitionGetInput{WindowID: input.WindowID})
	require.Error(t, err, "owning-server denial must pass through even after a successful open")
	require.Nil(t, unavailable)
	mu.Lock()
	defer mu.Unlock()
	require.Equal(t, beforeDenial+1, len(gets), "managing server denied the actual fresh Get after reconnect")
	require.Contains(t, credentials, "Bearer window-first")
	require.Contains(t, credentials, "Bearer window-second")
	for _, args := range gets {
		require.Equal(t, "window://team/sales", args["uri"], "resource routing must remain authored")
		require.NotContains(t, args, "tenantId", "consumer must not invent business authorization parameters")
		require.NotContains(t, args, "accountId")
	}
}
