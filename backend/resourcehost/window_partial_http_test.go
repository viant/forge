package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

func TestWindowViewAndSelectedOpenUsePartialOrdinaryMCPHTTP(t *testing.T) {
	provider, source, actor, revoked := localFixture(t)
	var bundle types.WindowResourceEnvelope
	require.NoError(t, json.Unmarshal(source.raw, &bundle))
	bundle.ViewMetadata = json.RawMessage(`{"id":"sales","windowKey":"sales","title":"Original Sales","resourceURI":"window://foreign/spoof","openMode":"replace"}`)
	for id, variant := range bundle.Variants {
		delete(bundle.Variants, id)
		variant.Window.Title = "Original Sales"
		fp, err := types.WindowVariantFingerprint(variant)
		require.NoError(t, err)
		bundle.Variants[fp] = variant
		bundle.Targets[0].Variant = fp
	}
	raw, err := json.Marshal(bundle)
	require.NoError(t, err)
	source.raw = raw
	var mu sync.Mutex
	requests := 0
	handler, err := NewMCPHandler(provider, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { mu.Lock(); requests++; mu.Unlock(); next.ServeHTTP(w, r) })
	})
	require.NoError(t, err)
	server := httptest.NewServer(handler)
	defer server.Close()
	mgr, err := manager.New(fixtureOptions{"only-windows": {ClientOptions: &mcp.ClientOptions{Name: "only-windows", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}}}})
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	gateway := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) { return *actor, nil }, func(context.Context, identity.VerifiedActor) error {
		if *revoked {
			return identity.ErrResourceDenied
		}
		return nil
	}, "host")
	defer gateway.Close()
	specs, err := NewWindowViewReader(gateway).LoadAll(context.Background())
	require.NoError(t, err)
	require.Len(t, specs, 1)
	require.Equal(t, "window://team/sales", specs[0].ResourceURI, "authored metadata cannot supply routing authority")
	proof, err := types.NewWindowTargetHMAC(make([]byte, 32))
	require.NoError(t, err)
	catalog := &WindowCatalog{Gateway: gateway, TargetProof: proof}
	selected, err := catalog.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: specs[0].ResourceURI})
	require.NoError(t, err)
	require.Equal(t, "Original Sales", selected.Definition.Title)
	require.Equal(t, "local-workspace", selected.Definition.Resource.ProviderIdentity)
	mu.Lock()
	require.Positive(t, requests)
	mu.Unlock()
	*revoked = true
	_, err = catalog.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: specs[0].ResourceURI})
	require.Error(t, err, "cached view discovery does not admit selected body after denial")
}
