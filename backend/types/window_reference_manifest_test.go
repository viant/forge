package types

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"testing"
)

func TestIndependentWindowDefinitionsPreserveBindingsAndRejectMismatch(t *testing.T) {
	var window Window
	require.NoError(t, json.Unmarshal([]byte(`{"windowKey":"records","view":{"content":{"id":"records"}},"dataSource":{"records":{"parameters":[{"name":"parentId","value":7}],"cardinality":"collection","selectors":{"data":"items"},"autoSelect":true}}}`), &window))
	descriptor := json.RawMessage(`{"id":"records","backend":{"kind":"mcp_tool","service":"catalog","method":"records/list"},"cardinality":"collection"}`)
	hash, err := WindowDescriptorFingerprint(descriptor)
	require.NoError(t, err)
	window.ResourceDependencies = map[string]string{"records": hash}
	raw := json.RawMessage(`{"schemaVersion":1,"dataSource":` + string(descriptor) + `}`)
	manifest := WindowResourceVariant{Window: &window, DataSourceResources: map[string]primitive.DataSourceReference{"records": {Resource: identity.ResourceRef{URI: "datasource://neutral/records", Revision: "working"}, ProviderIdentity: "source", ContentFingerprint: identity.ContentFingerprint(raw)}}}
	fingerprint, err := WindowVariantFingerprint(manifest)
	require.NoError(t, err)
	manifest.Fingerprint = fingerprint
	env := WindowResourceEnvelope{SchemaVersion: 4, Format: WindowReferencesFormat, Targets: []WindowTargetBinding{{Variant: fingerprint}}, Variants: map[string]WindowResourceVariant{fingerprint: manifest}}
	require.NoError(t, env.Validate())
	env.SchemaVersion = 3
	require.Error(t, env.Validate(), "legacy format still requires materialized definitions")
	before, _ := json.Marshal(manifest)
	assembled, err := MaterializeWindowReferences(manifest, map[string]json.RawMessage{"records": raw})
	require.NoError(t, err)
	require.Equal(t, manifest.Window.DataSource, assembled.Window.DataSource)
	require.Equal(t, fingerprint, assembled.Fingerprint)
	require.JSONEq(t, string(descriptor), string(assembled.DataSources["records"]))
	after, _ := json.Marshal(manifest)
	require.Equal(t, before, after)
	_, err = MaterializeWindowReferences(manifest, nil)
	require.Error(t, err)
	_, err = MaterializeWindowReferences(manifest, map[string]json.RawMessage{"records": json.RawMessage(`{}`)})
	require.Error(t, err)
	assembled.Window.WindowKey = "changed"
	require.Equal(t, "records", manifest.Window.WindowKey)
}
