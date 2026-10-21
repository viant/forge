package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	service "github.com/viant/forge/backend/provider"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"testing"
)

func TestDelegatedWindowProjectsOnlySelectedDatasourceHostFetchRoutes(t *testing.T) {
	id := "records/nested"
	original := types.DataSource{Cardinality: "collection", Selectors: &types.Selectors{Data: "rows"}}
	descriptor, err := json.Marshal(dsproto.DataSource{ID: id, DataSource: original, Backend: &dsproto.Backend{Kind: "inline", Rows: []map[string]any{{"id": 1}}}})
	require.NoError(t, err)
	descriptor, err = types.CanonicalWindowDescriptor(descriptor)
	require.NoError(t, err)
	definition := &types.Window{View: types.View{Content: &types.Container{ID: "records"}}, DataSource: map[string]types.DataSource{id: original}, ResourceDependencies: map[string]string{id: identity.ContentFingerprint(descriptor)}}
	variant := types.WindowResourceVariant{Window: definition, DataSources: map[string]json.RawMessage{id: descriptor}}
	fp, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	envelope := types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Targets: []types.WindowTargetBinding{{Target: types.WindowTarget{}, Variant: fp}}, Variants: map[string]types.WindowResourceVariant{fp: variant}}
	raw, err := json.Marshal(envelope)
	require.NoError(t, err)
	provider := provider("studio-owner")
	provider.definition = raw
	gateway, _, revoked := fixtureGateway(t, map[string]*fixtureProvider{"studio": provider})
	proof, err := types.NewWindowTargetHMAC(bytes.Repeat([]byte{4}, 32))
	require.NoError(t, err)
	catalog := &WindowCatalog{Gateway: gateway, TargetProof: proof}
	result, err := catalog.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: "window://example/sales"})
	require.NoError(t, err)
	fetch := result.Definition.DataSource[id].Service
	require.NotNil(t, fetch, "service-less producer datasource must have host BFF projection")
	require.Equal(t, "agentlyAPI", fetch.Endpoint)
	require.Equal(t, "POST", fetch.Method)
	require.Equal(t, "/v1/api/datasources/records%2Fnested/fetch", fetch.URI)
	require.Equal(t, identity.ContentFingerprint(raw), result.Definition.Resource.ContentFingerprint)
	require.Equal(t, identity.ContentFingerprint(descriptor), result.Definition.ResourceDependencies[id])
	require.NoError(t, proof.Verify(context.Background(), *result.Definition.Resource, *result.Definition.ResourceTarget, fp, result.Definition.ResourceTarget.SelectionToken))
	require.Nil(t, definition.DataSource[id].Service, "provider original remains unchanged")
	require.True(t, bytes.Equal(raw, provider.definition))
	*revoked = true
	denied, err := catalog.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: "window://example/sales", ResolvedResource: result.Definition.Resource, Target: result.Definition.ResourceTarget})
	require.Error(t, err)
	require.Nil(t, denied)
}

func TestHostTransportProjectionPreservesLocalAggregateViews(t *testing.T) {
	for _, independent := range []bool{false, true} {
		t.Run(fmt.Sprint("independent=", independent), func(t *testing.T) {
			local := types.DataSource{DataSourceRef: "record", Selectors: &types.Selectors{Data: ".", Metrics: "."}}
			relation := types.DataSource{DataSourceRef: "record", Selectors: &types.Selectors{Data: "acl"}}
			window := &types.Window{DataSource: map[string]types.DataSource{
				"record":     {Selectors: &types.Selectors{Data: "data", Metrics: "data.0"}},
				"properties": local, "permissions": relation,
			}}
			descriptors := map[string]json.RawMessage{}
			references := map[string]primitive.DataSourceReference{}
			for id, source := range window.DataSource {
				raw, err := json.Marshal(dsproto.DataSource{ID: id, DataSource: source, Backend: &dsproto.Backend{Kind: "inline"}})
				require.NoError(t, err)
				descriptors[id] = raw
				references[id] = primitive.DataSourceReference{}
			}
			if independent {
				projectIndependentDatasourceTransport(window, references)
			} else {
				require.NoError(t, projectWindowDatasourceTransport(window, descriptors, true))
			}
			require.NotNil(t, window.DataSource["record"].Service)
			require.Equal(t, "rows", window.DataSource["record"].Selectors.Data)
			require.Equal(t, "metrics", window.DataSource["record"].Selectors.Metrics)
			require.Equal(t, local, window.DataSource["properties"], "whole-record view reads the parent selected row")
			require.Equal(t, relation, window.DataSource["permissions"], "relation view reads the parent's nested collection")
		})
	}
}

func TestLocalViewCannotBypassUnregisteredHTTPTransportPolicy(t *testing.T) {
	for _, backend := range []*dsproto.Backend{nil, {Kind: "inline"}} {
		for _, serviceInDescriptor := range []bool{false, true} {
			t.Run(fmt.Sprintf("backend=%v/descriptor=%t", backend, serviceInDescriptor), func(t *testing.T) {
				local := types.DataSource{DataSourceRef: "record", Selectors: &types.Selectors{Data: ".", Metrics: "."}}
				declared := local
				unexpected := &types.Service{URI: "https://unregistered.invalid/fetch", Method: "POST"}
				if serviceInDescriptor {
					declared.Service = unexpected
				} else {
					local.Service = unexpected
				}
				raw, err := json.Marshal(dsproto.DataSource{ID: "properties", DataSource: declared, Backend: backend})
				require.NoError(t, err)
				window := &types.Window{DataSource: map[string]types.DataSource{"properties": local}}
				require.ErrorIs(t, projectWindowDatasourceTransport(window, map[string]json.RawMessage{"properties": raw}, false), ErrUnsupportedWindowTransport)
				require.Equal(t, local, window.DataSource["properties"], "rejection does not mutate admitted selectors")
			})
		}
	}
}
