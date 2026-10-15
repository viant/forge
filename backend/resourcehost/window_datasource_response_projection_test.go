package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func TestDelegatedDatasourceProjectionUsesNormalizedHostResponseSelectors(t *testing.T) {
	original := types.DataSource{Selectors: &types.Selectors{Data: "Records", DataInfo: "Info", Metrics: "Statistics", Scope: "body", DataFallbacks: []string{"LegacyRecords"}}}
	descriptor, err := json.Marshal(dsproto.DataSource{ID: "records", DataSource: original, Backend: &dsproto.Backend{Kind: "inline", Rows: []map[string]any{{"id": 1}}}})
	require.NoError(t, err)
	descriptor, err = types.CanonicalWindowDescriptor(descriptor)
	require.NoError(t, err)
	variant := types.WindowResourceVariant{Window: &types.Window{View: types.View{Content: &types.Container{ID: "records"}}, DataSource: map[string]types.DataSource{"records": original}, ResourceDependencies: map[string]string{"records": identity.ContentFingerprint(descriptor)}}, DataSources: map[string]json.RawMessage{"records": descriptor}}
	fingerprint, err := types.WindowVariantFingerprint(variant)
	require.NoError(t, err)
	raw, err := json.Marshal(types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Targets: []types.WindowTargetBinding{{Target: types.WindowTarget{}, Variant: fingerprint}}, Variants: map[string]types.WindowResourceVariant{fingerprint: variant}})
	require.NoError(t, err)
	p := provider("owned-provider")
	p.definition = raw
	gateway, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"owned": p})
	proof, err := types.NewWindowTargetHMAC(make([]byte, 32))
	require.NoError(t, err)
	catalog := &WindowCatalog{Gateway: gateway, TargetProof: proof}
	opened, err := catalog.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: "window://example/sales"})
	require.NoError(t, err)
	require.Equal(t, &types.Selectors{Data: "rows", DataInfo: "dataInfo", Metrics: "metrics"}, opened.Definition.DataSource["records"].Selectors, "the host fetch endpoint returns its normalized rows/dataInfo/metrics envelope")
	require.Equal(t, original.Selectors, variant.Window.DataSource["records"].Selectors)
	require.True(t, bytes.Equal(raw, p.definition), "projection must not rewrite producer descriptors or their fingerprints")
	require.Equal(t, identity.ContentFingerprint(raw), opened.Definition.Resource.ContentFingerprint)
	require.NoError(t, proof.Verify(context.Background(), *opened.Definition.Resource, *opened.Definition.ResourceTarget, fingerprint, opened.Definition.ResourceTarget.SelectionToken))
}
