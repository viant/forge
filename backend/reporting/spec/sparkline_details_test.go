package reportspec

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestSparklineDetailsNativeContract(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	details := map[string]any{"categoryLabel": "Date", "categoryFormat": "date", "valueLabel": "Temperature", "valueFormat": "number2", "unit": "°C", "print": "details"}
	fixture["blocks"] = []any{map[string]any{"id": "temperature", "kind": "kpiBlock", "title": "Temperature", "datasetRef": "primary", "valueField": "reading", "valueLabel": "Temperature", "sparkline": map[string]any{"datasetRef": "primary", "categoryField": "day", "valueField": "reading", "details": details}}}
	raw, err := json.Marshal(fixture)
	require.NoError(t, err)
	spec, err := DecodeJSON(raw)
	require.NoError(t, err)
	require.Equal(t, "details", spec.Blocks[0].Sparkline.Details.Print)
	for _, policy := range []string{"", "unknown"} {
		details["print"] = policy
		raw, _ = json.Marshal(fixture)
		_, err = DecodeJSON(raw)
		require.Error(t, err)
	}
	details["print"] = "omit"
	details["valueFormat"] = "javascript"
	raw, _ = json.Marshal(fixture)
	_, err = DecodeJSON(raw)
	require.Error(t, err)
}
