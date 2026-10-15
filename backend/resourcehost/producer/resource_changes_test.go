// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
)

func notificationFixture(t *testing.T) (*LocalProvider, *ResourceChanges) {
	t.Helper()
	changes := &ResourceChanges{}
	p, err := NewLocalProvider(LocalConfig{ProviderIdentity: "fixture", Actor: func(context.Context) (identity.VerifiedActor, error) { return identity.VerifiedActor{}, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: []LocalResourceBinding{{URI: "template://shared/one", FormatVersion: 1, Changes: changes, Resolver: func(context.Context, identity.VerifiedActor, string) (*identity.ResourceResolver, error) {
		return nil, nil
	}}}, Validators: map[string]LocalResourceValidator{"template": func(int64, json.RawMessage) error { return nil }}})
	require.NoError(t, err)
	return p, changes
}
func subscriptionCount(p *ResourceChanges) int { p.mu.Lock(); defer p.mu.Unlock(); return len(p.sinks) }
func TestInProcessClientCloseUnsubscribesSource(t *testing.T) {
	p, changes := notificationFixture(t)
	client, err := NewLocalMCPClient(p)
	require.NoError(t, err)
	require.Equal(t, 1, subscriptionCount(changes))
	require.NoError(t, client.(interface{ Close() error }).Close())
	require.NoError(t, client.(interface{ Close() error }).Close())
	require.Equal(t, 0, subscriptionCount(changes))
}
func TestStandardHTTPSourceSubscriptionSessionAndStatelessLifecycle(t *testing.T) {
	p, changes := notificationFixture(t)
	handler, err := NewLocalMCPHandler(p, func(h http.Handler) http.Handler { return h })
	require.NoError(t, err)
	request := func(version string) *httptest.ResponseRecorder {
		body := `{"jsonrpc":"2.0","id":1,"method":"ping"}`
		if version == schema.LatestProtocolVersion {
			raw, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": "ping", "params": map[string]any{"_meta": map[string]any{"io.modelcontextprotocol/protocolVersion": version, "io.modelcontextprotocol/clientCapabilities": map[string]any{}}}})
			body = string(raw)
		}
		r := httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if version != "" {
			r.Header.Set(schema.HeaderProtocolVersion, version)
			r.Header.Set(schema.HeaderMethod, "ping")
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, r)
		return response
	}
	response := request("2025-11-25")
	id := response.Header().Get("Mcp-Session-Id")
	require.NotEmpty(t, id)
	require.Equal(t, 1, subscriptionCount(changes), "initialize request end keeps resumable session subscribed")
	for i := 0; i < 2; i++ {
		r := httptest.NewRequest(http.MethodDelete, "/mcp", nil)
		r.Header.Set("Mcp-Session-Id", id)
		handler.ServeHTTP(httptest.NewRecorder(), r)
	}
	require.Equal(t, 0, subscriptionCount(changes))
	for i := 0; i < 20; i++ {
		response = request(schema.LatestProtocolVersion)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		require.Equal(t, 0, subscriptionCount(changes), "stateless requests retain no source listeners")
	}
}
