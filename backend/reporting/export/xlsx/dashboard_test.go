package xlsx

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"math"
	"strconv"
	"strings"
	"testing"
	"unicode/utf16"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

// All fixtures are generated from the local synthetic renderer fixture and
// independent neutral values, without application captures or source data.
func dashboardFixture(t *testing.T) *reportfill.ReportFill {
	t.Helper()
	report, err := reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)
	table := report.Blocks[0]
	table.Title = "Details"
	second := table
	second.ID = "secondTable"
	second.Title = "More details"
	// Distinct section labels intentionally collide after Excel name sanitization.
	report.Blocks = []reportfill.Block{
		{ID: "tabs", Kind: "tabGroupBlock", SectionIDs: []string{"second", "first"}, TabGroupContent: &reportfill.TabGroupContent{Title: "Sections", SectionIDs: []string{"second", "first"}, Tabs: []reportfill.TabGroupTab{{ID: "second", Title: "Results/Details"}, {ID: "first", Title: "Results:Details"}}}},
		{ID: "first", Kind: "sectionBlock", SectionContent: &reportfill.SectionContent{Title: "First", NavigationLabel: "First", BlockIDs: []string{table.ID}}},
		table,
		{ID: "second", Kind: "sectionBlock", SectionContent: &reportfill.SectionContent{Title: "Second", NavigationLabel: "Second", BlockIDs: []string{second.ID}}},
		second,
	}
	return report
}

func openDashboard(t *testing.T, report *reportfill.ReportFill) (*excelize.File, []byte) {
	t.Helper()
	data, err := RenderDashboard(report)
	require.NoError(t, err)
	workbook, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, workbook.Close()) })
	return workbook, data
}

func TestRenderDashboardPreservesAuthoredTabsAndFullTypedData(t *testing.T) {
	report := dashboardFixture(t)
	table := &report.Blocks[2]
	// A display-limited table must not discard the remaining admitted data rows.
	table.Content = &reportfill.TableContent{Columns: table.Columns, RowCount: 1, ResolvedRows: table.Content.ResolvedRows[:1]}
	report.Blocks[4].Content = table.Content
	value := 0.11459765000000001
	table.Content.ResolvedRows[0].Cells[1].Value = value
	table.Content.ResolvedRows[0].Cells[1].DisplayValue = "$0.11"
	table.Content.ResolvedRows[0].Cells[0].Value = "=1+2"
	report.Datasets[0].Rows = []map[string]any{}
	for i := 0; i < 80; i++ {
		report.Datasets[0].Rows = append(report.Datasets[0].Rows, map[string]any{"channel": "row " + strconv.Itoa(i), "spend": value, "id": json.Number("9007199254740993"), "enabled": false, "nullable": nil})
	}
	report.Datasets[0].Provenance.RowCount = 80
	report.Datasets[0].Rows[79]["channel"] = "@last-row"
	workbook, _ := openDashboard(t, report)
	require.Equal(t, []string{"Dashboard", "Results-Details", "Results-Details (2)"}, workbook.GetSheetList())
	require.Equal(t, "Results/Details", mustCellValue(t, workbook, "Dashboard", "A3"))
	require.Equal(t, "Results:Details", mustCellValue(t, workbook, "Dashboard", "A5"))
	for _, sheet := range workbook.GetSheetList()[1:] {
		require.Equal(t, "=1+2", mustCellValue(t, workbook, sheet, "A5"))
		formula, err := workbook.GetCellFormula(sheet, "A5")
		require.NoError(t, err)
		require.Empty(t, formula)
		raw, err := workbook.GetCellValue(sheet, "B5", excelize.Options{RawCellValue: true})
		require.NoError(t, err)
		actual, err := strconv.ParseFloat(raw, 64)
		require.NoError(t, err)
		require.Equal(t, value, actual)
		require.Equal(t, "$0.11", mustCellValue(t, workbook, sheet, "B5"))
		require.Equal(t, "Dataset primary", mustCellValue(t, workbook, sheet, "A8"))
		require.Equal(t, "@last-row", mustCellValue(t, workbook, sheet, "A89"))
		require.Equal(t, "9007199254740993", mustCellValue(t, workbook, sheet, "C10"))
		kind, err := workbook.GetCellType(sheet, "C10")
		require.NoError(t, err)
		require.Equal(t, excelize.CellTypeSharedString, kind)
		kind, err = workbook.GetCellType(sheet, "B10")
		require.NoError(t, err)
		require.Equal(t, excelize.CellTypeBool, kind)
		require.Empty(t, mustCellValue(t, workbook, sheet, "D10"))
	}
	// Renderer leaves the interactive fill and its formatted strings untouched.
	require.Equal(t, "$0.11", table.Content.ResolvedRows[0].Cells[1].DisplayValue)
}

func chartFixture(t *testing.T, kind, chartType string, rows []map[string]any) *reportfill.ReportFill {
	t.Helper()
	report := dashboardFixture(t)
	resolved := &reportfill.ResolvedChart{Kind: kind, Type: chartType, XAxisKey: "period", NameKey: "segment", ValueKey: "amount", SeriesKeys: []string{"Alpha", "Beta"}, Rows: rows}
	count := len(rows)
	chart := reportfill.Block{ID: "chart", Kind: "chartBlock", Title: "Trend", DatasetRef: "primary", ChartSpec: map[string]any{"type": chartType}, ChartModel: map[string]any{"type": chartType}, ChartContent: &reportfill.ChartContent{ChartSpec: map[string]any{"type": chartType}, ChartModel: map[string]any{"type": chartType}, RowCount: &count, ResolvedChart: resolved}}
	report.Blocks = append(report.Blocks, chart)
	report.Blocks[1].SectionContent.BlockIDs = append(report.Blocks[1].SectionContent.BlockIDs, "chart")
	return report
}

func TestRenderDashboardNativeChartRelationships(t *testing.T) {
	for _, tc := range []struct {
		kind, chartType, tag string
		rows                 []map[string]any
	}{
		{"directSeries", "line", "lineChart", []map[string]any{{"period": "One", "Alpha": 12.125, "Beta": 3.5}, {"period": "Two", "Alpha": 14.25, "Beta": nil}}},
		{"groupedSeries", "bar", "barChart", []map[string]any{{"period": "One", "Alpha": 12.125, "Beta": 3.5}, {"period": "Two", "Alpha": 14.25, "Beta": nil}}},
		{"groupedSeries", "area", "areaChart", []map[string]any{{"period": "One", "segment": "Alpha", "amount": 12.125}, {"period": "One", "segment": "Beta", "amount": 3.5}, {"period": "Two", "segment": "Alpha", "amount": 14.25}}},
		// JS fills canonicalize category rows; the Go inline compiler keeps authored fields.
		{"category", "pie", "pieChart", []map[string]any{{"name": "Alpha", "value": 12.125}, {"name": "Beta", "value": 3.5}}},
		{"category", "donut", "doughnutChart", []map[string]any{{"segment": "Alpha", "amount": 12.125}, {"segment": "Beta", "amount": 3.5}}},
	} {
		t.Run(tc.kind+"/"+tc.chartType, func(t *testing.T) {
			report := chartFixture(t, tc.kind, tc.chartType, tc.rows)
			workbook, data := openDashboard(t, report)
			// Chart data follows the two-row details table: title row 9, header row 10.
			require.Equal(t, "12.125", rawCell(t, workbook, "Results-Details (2)", "B11"))
			require.Equal(t, "3.5", rawCell(t, workbook, "Results-Details (2)", func() string {
				if tc.kind == "category" {
					return "B12"
				}
				return "C11"
			}()))
			entries := workbookZIP(t, data)
			require.Contains(t, entries["xl/charts/chart1.xml"], tc.tag)
			require.Contains(t, entries["xl/charts/chart1.xml"], "&#39;Results-Details (2)&#39;!$B$11:$B$12")
			require.Contains(t, entries["xl/worksheets/sheet1.xml"], "drawing")
			require.Contains(t, entries["xl/worksheets/_rels/sheet1.xml.rels"], "drawing1.xml")
			require.Contains(t, entries["xl/drawings/_rels/drawing1.xml.rels"], "chart1.xml")
		})
	}
}

func TestRenderDashboardRejectsPartialOrInvalidResults(t *testing.T) {
	_, err := RenderDashboard(nil)
	require.EqualError(t, err, "reportFill is required")
	for _, field := range []string{"hasMore", "truncated", "reportDiagnostic", "datasetDiagnostic", "truncatedDiagnostic", "nonFinite", "unknownDataset", "duplicateBlock", "missingChild", "cycle"} {
		t.Run(field, func(t *testing.T) {
			report := dashboardFixture(t)
			switch field {
			case "hasMore":
				report.Datasets[0].Provenance.HasMore = true
			case "truncated":
				report.Datasets[0].Provenance.Truncated = true
			case "reportDiagnostic":
				report.Diagnostics = append(report.Diagnostics, reportfill.Diagnostic{Code: "incomplete_result", Severity: "error", Message: "Incomplete data"})
			case "datasetDiagnostic":
				report.Datasets[0].Provenance.Diagnostics = append(report.Datasets[0].Provenance.Diagnostics, reportfill.Diagnostic{Code: "incomplete_result", Severity: "error", Message: "Incomplete data"})
			case "truncatedDiagnostic":
				report.Diagnostics = append(report.Diagnostics, reportfill.Diagnostic{Code: "truncated", Severity: "warning", Message: "Preview data"})
			case "unknownDataset":
				report.Blocks[2].DatasetRef = "undeclared"
			case "duplicateBlock":
				report.Blocks = append(report.Blocks, report.Blocks[2])
			case "missingChild":
				report.Blocks[1].SectionContent.BlockIDs = []string{"absent"}
			case "cycle":
				report.Blocks[1].SectionContent.BlockIDs = []string{"first"}
			case "nonFinite":
				report.Datasets[0].Rows[0]["spend"] = math.Inf(1)
			}
			data, err := RenderDashboard(report)
			require.Error(t, err)
			require.Nil(t, data)
		})
	}
}

func TestDashboardSheetNamesAndNestedComposites(t *testing.T) {
	report := dashboardFixture(t)
	report.Blocks[0].TabGroupContent.Tabs[1].Title = strings.Repeat("界🙂", 20) + "'"
	report.Blocks = append(report.Blocks, reportfill.Block{ID: "group", Kind: "compositeBlock", ChildBlockIDs: []string{"primaryTable"}, CompositeContent: &reportfill.CompositeContent{Title: "Group", ChildBlockIDs: []string{"primaryTable"}}})
	report.Blocks[1].SectionContent.BlockIDs = []string{"group"}
	workbook, _ := openDashboard(t, report)
	sheets := workbook.GetSheetList()
	require.Len(t, sheets, 3)
	require.LessOrEqual(t, len(utf16.Encode([]rune(sheets[2]))), 31)
	require.Equal(t, "Details", mustCellValue(t, workbook, sheets[2], "A3"))
	writer := dashboardWriter{names: map[string]bool{"dashboard": true}}
	for _, title := range []string{"Dashboard", "dashboard", "'", strings.Repeat("a", 30) + "'x", "[]:*?/\\\x00"} {
		name := writer.sheetName(title)
		require.NotEmpty(t, name)
		require.NotEqual(t, "'", name[:1])
		require.NotEqual(t, "'", name[len(name)-1:])
		require.NotContains(t, name, "/")
	}
}

func TestRenderDashboardRetainsUnreferencedAdmittedDatasets(t *testing.T) {
	report := dashboardFixture(t)
	extra := report.Datasets[0]
	extra.ID = "auxiliary"
	extra.Rows = []map[string]any{{"evidence": "admitted"}}
	extra.Provenance.RowCount = 1
	report.Datasets = append(report.Datasets, extra)
	workbook, _ := openDashboard(t, report)
	require.Contains(t, workbook.GetSheetList(), "Data auxiliary")
	require.Equal(t, "admitted", mustCellValue(t, workbook, "Data auxiliary", "A5"))
}

func rawCell(t *testing.T, file *excelize.File, sheet, cell string) string {
	t.Helper()
	value, err := file.GetCellValue(sheet, cell, excelize.Options{RawCellValue: true})
	require.NoError(t, err)
	return value
}

func workbookZIP(t *testing.T, data []byte) map[string]string {
	t.Helper()
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	entries := map[string]string{}
	for _, entry := range reader.File {
		stream, err := entry.Open()
		require.NoError(t, err)
		content, err := io.ReadAll(stream)
		require.NoError(t, err)
		require.NoError(t, stream.Close())
		entries[entry.Name] = string(content)
	}
	return entries
}
