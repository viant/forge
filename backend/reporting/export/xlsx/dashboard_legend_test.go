package xlsx

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNativeChartLegendVisibility(t *testing.T) {
	for _, visibility := range []any{nil, true, false} {
		artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
			model := map[string]any{"type": "bar", "xAxis": map[string]any{"dataKey": "period"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "label": "Inventory units", "type": "bar"}}}}
			if visibility != nil {
				model["showLegend"] = visibility
			}
			spec["blocks"] = []any{map[string]any{"id": "inventory", "kind": "chartBlock", "datasetRef": "primary", "chartSpec": map[string]any{"type": "bar", "xField": "period", "yFields": []string{"value"}}, "chartModel": model}}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"inventory"}}
			inputs["primary"] = json.RawMessage(`{"rows":[{"period":"Q1","value":7},{"period":"Q2","value":4}]}`)
		})
		data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
		require.NoError(t, err)
		xml := workbookZIP(t, data)["xl/charts/chart1.xml"]
		require.NotEmpty(t, xml)
		if visibility == false {
			require.NotContains(t, xml, "<legend>")
		} else {
			require.Contains(t, xml, "<legend>")
		}
		require.Contains(t, xml, "<barChart>")
	}
}
