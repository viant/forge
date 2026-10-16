package resource

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func TestWindowDatasourceProjectionFollowsExactDeclaredBackend(t *testing.T) {
	native := types.DataSource{Service: &types.Service{Endpoint: "configuredHost", URI: "/original", Method: "GET"}, Selectors: &types.Selectors{Data: ""}}
	backend := native
	window := &types.Window{DataSource: map[string]types.DataSource{"native": native, "backend": backend}}
	nativeRaw, err := json.Marshal(dsproto.DataSource{ID: "native", DataSource: native})
	require.NoError(t, err)
	backendRaw, err := json.Marshal(dsproto.DataSource{ID: "backend", DataSource: backend, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "managing", Method: "rows"}})
	require.NoError(t, err)
	descriptors := map[string]json.RawMessage{"native": nativeRaw, "backend": backendRaw}
	require.NoError(t, projectWindowDatasourceTransport(window, descriptors, true))
	require.Equal(t, native, window.DataSource["native"], "native service/selectors and all other presentation fields are retained")
	require.Equal(t, &types.Service{Endpoint: "agentlyAPI", URI: "/v1/api/datasources/backend/fetch", Method: "POST"}, window.DataSource["backend"].Service, "explicit backend takes existing proxy route even when presentation declares a service")
	require.Equal(t, &types.Selectors{Data: "rows", DataInfo: "dataInfo", Metrics: "metrics"}, window.DataSource["backend"].Selectors)
	require.JSONEq(t, string(backendRaw), string(descriptors["backend"]), "provider descriptor remains unchanged")
	require.ErrorIs(t, projectWindowDatasourceTransport(window, map[string]json.RawMessage{"missing": nativeRaw}, true), identity.ErrResourceDenied)
	require.ErrorIs(t, projectWindowDatasourceTransport(window, map[string]json.RawMessage{"native": json.RawMessage(`{"backend":`)}, true), identity.ErrResourceDenied)
}
