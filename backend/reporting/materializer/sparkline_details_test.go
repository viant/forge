package materializer

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"os"
	"testing"
)

func TestSparklineDetailsBundledFillPrint(t *testing.T) {
	raw, err := os.ReadFile("testdata/presentation-report.json")
	require.NoError(t, err)
	var spec map[string]any
	require.NoError(t, json.Unmarshal(raw, &spec))
	details := map[string]any{"categoryLabel": "Date", "categoryFormat": "date", "valueLabel": "Temperature", "valueFormat": "number2", "unit": "°C", "print": "details"}
	spec["datasets"] = []any{map[string]any{"id": "primary", "dataSourceRef": "readings", "request": map[string]any{"limit": 100, "offset": 0}}, map[string]any{"id": "prior", "dataSourceRef": "readings", "request": map[string]any{"limit": 100, "offset": 0}}}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"temperature"}}
	spec["blocks"] = []any{map[string]any{"id": "temperature", "kind": "kpiBlock", "title": "Temperature", "datasetRef": "primary", "valueField": "reading", "valueLabel": "Temperature", "sparkline": map[string]any{"datasetRef": "primary", "comparisonDatasetRef": "prior", "categoryField": "day", "valueField": "reading", "details": details}}}
	raw, err = json.Marshal(spec)
	require.NoError(t, err)
	payloads := map[string]json.RawMessage{"primary": json.RawMessage(`{"hasMore":false,"rows":[{"day":"2026-01-01","reading":0},{"day":"2026-01-02","reading":null},{"day":"2026-01-03","reading":8}]}`), "prior": json.RawMessage(`{"hasMore":false,"rows":[{"day":"2025-12-01","reading":4}]}`)}
	result, err := Materialize(context.Background(), raw, payloads)
	require.NoError(t, err)
	_, err = reportfill.DecodeJSON(result.ReportFill)
	require.NoError(t, err)
	require.Contains(t, string(result.ReportPrint), "2025-12-01")
	require.Contains(t, string(result.ReportPrint), "Temperature: 0")
	var fill map[string]any
	require.NoError(t, json.Unmarshal(result.ReportFill, &fill))
	content := fill["blocks"].([]any)[0].(map[string]any)["content"].(map[string]any)["sparkline"].(map[string]any)
	points := content["details"].(map[string]any)["points"].([]any)
	require.Len(t, points, 3)
	require.Nil(t, content["values"].([]any)[1])
	points[0].(map[string]any)["index"] = 1
	invalid, _ := json.Marshal(fill)
	_, err = reportfill.DecodeJSON(invalid)
	require.Error(t, err, "a null gap cannot be an interactive value detail")
	details["print"] = "omit"
	raw, _ = json.Marshal(spec)
	result, err = Materialize(context.Background(), raw, payloads)
	require.NoError(t, err)
	require.NotContains(t, string(result.ReportPrint), "2025-12-01")
}
