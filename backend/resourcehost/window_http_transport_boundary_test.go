package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp"
	mcpclient "github.com/viant/mcp/client"
	mcpcfg "github.com/viant/mcp/client/config"
)

func TestWindowHTTPTransportRequiresExactHostSourceBinding(t *testing.T) {
	native := types.DataSource{Service: &types.Service{Endpoint: "agentlyAPI", URI: "/v1/workspace/metadata", Method: "GET"}, Selectors: &types.Selectors{Data: ""}}
	backend := types.DataSource{}
	sources := map[string]json.RawMessage{}
	for id, descriptor := range map[string]dsproto.DataSource{"meta": {ID: "meta", DataSource: native}, "rows": {ID: "rows", DataSource: backend, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "owning", Method: "rows"}}} {
		raw, err := json.Marshal(descriptor)
		require.NoError(t, err)
		sources[id], err = types.CanonicalWindowDescriptor(raw)
		require.NoError(t, err)
	}
	dependencies := map[string]string{}
	for id, raw := range sources {
		dependencies[id] = identity.ContentFingerprint(raw)
	}
	variant := types.WindowResourceVariant{Window: &types.Window{View: types.View{Content: &types.Container{ID: "original"}}, DataSource: map[string]types.DataSource{"meta": native, "rows": backend}, ResourceDependencies: dependencies}, DataSources: sources}
	fingerprint, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	raw, err := json.Marshal(types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Targets: []types.WindowTargetBinding{{Variant: fingerprint}}, Variants: map[string]types.WindowResourceVariant{fingerprint: variant}})
	require.NoError(t, err)
	require.NoError(t, ValidateWindowBundle(2, raw), "bundle integrity alone never establishes host transport trust")
	for _, local := range []bool{false, true} {
		t.Run(map[bool]string{false: "external", true: "locally-mounted-user-catalog"}[local], func(t *testing.T) {
			p := provider("declared-owner")
			p.definition = raw
			name := "remote"
			var g *Gateway
			if local {
				name = "mounted"
				g, _, _ = fixtureGateway(t, map[string]*fixtureProvider{})
				require.NoError(t, g.Manager.RegisterLocal(context.Background(), name, &mcpcfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: p.owner}, func(context.Context) (mcpclient.Interface, error) { return p, nil }))
				require.True(t, g.Manager.IsLocalClient(name))
			} else {
				g, _, _ = fixtureGateway(t, map[string]*fixtureProvider{name: p})
			}
			proof, err := types.NewWindowTargetHMAC(make([]byte, 32))
			require.NoError(t, err)
			catalog := &WindowCatalog{Gateway: g, TargetProof: proof}
			request := &service.WindowDefinitionGetInput{WindowID: "window://example/sales"}
			_, err = catalog.Get(context.Background(), request)
			require.ErrorIs(t, err, ErrUnsupportedWindowTransport, "payload endpoint declaration and local mounting do not grant host transport")
			require.NoError(t, catalog.RegisterNativeHTTPWindows(Connection{Name: name, ProviderIdentity: p.owner}, []string{"window://example/other"}))
			_, err = catalog.Get(context.Background(), request)
			require.ErrorIs(t, err, ErrUnsupportedWindowTransport, "different URI does not match")
			require.NoError(t, catalog.RegisterNativeHTTPWindows(Connection{Name: "another", ProviderIdentity: p.owner}, []string{request.WindowID}))
			_, err = catalog.Get(context.Background(), request)
			require.ErrorIs(t, err, ErrUnsupportedWindowTransport, "different connection does not match")
			require.NoError(t, catalog.RegisterNativeHTTPWindows(Connection{Name: name, ProviderIdentity: "another"}, []string{request.WindowID}))
			_, err = catalog.Get(context.Background(), request)
			require.ErrorIs(t, err, ErrUnsupportedWindowTransport, "different provider does not match")
			uris := []string{request.WindowID}
			require.NoError(t, catalog.RegisterNativeHTTPWindows(Connection{Name: name, ProviderIdentity: p.owner}, uris))
			uris[0] = "window://example/changed"
			result, err := catalog.Get(context.Background(), request)
			require.NoError(t, err)
			require.Equal(t, native, result.Definition.DataSource["meta"], "exact independently registered source retains native transport")
			require.Equal(t, "/v1/api/datasources/rows/fetch", result.Definition.DataSource["rows"].Service.URI, "mixed explicit MCP backend retains proxy")
			require.Equal(t, identity.ContentFingerprint(raw), result.Definition.Resource.ContentFingerprint)
			require.Equal(t, json.RawMessage(raw), p.definition, "registration and delivery never rewrite provider bytes")
		})
	}
	require.Error(t, (&WindowCatalog{}).RegisterNativeHTTPWindows(Connection{}, []string{"window://example/sales"}))
	require.Error(t, (&WindowCatalog{}).RegisterNativeHTTPWindows(Connection{Name: "native", ProviderIdentity: "host"}, []string{"report://example/sales"}))
}
