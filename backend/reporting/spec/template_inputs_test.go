package reportspec

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestMarkdownRequestInputsNativeRoundTrip(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	block := map[string]any{"id": "narrative", "kind": "markdownBlock", "title": "Narrative", "datasetRef": "primary", "markdown": "Selected ${input.mode}", "templateRequestInputs": map[string]any{"mode": map[string]any{"path": "mode", "labels": []any{map[string]any{"value": 1, "label": "One"}, map[string]any{"value": "1", "label": "String one"}}}}, "templateFieldDisplayMap": map[string]any{"date": map[string]any{"sourceKey": "date"}}}
	fixture["blocks"] = []any{block}
	raw, err := json.Marshal(fixture)
	require.NoError(t, err)
	spec, err := DecodeJSON(raw)
	require.NoError(t, err)
	require.Equal(t, "primary", spec.Blocks[0].DatasetRef)
	require.Len(t, spec.Blocks[0].TemplateRequestInputs["mode"].Labels, 2)
	require.NotNil(t, spec.Blocks[0].TemplateFieldDisplayMap)
	encoded, err := json.Marshal(spec)
	require.NoError(t, err)
	again, err := DecodeJSON(encoded)
	require.NoError(t, err)
	require.Equal(t, spec.Blocks[0].TemplateRequestInputs, again.Blocks[0].TemplateRequestInputs)
	for _, path := range []string{"__proto__.x", "bad/path", ""} {
		block["templateRequestInputs"].(map[string]any)["mode"].(map[string]any)["path"] = path
		raw, _ = json.Marshal(fixture)
		_, err = DecodeJSON(raw)
		require.Error(t, err)
	}
}
