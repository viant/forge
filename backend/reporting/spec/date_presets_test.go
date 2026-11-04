package reportspec

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestDatePresetsStrictReportDecode(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	fixture["scope"] = map[string]any{"dataSourceRef": "reader", "params": []any{
		map[string]any{"id": "period", "kind": "dateRange", "label": "Period", "required": false, "value": map[string]any{}, "filterBindings": []any{map[string]any{"datasetRef": "primary", "path": "from", "valuePath": "start"}}, "datePresets": map[string]any{
			"calendar": map[string]any{"dataSourceRef": "calendar", "input": map[string]any{"name": "ids", "parameter": "identity", "array": true}, "identityField": "id", "timeZoneField": "zone"}, "default": "completed", "valueParameter": "mode", "options": []any{map[string]any{"value": "completed", "label": "Completed", "range": map[string]any{"kind": "relativeDays", "startOffset": -7, "endOffset": -1}}, map[string]any{"value": "custom", "label": "Custom"}}}},
		map[string]any{"id": "mode", "kind": "text", "label": "Mode", "required": false, "value": "custom", "filterBindings": []any{map[string]any{"datasetRef": "primary", "path": "mode"}}},
	}}
	// Use the fixture's admitted dataset identity; no domain data is needed.
	id := fixture["datasets"].([]any)[0].(map[string]any)["id"].(string)
	for _, raw := range fixture["scope"].(map[string]any)["params"].([]any) {
		raw.(map[string]any)["filterBindings"].([]any)[0].(map[string]any)["datasetRef"] = id
	}
	wire, err := json.Marshal(fixture)
	require.NoError(t, err)
	decoded, err := DecodeJSON(wire)
	require.NoError(t, err)
	require.Equal(t, "mode", decoded.Scope.Params[0].DatePresets.ValueParameter)
	require.NoError(t, decoded.Validate())
	again, err := json.Marshal(decoded)
	require.NoError(t, err)
	roundTrip, err := DecodeJSON(again)
	require.NoError(t, err)
	require.Equal(t, decoded.Scope.Params[0].DatePresets, roundTrip.Scope.Params[0].DatePresets)
	decoded.Scope.Params[1].Kind = "integer"
	require.Error(t, decoded.Validate())
}
