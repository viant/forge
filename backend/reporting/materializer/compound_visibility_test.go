package materializer

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCompoundVisibilityUsesIndependentFilterAndMetricInPrint(t *testing.T) {
	for _, mode := range []string{"summary", "detail"} {
		for _, ready := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s_ready%t", mode, ready), func(t *testing.T) {
				raw, err := os.ReadFile("testdata/presentation-report.json")
				require.NoError(t, err)
				var spec map[string]any
				require.NoError(t, json.Unmarshal(raw, &spec))
				spec["scope"] = map[string]any{"dataSourceRef": "approved", "params": []any{map[string]any{"id": "mode", "label": "Mode", "kind": "select", "value": mode}}}
				spec["blocks"] = []any{map[string]any{
					"id": "metric", "kind": "kpiBlock", "title": "Ready records", "datasetRef": "primary", "valueField": "impressions", "valueLabel": "Records",
					"runtime": map[string]any{"visibleWhen": map[string]any{"all": []any{
						map[string]any{"selector": "dashboard.filters.mode", "equals": "detail"},
						map[string]any{"all": []any{map[string]any{"source": "metrics", "selector": "ready", "equals": true}}},
					}}},
				}}
				spec["layoutIntent"] = map[string]any{"kind": "stack", "blockOrder": []string{"metric"}}
				raw, err = json.Marshal(spec)
				require.NoError(t, err)
				payload, err := json.Marshal(map[string]any{"rows": []any{map[string]any{"impressions": 5, "ready": ready}}})
				require.NoError(t, err)
				artifacts, err := Materialize(t.Context(), raw, map[string]json.RawMessage{"primary": payload})
				require.NoError(t, err)
				var print struct {
					Pages []struct {
						Elements []struct {
							ID string `json:"id"`
						} `json:"elements"`
					} `json:"pages"`
				}
				require.NoError(t, json.Unmarshal(artifacts.ReportPrint, &print))
				found := false
				for _, page := range print.Pages {
					for _, element := range page.Elements {
						if element.ID == "metric__card" {
							found = true
						}
					}
				}
				require.Equal(t, mode == "detail" && ready, found, "server print must preserve both independent visibility inputs")
			})
		}
	}
}
