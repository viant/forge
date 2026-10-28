package xlsx

import (
	"fmt"
	"hash/fnv"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

// This independently authored public example models neutral measurements only.
// FORGE_XLSX_EXAMPLE optionally saves the actual production renderer output for
// inspection in Excel or another workbook engine; generated files stay untracked.
func TestDashboardVisualExample(t *testing.T) {
	report := visualExample(t)
	workbook, data := openDashboard(t, report)
	require.Equal(t, []string{"Dashboard", "Overview", "Comparison", "Chart Measurements over time", "Chart Measurements by period", "Data primary"}, workbook.GetSheetList())
	entries := workbookZIP(t, data)
	for i, source := range []string{"Chart Measurements over time", "Chart Measurements by period"} {
		chart := entries[fmt.Sprintf("xl/charts/chart%d.xml", i+1)]
		require.Contains(t, chart, strings.ReplaceAll(sheetReference(source), "'", "&#39;")+"$B$5:$B$16")
		require.Contains(t, chart, `<plotVisOnly val="1">`)
		require.Contains(t, entries[fmt.Sprintf("xl/worksheets/sheet%d.xml", i+4)], `autoFilter ref="$A$4:$C$16"`)
		require.Contains(t, entries[fmt.Sprintf("xl/worksheets/sheet%d.xml", i+2)], "drawing")
	}
	require.Contains(t, entries["xl/charts/chart1.xml"], "137CBD")
	require.Equal(t, "Series A", mustCellValue(t, workbook, "Chart Measurements over time", "B4"))
	require.Equal(t, "12.125", rawCell(t, workbook, "Chart Measurements over time", "B5"))
	require.Equal(t, "Period 12", mustCellValue(t, workbook, "Data primary", "C16"))
	require.Contains(t, entries["xl/workbook.xml"], "_xlnm.Print_Area")
	require.Contains(t, entries["xl/worksheets/sheet2.xml"], `orientation="landscape"`)
	require.Contains(t, entries["xl/worksheets/sheet2.xml"], `showGridLines="false"`)
	if path := os.Getenv("FORGE_XLSX_EXAMPLE"); path != "" {
		require.NoError(t, os.WriteFile(path, data, 0600))
	}
}

func visualExample(t *testing.T) *reportfill.ReportFill {
	report := dashboardFixture(t)
	rows := make([]map[string]any, 12)
	for i := range rows {
		rows[i] = map[string]any{"period": fmt.Sprintf("Period %02d", i+1), "alpha": 12.125 + float64(i)*1.5, "beta": 3.5 + float64((i*3)%7)}
	}
	report.Datasets[0].Rows = rows
	report.Datasets[0].Provenance.RowCount = len(rows)
	report.Parameters = map[string]any{"period": "Synthetic 12-period sample", "scope": "All measurements"}
	columns := []reportfill.TableColumn{{Key: "period", Label: "Period"}, {Key: "alpha", Label: "Series A", Format: "number"}, {Key: "beta", Label: "Series B", Format: "number"}}
	for _, index := range []int{2, 4} {
		block := &report.Blocks[index]
		block.Title = "Measurement preview"
		block.Columns = columns
		block.Content = &reportfill.TableContent{Columns: columns, RowCount: 3, ResolvedRows: []reportfill.ResolvedTableRow{}}
		for i := 0; i < 3; i++ {
			cells := []reportfill.ResolvedTableCell{}
			for _, column := range columns {
				cells = append(cells, reportfill.ResolvedTableCell{Key: column.Key, SourceKey: column.Key, DisplayKey: column.Key, Value: rows[i][column.Key], DisplayValue: fmt.Sprint(rows[i][column.Key])})
			}
			block.Content.ResolvedRows = append(block.Content.ResolvedRows, reportfill.ResolvedTableRow{RowIndex: i, Cells: cells})
		}
	}
	report.Blocks[0].TabGroupContent.Tabs = []reportfill.TabGroupTab{{ID: "second", Title: "Overview"}, {ID: "first", Title: "Comparison"}}
	for i, entry := range []struct{ id, title, kind, section string }{{"trend", "Measurements over time", "line", "second"}, {"comparison", "Measurements by period", "bar", "first"}} {
		count := len(rows)
		model := map[string]any{"type": entry.kind, "xAxis": map[string]any{"label": "Period"}, "yAxis": map[string]any{"label": "Measurement", "format": "number"}, "series": map[string]any{"values": []any{map[string]any{"value": "alpha", "label": "Series A", "color": "#137cbd", "format": "number"}, map[string]any{"value": "beta", "label": "Series B", "color": "#0f9960", "format": "number"}}}}
		block := reportfill.Block{ID: entry.id, Kind: "chartBlock", Title: entry.title, DatasetRef: "primary", ChartSpec: map[string]any{"type": entry.kind}, ChartModel: model, ChartContent: &reportfill.ChartContent{ChartSpec: map[string]any{"type": entry.kind}, ChartModel: model, RowCount: &count, ResolvedChart: &reportfill.ResolvedChart{Kind: "directSeries", Type: entry.kind, XAxisKey: "period", SeriesKeys: []string{"alpha", "beta"}, Rows: rows}}}
		report.Blocks = append(report.Blocks, block)
		sectionIndex := 3
		if i == 1 {
			sectionIndex = 1
		}
		report.Blocks[sectionIndex].SectionContent.BlockIDs = []string{entry.id, report.Blocks[sectionIndex+1].ID}
	}
	return report
}

func TestDashboardChartSourcesRemainIndependent(t *testing.T) {
	book, _ := openDashboard(t, visualExample(t))
	// Exercise a real local filtering operation and a source edit, then save and
	// reopen. Native Excel rendering is additionally checked on the example.
	require.NoError(t, book.AutoFilter("Chart Measurements over time", "A4:C16", []excelize.AutoFilterOptions{{Column: "A", Expression: `x == "Period 01"`}}))
	for row := 6; row <= 16; row++ {
		require.NoError(t, book.SetRowVisible("Chart Measurements over time", row, false))
	}
	require.NoError(t, book.SetCellFloat("Chart Measurements over time", "B5", 99.25, -1, 64))
	require.Equal(t, "12.125", rawCell(t, book, "Chart Measurements by period", "B5"))
	visible, err := book.GetRowVisible("Chart Measurements by period", 6)
	require.NoError(t, err)
	require.True(t, visible)
	require.Equal(t, "12.125", rawCell(t, book, "Data primary", "A5"))
}

func TestDashboardUnsupportedAndInvalidChartSemanticsAreVisible(t *testing.T) {
	for _, variant := range []string{"unsupported", "unsupported-series", "numeric-text"} {
		t.Run(variant, func(t *testing.T) {
			report := visualExample(t)
			content := report.Blocks[5].ChartContent
			switch variant {
			case "unsupported":
				content.ResolvedChart.Type = "custom"
			case "unsupported-series":
				chartMap(chartValues(content.ChartModel)[0])["type"] = "custom"
			case "numeric-text":
				content.ResolvedChart.Rows[0]["alpha"] = "=1+2"
			}
			book, data := openDashboard(t, report)
			rows, err := book.GetRows("Overview")
			require.NoError(t, err)
			text := ""
			for _, row := range rows {
				text += strings.Join(row, " ")
			}
			require.Contains(t, text, "Native Excel visual unavailable")
			require.NotContains(t, workbookZIP(t, data)["xl/worksheets/sheet2.xml"], "<drawing")
			if variant == "numeric-text" {
				require.Equal(t, "=1+2", mustCellValue(t, book, "Chart Measurements over time", "B5"))
				formula, err := book.GetCellFormula("Chart Measurements over time", "B5")
				require.NoError(t, err)
				require.Empty(t, formula)
			}
		})
	}
}

func TestDashboardRejectsFinalPageOffset(t *testing.T) {
	hash := fnv.New32a()
	_, err := hash.Write([]byte(`{"limit":25,"offset":25}`))
	require.NoError(t, err)
	input := strings.Replace(validTestReportFillJSON(), `"offset": 0`, `"offset": 25`, 1)
	input = strings.Replace(input, "fnv1a:9702fdec", fmt.Sprintf("fnv1a:%08x", hash.Sum32()), 1)
	report, err := reportfill.DecodeJSON([]byte(input))
	require.NoError(t, err)
	_, err = RenderDashboard(report)
	require.ErrorContains(t, err, "requires complete dataset")
}

func TestDashboardNativeCombinationAxesAndLabels(t *testing.T) {
	report := visualExample(t)
	model := report.Blocks[5].ChartContent.ChartModel
	values := chartValues(model)
	chartMap(values[0])["type"] = "bar"
	chartMap(values[0])["dataLabels"] = "always"
	chartMap(values[1])["axis"] = "right"
	chartMap(values[1])["format"] = "percentFraction"
	_, data := openDashboard(t, report)
	chart := workbookZIP(t, data)["xl/charts/chart1.xml"]
	require.Contains(t, chart, "<barChart>")
	require.Contains(t, chart, "<lineChart>")
	require.Contains(t, chart, `<axPos val="r">`)
	require.Contains(t, chart, `<showVal val="1">`)
	require.Contains(t, chart, "Period")
	require.Contains(t, chart, "Measurement")
}

func TestDashboardNativeCategoryColors(t *testing.T) {
	report := chartFixture(t, "category", "pie", []map[string]any{{"name": "Alpha", "value": 2}, {"name": "Beta", "value": 3}})
	report.Blocks[len(report.Blocks)-1].ChartContent.ChartModel["series"] = map[string]any{"categoryColors": map[string]any{"alpha": "#123456", "BETA": "var(--category, #abcdef)"}}
	_, data := openDashboard(t, report)
	chart := workbookZIP(t, data)["xl/charts/chart1.xml"]
	require.Contains(t, chart, `<a:srgbClr val="123456">`)
	require.Contains(t, chart, `<a:srgbClr val="ABCDEF">`)
	require.Equal(t, 2, strings.Count(chart, "<dPt>"))
}

func TestDashboardRejectsOversizedTextWithoutPartialWorkbook(t *testing.T) {
	report := dashboardFixture(t)
	report.Datasets[0].Rows[0]["channel"] = strings.Repeat("x", 32768)
	data, err := RenderDashboard(report)
	require.ErrorContains(t, err, "text length limit")
	require.Empty(t, data)
}
