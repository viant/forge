package materializer

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDonutSliceResolvedCenterRatio(t *testing.T) {
	var fixture struct {
		ChartSpec         map[string]any
		Rows, SummaryRows []map[string]any
		ExpectedLabels    []any
	}
	raw, err := os.ReadFile("../../../doc/examples/donut-center-ratio.json")
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &fixture))
	raw, err = os.ReadFile("testdata/presentation-report.json")
	require.NoError(t, err)
	var spec map[string]any
	require.NoError(t, json.Unmarshal(raw, &spec))
	chart := map[string]any{"type": "donut", "appearance": "document", "center": fixture.ChartSpec["center"], "sliceLabel": fixture.ChartSpec["sliceLabel"], "series": map[string]any{"nameKey": "category", "valueKey": "items"}}
	spec["blocks"] = []any{map[string]any{"id": "capacity", "kind": "chartBlock", "title": "Capacity share", "datasetRef": "primary", "chartSpec": fixture.ChartSpec, "chartModel": chart}}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"capacity"}}
	spec["datasets"] = []any{map[string]any{"id": "primary", "dataSourceRef": "sample", "request": map[string]any{}}, map[string]any{"id": "summary", "dataSourceRef": "summary", "request": map[string]any{}}}
	raw, err = json.Marshal(spec)
	require.NoError(t, err)
	encode := func(value any) json.RawMessage {
		data, err := json.Marshal(value)
		require.NoError(t, err)
		return data
	}
	for _, capacity := range []any{4.004, float64(0), nil} {
		t.Run(string(encode(capacity)), func(t *testing.T) {
			primary := encode(map[string]any{"rows": fixture.Rows, "hasMore": false})
			summary := encode(map[string]any{"rows": []map[string]any{{"capacity": capacity}}, "hasMore": false})
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": primary, "summary": summary})
			require.NoError(t, err)
			var fill map[string]any
			require.NoError(t, json.Unmarshal(artifacts.ReportFill, &fill))
			resolved := fill["blocks"].([]any)[0].(map[string]any)["content"].(map[string]any)["resolvedChart"].(map[string]any)
			labels := []any{}
			for _, value := range resolved["rows"].([]any) {
				labels = append(labels, value.(map[string]any)["sliceLabel"])
			}
			if capacity == 4.004 {
				require.Equal(t, fixture.ExpectedLabels, labels)
				for _, text := range []string{"50.0%", "0.0%", "150.0%", "100.0%"} {
					require.Contains(t, string(artifacts.ReportPrint), text)
				}
			} else {
				require.Equal(t, make([]any, len(fixture.Rows)), labels)
				require.NotContains(t, string(artifacts.ReportPrint), "150.0%")
			}
			// The source dataset stays at its original grain with native numeric/null values.
			datasets := fill["datasets"].([]any)
			require.Len(t, datasets, 2)
			require.JSONEq(t, string(encode(fixture.Rows)), string(encode(datasets[0].(map[string]any)["rows"])))
			require.Equal(t, []any{map[string]any{"capacity": capacity}}, datasets[1].(map[string]any)["rows"])
		})
	}
}
