package window

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/types"
)

func TestCompileWindowSourcePreservesExplicitEmptyInlineRows(t *testing.T) {
	manifest := WindowSourceManifest{Version: 1, Binding: ResourceBinding{WindowKey: "empty", URI: "window://example/empty"}, Files: map[string]string{
		"extension/forge/windows/empty/main.yaml": "windowKey: empty\nresources: {dataSources: [rows]}\nview: {content: {id: empty, dataSourceRef: rows}}\n",
		"extension/forge/datasources/rows.yaml":   "id: rows\ncardinality: collection\nbackend: {kind: inline, rows: []}\n",
	}}
	before, err := json.Marshal(manifest)
	require.NoError(t, err)
	raw, err := CompileWindowSource(context.Background(), manifest)
	require.NoError(t, err)
	selected, err := types.SelectWindowResourceWithReferences(raw, nil)
	require.NoError(t, err)
	var descriptor struct{ Backend map[string]json.RawMessage }
	require.NoError(t, json.Unmarshal(selected.DataSources["rows"], &descriptor))
	require.JSONEq(t, `[]`, string(descriptor.Backend["rows"]), "compiled source must retain explicit empty producer rows")
	after, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.JSONEq(t, string(before), string(after), "compilation must preserve source archive entries")
}
