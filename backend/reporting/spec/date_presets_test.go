package reportspec

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestDatePresetsStrictReportDecode(t *testing.T) {
	text := func(value string) *string { return &value }
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	fixture["scope"] = map[string]any{"dataSourceRef": "reader", "params": []any{
		map[string]any{"id": "period", "kind": "dateRange", "label": "Period", "required": false, "value": map[string]any{}, "filterBindings": []any{map[string]any{"datasetRef": "primary", "path": "from", "valuePath": "start"}}, "datePresets": map[string]any{
			"calendar": map[string]any{"dataSourceRef": "calendar", "input": map[string]any{"name": "ids", "parameter": "identity", "array": true}, "identityField": "id", "timeZoneField": "zone", "anchorField": "dates.latestDate"}, "default": "completed", "valueParameter": "mode", "options": []any{map[string]any{"value": "completed", "label": "Completed", "range": map[string]any{"kind": "relativeDays", "anchor": "sourceDate", "startOffset": -7, "endOffset": -1}}, map[string]any{"value": "custom", "label": "Custom"}}}},
		map[string]any{"id": "mode", "kind": "text", "label": "Mode", "required": false, "value": "custom", "filterBindings": []any{map[string]any{"datasetRef": "primary", "path": "mode"}}},
	}}
	// Use the fixture's admitted dataset identity; no domain data is needed.
	id := fixture["datasets"].([]any)[0].(map[string]any)["id"].(string)
	for _, raw := range fixture["scope"].(map[string]any)["params"].([]any) {
		raw.(map[string]any)["filterBindings"].([]any)[0].(map[string]any)["datasetRef"] = id
	}
	wire, err := json.Marshal(fixture)
	require.NoError(t, err)

	for _, tc := range []struct {
		name   string
		anchor any
		field  any
		omit   bool
		valid  bool
	}{
		{name: "omitted", omit: true, valid: true},
		{name: "null", valid: true},
		{name: "empty anchor", anchor: "", field: "dates.latestDate"},
		{name: "empty field", field: ""},
		{name: "valid", anchor: "sourceDate", field: "dates.latestDate", valid: true},
		{name: "wrong anchor type", anchor: 17, field: "dates.latestDate"},
		{name: "wrong field type", field: 17},
		{name: "source missing field", anchor: "sourceDate", omit: true},
		{name: "source null field", anchor: "sourceDate"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var sample map[string]any
			require.NoError(t, json.Unmarshal(wire, &sample))
			presets := sample["scope"].(map[string]any)["params"].([]any)[0].(map[string]any)["datePresets"].(map[string]any)
			calendar := presets["calendar"].(map[string]any)
			relative := presets["options"].([]any)[0].(map[string]any)["range"].(map[string]any)
			delete(calendar, "anchorField")
			delete(relative, "anchor")
			if !tc.omit {
				calendar["anchorField"] = tc.field
				relative["anchor"] = tc.anchor
			} else if tc.anchor != nil {
				relative["anchor"] = tc.anchor
			}
			input, err := json.Marshal(sample)
			require.NoError(t, err)
			spec, err := DecodeJSON(input)
			if err == nil {
				err = spec.Validate()
			}
			if tc.valid {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
	decoded, err := DecodeJSON(wire)
	require.NoError(t, err)
	require.Equal(t, "mode", decoded.Scope.Params[0].DatePresets.ValueParameter)
	require.NoError(t, decoded.Validate())
	require.Equal(t, "dates.latestDate", *decoded.Scope.Params[0].DatePresets.Calendar.AnchorField)
	decoded.Scope.Params[0].DatePresets.Calendar.AnchorField = text("dates.__proto__")
	require.Error(t, decoded.Validate())
	decoded.Scope.Params[0].DatePresets.Calendar.AnchorField = text("dates.latestDate")
	again, err := json.Marshal(decoded)
	require.NoError(t, err)
	roundTrip, err := DecodeJSON(again)
	require.NoError(t, err)
	require.Equal(t, decoded.Scope.Params[0].DatePresets, roundTrip.Scope.Params[0].DatePresets)
	decoded.Scope.Params[0].DatePresets.Options[0].Range.Anchor = text("invalid")
	require.Error(t, decoded.Validate())
	decoded.Scope.Params[0].DatePresets.Options[0].Range.Anchor = text("sourceDate")
	decoded.Scope.Params[0].DatePresets.Calendar.AnchorField = text("")
	require.Error(t, decoded.Validate())
	decoded.Scope.Params[0].DatePresets.Calendar.AnchorField = text("dates.latestDate")
	decoded.Scope.Params[1].Kind = "integer"
	require.Error(t, decoded.Validate())
}
