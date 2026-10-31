package xlsx

import (
	"bytes"
	"encoding/json"
	"math"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

// Independently invented categories exercise native chart source order, its
// limited cohort, and the complete exported dataset without report identities.
func TestNativeHorizontalChartDisplayOrder(t *testing.T) {
	for _, preserve := range []bool{false, true} {
		artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
			spec["blocks"] = []any{map[string]any{"id": "ranking", "kind": "chartBlock", "title": "Category ranking", "datasetRef": "primary", "rowLimit": 3, "chartSpec": map[string]any{"type": "horizontal_bar", "xField": "period", "yFields": []string{"value"}}, "chartModel": map[string]any{"type": "horizontal_bar", "preserveCategoryOrder": preserve, "xAxis": map[string]any{"dataKey": "period"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "type": "horizontal_bar"}}}}}}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"ranking"}}
			inputs["primary"] = json.RawMessage(`{"rows":[{"period":"Cedar","value":4},{"period":"Maple","value":9},{"period":"Birch","value":6},{"period":"Willow","value":30}]}`)
		})
		data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
		require.NoError(t, err)
		workbook, err := excelize.OpenReader(bytes.NewReader(data))
		require.NoError(t, err)
		defer workbook.Close()
		got, err := workbook.GetRows("Chart Category ranking")
		require.NoError(t, err)
		want := [][]string{{"Maple", "9"}, {"Birch", "6"}, {"Cedar", "4"}, {"Willow", "30"}}
		if preserve {
			want = [][]string{{"Cedar", "4"}, {"Maple", "9"}, {"Birch", "6"}, {"Willow", "30"}}
		}
		require.Equal(t, want, got[4:8], "preserveCategoryOrder=%t", preserve)
		xml := workbookZIP(t, data)["xl/charts/chart1.xml"]
		require.Contains(t, xml, "&#39;Chart Category ranking&#39;!$A$5:$A$7")
		require.Contains(t, xml, `<orientation val="maxMin">`)
		dataset, err := workbook.GetRows("Data primary")
		require.NoError(t, err)
		require.Equal(t, [][]string{{"Cedar", "4"}, {"Maple", "9"}, {"Birch", "6"}, {"Willow", "30"}}, dataset[4:8])
	}
}

func TestHorizontalDisplayRowsKeepSeriesColorsAndStableTies(t *testing.T) {
	rows := []map[string]any{{"label": "Cedar", "first": 4, "second": 40}, {"label": "Maple", "first": 9, "second": 90}, {"label": "Birch", "first": 9, "second": 60}, {"label": "Willow", "first": nil, "second": 30}, {"label": "Oak", "first": -2, "second": 20}}
	block := reportfill.Block{ChartContent: &reportfill.ChartContent{ChartModel: map[string]any{"series": map[string]any{"categoryColors": map[string]any{"Cedar": "#112233", "Maple": "#445566", "Birch": "#778899", "Willow": "#aabbcc", "Oak": "#ddeeff"}}}, ResolvedChart: &reportfill.ResolvedChart{Kind: "directSeries", Type: "horizontal_bar", XAxisKey: "label", SeriesKeys: []string{"first", "second"}, Rows: rows}}}
	require.True(t, math.IsNaN(horizontalOrderValue("unavailable")))
	before, err := json.Marshal(block)
	require.NoError(t, err)
	_, got, err := chartDisplayTable(block)
	require.NoError(t, err)
	require.Equal(t, [][]any{{"Maple", 9, 90}, {"Birch", 9, 60}, {"Cedar", 4, 40}, {"Willow", nil, 30}, {"Oak", -2, 20}}, got)
	require.Equal(t, []string{"445566", "778899", "112233", "AABBCC", "DDEEFF"}, nativePointColors(block))
	after, err := json.Marshal(block)
	require.NoError(t, err)
	require.Equal(t, before, after)
	for _, tc := range []struct {
		value any
		want  float64
	}{{nil, 0}, {"", 0}, {false, 0}, {true, 1}, {" 2.5 ", 2.5}, {json.Number("-3"), -3}} {
		require.Equal(t, tc.want, horizontalOrderValue(tc.value))
	}
}
