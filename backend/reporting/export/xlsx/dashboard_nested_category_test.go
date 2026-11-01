package xlsx

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

func TestNativeNestedCategoriesFromReportFill(t *testing.T) {
	for _, mapped := range []bool{false, true} {
		t.Run(fmt.Sprintf("valueMap=%t", mapped), func(t *testing.T) {
			artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
				axis := map[string]any{"dataKey": "equipment.label", "sourceDataKey": "equipmentId", "label": "Equipment"}
				if mapped {
					axis["displayValueMap"] = map[string]any{"17": "Pump", "18": "Valve", "19": "=1+2", "20": "<Motor & Fan>"}
				}
				model := map[string]any{"type": "horizontal_bar", "preserveCategoryOrder": true, "xAxis": axis, "series": map[string]any{"values": []any{map[string]any{"value": "amount", "type": "horizontal_bar"}}}}
				spec["title"] = "Independently invented equipment measurements"
				spec["blocks"] = []any{map[string]any{"id": "ranking", "kind": "chartBlock", "title": "Equipment ranking", "datasetRef": "primary", "rowLimit": 2, "chartSpec": map[string]any{"type": "horizontal_bar", "xField": "equipment.label", "yFields": []string{"amount"}}, "chartModel": model}}
				spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"ranking"}}
				rows := []map[string]any{
					{"equipmentId": 17, "equipment": map[string]any{"label": "Pump"}, "amount": 12.125},
					{"equipmentId": 18, "equipment": map[string]any{"label": "Valve"}, "amount": 8.5},
					{"equipmentId": 19, "equipment": map[string]any{"label": "=1+2"}, "amount": 6.25},
					{"equipmentId": 20, "equipment": map[string]any{"label": "<Motor & Fan>"}, "amount": 4.75},
				}
				if mapped {
					for _, record := range rows {
						record["equipment"] = nil
					}
				}
				data, err := json.Marshal(map[string]any{"rows": rows})
				require.NoError(t, err)
				inputs["primary"] = data
			})
			fill, err := reportfill.DecodeDatasourceJSON(artifacts.ReportFill)
			require.NoError(t, err)
			require.Equal(t, "equipment.label", fill.Blocks[0].ChartContent.ResolvedChart.XAxisKey)
			require.Equal(t, "Pump", chartMap(fill.Blocks[0].ChartContent.ResolvedChart.Rows[0]["equipment"])["label"])
			for _, withPrint := range []bool{false, true} {
				var data []byte
				if withPrint {
					data, err = RenderDatasourceDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
				} else {
					data, err = RenderDashboard(fill)
				}
				require.NoError(t, err)
				book, err := excelize.OpenReader(bytes.NewReader(data))
				require.NoError(t, err)
				t.Cleanup(func() { require.NoError(t, book.Close()) })
				for index, label := range []string{"Pump", "Valve", "=1+2", "<Motor & Fan>"} {
					cell := fmt.Sprintf("A%d", index+5)
					require.Equal(t, label, mustCellValue(t, book, "Chart Equipment ranking", cell), "withPrint=%t", withPrint)
					formula, err := book.GetCellFormula("Chart Equipment ranking", cell)
					require.NoError(t, err)
					require.Empty(t, formula)
				}
				require.Equal(t, "12.125", rawCell(t, book, "Chart Equipment ranking", "B5"))
				require.Equal(t, "4.75", rawCell(t, book, "Chart Equipment ranking", "B8"))
				dataset, err := book.GetRows("Data primary")
				require.NoError(t, err)
				require.Contains(t, dataset[4], "17")
				require.Contains(t, dataset[7], "20")
				if !mapped {
					require.Contains(t, dataset[4], `{"label":"Pump"}`)
				}
				chartXML := workbookZIP(t, data)["xl/charts/chart1.xml"]
				var chart struct {
					Categories struct {
						Formula string `xml:"f"`
						Points  []struct {
							Value string `xml:"v"`
						} `xml:"strCache>pt"`
					} `xml:"chart>plotArea>barChart>ser>cat>strRef"`
				}
				require.NoError(t, xml.Unmarshal([]byte(chartXML), &chart))
				require.NotEmpty(t, chart.Categories.Points, "%s", chartXML)
				require.Equal(t, "Pump", chart.Categories.Points[0].Value)
				require.Equal(t, "Valve", chart.Categories.Points[1].Value)
				if !withPrint {
					require.Len(t, chart.Categories.Points, 4)
					require.Equal(t, "<Motor & Fan>", chart.Categories.Points[3].Value)
					require.Contains(t, chart.Categories.Formula, "$A$5:$A$8")
				} else {
					require.Len(t, chart.Categories.Points, 2)
					require.Contains(t, chart.Categories.Formula, "$A$5:$A$6")
				}
			}
		})
	}
}

func TestNativeDeclaredNestedCategoryLookup(t *testing.T) {
	rows := nestedEquipmentRows()
	block := reportfill.Block{ChartContent: &reportfill.ChartContent{ResolvedChart: &reportfill.ResolvedChart{Kind: "directSeries", Type: "bar", XAxisKey: "equipment.label", SeriesKeys: []string{"amount"}, Rows: rows}}}
	before, err := json.Marshal(block)
	require.NoError(t, err)
	_, got, err := chartDisplayTable(block)
	require.NoError(t, err)
	require.Equal(t, [][]any{{"Pump", 5}, {"Backup pump", 4}, {"Literal", 3}, {nil, 2}, {nil, nil}, {nil, 0}}, got)
	after, err := json.Marshal(block)
	require.NoError(t, err)
	require.Equal(t, before, after)
	for _, path := range []string{"equipment.label++", "++equipment.label", "<-equipment.label", "$equipment.label", "{equipment.label}", "equipment[label]", "equipment.*", "equipment..label", "equipment.__proto__.label", "equipment.constructor.label", "equipment.prototype.label", "equipment.label;throw 1"} {
		block.ChartContent.ResolvedChart.XAxisKey = path
		_, got, err = chartDisplayTable(block)
		require.NoError(t, err)
		for _, record := range got {
			require.Nil(t, record[0], path)
		}
	}
	block.ChartContent.ResolvedChart.XAxisKey = "equipment.label"
	after, err = json.Marshal(block)
	require.NoError(t, err)
	require.Equal(t, before, after)
}

func nestedEquipmentRows() []map[string]any {
	return []map[string]any{
		{"equipmentId": 17, "equipment": map[string]any{"label": "Pump"}, "amount": 5},
		{"equipmentId": 17, "equipment": map[string]any{"label": "Backup pump"}, "amount": 4},
		{"equipmentId": 19, "equipment.label": "Literal", "equipment": map[string]any{"label": "Nested"}, "amount": 3},
		{"equipmentId": 20, "equipment.label": nil, "equipment": map[string]any{"label": "Not a fallback"}, "amount": 2},
		{"equipmentId": 21, "equipment": nil, "amount": nil},
		{"equipmentId": 22, "amount": 0},
	}
}

func TestNativeNestedCategoryWorkbookPreservesResolvedRows(t *testing.T) {
	report := dashboardFixture(t)
	rows := nestedEquipmentRows()
	limit := 2
	count := len(rows)
	model := map[string]any{"type": "bar", "xAxis": map[string]any{"dataKey": "equipment.label", "sourceDataKey": "equipmentId"}, "series": map[string]any{"values": []any{map[string]any{"value": "amount"}}}}
	spec := map[string]any{"type": "bar", "xField": "equipment.label", "yFields": []string{"amount"}}
	report.Blocks = []reportfill.Block{{ID: "equipment", Kind: "chartBlock", Title: "Equipment samples", DatasetRef: "primary", RowLimit: &limit, ChartSpec: spec, ChartModel: model, ChartContent: &reportfill.ChartContent{ChartSpec: spec, ChartModel: model, RowCount: &count, ResolvedChart: &reportfill.ResolvedChart{Kind: "directSeries", Type: "bar", XAxisKey: "equipment.label", SeriesKeys: []string{"amount"}, Rows: rows}}}}
	report.Datasets = report.Datasets[:1]
	report.Datasets[0].Rows = rows
	report.Datasets[0].Provenance.RowCount = len(rows)
	before, err := json.Marshal(report)
	require.NoError(t, err)
	book, data := openDashboard(t, report)
	for index, expected := range []string{"Pump", "Backup pump", "Literal", "", "", ""} {
		require.Equal(t, expected, mustCellValue(t, book, "Chart Equipment samples", fmt.Sprintf("A%d", index+5)))
	}
	require.Empty(t, rawCell(t, book, "Chart Equipment samples", "B9"))
	require.Equal(t, "0", rawCell(t, book, "Chart Equipment samples", "B10"))
	var chart struct {
		Points []struct {
			Index int    `xml:"idx,attr"`
			Value string `xml:"v"`
		} `xml:"chart>plotArea>barChart>ser>cat>strRef>strCache>pt"`
	}
	require.NoError(t, xml.Unmarshal([]byte(workbookZIP(t, data)["xl/charts/chart1.xml"]), &chart))
	require.Len(t, chart.Points, len(rows))
	for index, expected := range []string{"Pump", "Backup pump", "Literal", "", "", ""} {
		require.Equal(t, index, chart.Points[index].Index)
		require.Equal(t, expected, chart.Points[index].Value)
	}
	dataset, err := book.GetRows("Data primary")
	require.NoError(t, err)
	require.Contains(t, dataset[4], "17")
	require.Contains(t, dataset[5], "17")
	require.Contains(t, dataset[5], `{"label":"Backup pump"}`)
	require.Contains(t, dataset[7], `{"label":"Not a fallback"}`)
	after, err := json.Marshal(report)
	require.NoError(t, err)
	require.Equal(t, before, after)
}

func TestNativeCategoryWorkbookMissingFirstLabel(t *testing.T) {
	for _, entry := range []struct {
		name   string
		rows   []map[string]any
		key    string
		labels []string
	}{
		{"canonical", []map[string]any{{"value": 2}, {"name": "Pump", "value": 3}}, "name", []string{"", "Pump"}},
		{"nested", []map[string]any{{"value": 2}, {"equipment": map[string]any{"label": "Pump"}, "value": 3}}, "equipment.label", []string{"", "Pump"}},
		{"direct nil first", []map[string]any{{"equipment.label": nil, "equipment": map[string]any{"label": "Ignored"}, "name": "Not a fallback", "value": 2}, {"equipment": map[string]any{"label": "Pump"}, "value": 3}}, "equipment.label", []string{"", "Pump"}},
		{"direct nil later", []map[string]any{{"value": 2}, {"equipment.label": nil, "equipment": map[string]any{"label": "Ignored"}, "name": "Not a fallback", "value": 3}}, "equipment.label", []string{"", ""}},
	} {
		t.Run(entry.name, func(t *testing.T) {
			report := chartFixture(t, "category", "pie", entry.rows)
			report.Blocks[len(report.Blocks)-1].ChartContent.ResolvedChart.NameKey = "equipment.label"
			before, err := json.Marshal(report)
			require.NoError(t, err)
			book, data := openDashboard(t, report)
			require.Equal(t, entry.key, mustCellValue(t, book, "Chart Trend", "A4"))
			for index, expected := range entry.labels {
				require.Equal(t, expected, mustCellValue(t, book, "Chart Trend", fmt.Sprintf("A%d", index+5)))
				require.Equal(t, fmt.Sprint(index+2), rawCell(t, book, "Chart Trend", fmt.Sprintf("B%d", index+5)))
			}
			var chart struct {
				Formula string `xml:"chart>plotArea>pieChart>ser>cat>strRef>f"`
				Points  []struct {
					Index int    `xml:"idx,attr"`
					Value string `xml:"v"`
				} `xml:"chart>plotArea>pieChart>ser>cat>strRef>strCache>pt"`
			}
			require.NoError(t, xml.Unmarshal([]byte(workbookZIP(t, data)["xl/charts/chart1.xml"]), &chart))
			require.Equal(t, "'Chart Trend'!$A$5:$A$6", chart.Formula)
			require.Len(t, chart.Points, len(entry.labels))
			for index, expected := range entry.labels {
				require.Equal(t, index, chart.Points[index].Index)
				require.Equal(t, expected, chart.Points[index].Value)
			}
			after, err := json.Marshal(report)
			require.NoError(t, err)
			require.Equal(t, before, after)
		})
	}
}

func TestNativeNestedCategoryShapes(t *testing.T) {
	for _, entry := range []struct {
		name  string
		chart reportfill.ResolvedChart
		want  [][]any
	}{
		{"authored category", reportfill.ResolvedChart{Kind: "category", NameKey: "equipment.label", ValueKey: "amount", Rows: []map[string]any{{"equipment": nil, "amount": 2}, {"equipment": map[string]any{"label": "Pump"}, "amount": 3}}}, [][]any{{nil, 2}, {"Pump", 3}}},
		{"canonical category", reportfill.ResolvedChart{Kind: "category", NameKey: "equipment.label", ValueKey: "amount", Rows: []map[string]any{{"name": "Pump", "value": 3}}}, [][]any{{"Pump", 3}}},
		{"long grouped", reportfill.ResolvedChart{Kind: "groupedSeries", XAxisKey: "equipment.label", NameKey: "series", ValueKey: "amount", SeriesKeys: []string{"first", "second"}, Rows: []map[string]any{{"equipment": map[string]any{"label": "Pump"}, "series": "first", "amount": 3}, {"equipment": map[string]any{"label": "Pump"}, "series": "second", "amount": 4}}}, [][]any{{"Pump", 3, 4}}},
	} {
		t.Run(entry.name, func(t *testing.T) {
			_, rows, err := chartDisplayTable(reportfill.Block{ChartContent: &reportfill.ChartContent{ResolvedChart: &entry.chart}})
			require.NoError(t, err)
			require.Equal(t, entry.want, rows)
		})
	}
}

func TestNativeCategoryCacheRejectsNonliteralRanges(t *testing.T) {
	book := excelize.NewFile()
	t.Cleanup(func() { require.NoError(t, book.Close()) })
	for _, formula := range []string{"'[other.xlsx]Sheet1'!$A$1:$A$2", "'Sheet1'!$A$0:$A$2", "'Sheet1'!$A$1:$A$1048577", "'Sheet1'!$A$2:$A$1", "'Sheet1'!$A$1:$B$2", "'Sheet1'!OFFSET(A1,0,0,2)", "'Sheet1'!$A$1:$A$2;throw 1"} {
		var escaped bytes.Buffer
		require.NoError(t, xml.EscapeText(&escaped, []byte(formula)))
		_, err := nativeCategoryCaches([]byte("<cat><strRef><f>"+escaped.String()+"</f></strRef></cat>"), book)
		require.Error(t, err, formula)
	}
	sheet := "Pump's readings"
	_, err := book.NewSheet(sheet)
	require.NoError(t, err)
	require.NoError(t, book.SetCellStr(sheet, "A5", "<Pump & valve>"))
	result, err := nativeCategoryCaches([]byte(`<cat><strRef><f>'Pump''s readings'!$A$5:$A$5</f><strCache><ptCount val="0"></ptCount></strCache></strRef></cat>`), book)
	require.NoError(t, err)
	require.Equal(t, 1, bytes.Count(result, []byte("<strCache>")))
	var category struct {
		Value string `xml:"strRef>strCache>pt>v"`
	}
	require.NoError(t, xml.Unmarshal(result, &category))
	require.Equal(t, "<Pump & valve>", category.Value)
	for _, kind := range []string{"directSeries", "category"} {
		block := reportfill.Block{ChartContent: &reportfill.ChartContent{ResolvedChart: &reportfill.ResolvedChart{Kind: kind, XAxisKey: "equipment.label", NameKey: "equipment.label"}}}
		_, rows, err := chartDisplayTable(block)
		require.NoError(t, err)
		require.Empty(t, rows)
	}
}
