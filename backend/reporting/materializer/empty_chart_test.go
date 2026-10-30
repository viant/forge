package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	"github.com/stretchr/testify/require"
	reportcsv "github.com/viant/forge/backend/reporting/export/csv"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// The independently authored public fixture is also executed by the Node test;
// all three exports consume the same canonical fill, without synthetic zero rows.
func TestCompleteEmptyChartExports(t *testing.T) {
	for _, kind := range []string{"directSeries", "groupedSeries", "pie", "donut"} {
		t.Run(kind, func(t *testing.T) { testCompleteEmptyChartExports(t, kind) })
	}
}

func testCompleteEmptyChartExports(t *testing.T, kind string) {
	raw, err := os.ReadFile("testdata/empty-chart-report.json")
	require.NoError(t, err)
	var fixture struct {
		ReportSpec json.RawMessage            `json:"reportSpec"`
		Datasets   map[string]json.RawMessage `json:"datasets"`
	}
	require.NoError(t, json.Unmarshal(raw, &fixture))
	// Nonpaged executed payloads historically omit hasMore; the admitted rows
	// array is still a real empty result, distinct from a missing payload.
	fixture.Datasets["empty"] = json.RawMessage(`{"rows":[]}`)
	if kind != "directSeries" {
		var spec map[string]any
		require.NoError(t, json.Unmarshal(fixture.ReportSpec, &spec))
		empty := spec["blocks"].([]any)[1].(map[string]any)
		chartType := kind
		if kind == "groupedSeries" {
			chartType = "line"
		}
		empty["chartSpec"] = map[string]any{"type": chartType, "xField": "category", "yFields": []string{"amount"}}
		empty["chartModel"] = map[string]any{"type": chartType, "xAxis": map[string]any{"dataKey": "category"}, "series": map[string]any{"nameKey": "category", "valueKey": "amount"}}
		fixture.ReportSpec, err = json.Marshal(spec)
		require.NoError(t, err)
	}
	artifacts, err := Materialize(context.Background(), fixture.ReportSpec, fixture.Datasets)
	require.NoError(t, err)
	fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	require.Equal(t, 0, *fill.Blocks[1].ChartContent.RowCount)
	require.NotNil(t, fill.Blocks[1].ChartContent.ResolvedChart.Rows)
	require.Empty(t, fill.Blocks[1].ChartContent.ResolvedChart.Rows)
	if kind == "directSeries" {
		require.Equal(t, []string{"amount"}, fill.Blocks[1].ChartContent.ResolvedChart.SeriesKeys)
	} else {
		require.NotNil(t, fill.Blocks[1].ChartContent.ResolvedChart.SeriesKeys)
		require.Empty(t, fill.Blocks[1].ChartContent.ResolvedChart.SeriesKeys)
	}
	require.Equal(t, 2, *fill.Blocks[2].ChartContent.RowCount)
	require.Len(t, fill.Blocks[2].ChartContent.ResolvedChart.Rows, 2)
	csv, err := reportcsv.Render(fill)
	require.NoError(t, err)
	require.Contains(t, string(csv), "Reference,7.25")
	require.Contains(t, string(csv), "Science,3.5")
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	pdf, err := reportpdf.Render(printed, reportpdf.Options{})
	require.NoError(t, err)
	require.Empty(t, pdf.Diagnostics)
	reader, err := pdfreader.NewReader(bytes.NewReader(pdf.Bytes), int64(len(pdf.Bytes)))
	require.NoError(t, err)
	plain, err := reader.GetPlainText()
	require.NoError(t, err)
	text, err := io.ReadAll(plain)
	require.NoError(t, err)
	require.Contains(t, string(text), "No data for the selected scope.")
	require.Contains(t, string(text), "Reference")
	xlsx, err := reportxlsx.RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	workbook, err := excelize.OpenReader(bytes.NewReader(xlsx))
	require.NoError(t, err)
	defer workbook.Close()
	var workbookText strings.Builder
	for _, sheet := range workbook.GetSheetList() {
		rows, err := workbook.GetRows(sheet)
		require.NoError(t, err)
		for _, row := range rows {
			workbookText.WriteString(strings.Join(row, " ") + "\n")
		}
	}
	require.Contains(t, workbookText.String(), "No data for the selected scope.")
	require.Contains(t, workbookText.String(), "Filters explore its retained resolved values without rerunning the report.")
	require.Contains(t, workbookText.String(), "Reference")
	require.Contains(t, workbookText.String(), "7.25")
	if kind != "directSeries" {
		for _, invalid := range []string{"missingSource", "partial", "truncated", "offset", "sourceError", "incompleteDiagnostic", "missingRows", "nonemptyRows", "nonzeroCount", "missingSeriesKeys"} {
			t.Run("reject/"+invalid, func(t *testing.T) {
				candidate, err := reportfill.DecodeJSON(artifacts.ReportFill)
				require.NoError(t, err)
				chart := &candidate.Blocks[1]
				source := &candidate.Datasets[1]
				switch invalid {
				case "missingSource":
					chart.DatasetRef = "missing"
				case "partial":
					source.Provenance.HasMore = true
				case "truncated":
					source.Provenance.Truncated = true
				case "offset":
					value := 1
					source.Request.Offset = &value
				case "sourceError":
					source.Provenance.Diagnostics = []reportfill.Diagnostic{{Severity: "error", Code: "source_failed"}}
				case "incompleteDiagnostic":
					source.Provenance.Diagnostics = []reportfill.Diagnostic{{Severity: "warning", Code: "incomplete_dataset"}}
				case "missingRows":
					chart.ChartContent.ResolvedChart.Rows = nil
				case "nonemptyRows":
					chart.ChartContent.ResolvedChart.Rows = []map[string]any{{"category": "Reference", "amount": 7.25}}
				case "nonzeroCount":
					value := 1
					chart.ChartContent.RowCount = &value
				case "missingSeriesKeys":
					chart.ChartContent.ResolvedChart.SeriesKeys = nil
				}
				require.Error(t, candidate.Validate())
			})
		}
	}

	for name, payload := range map[string]string{
		"missing": "null", "noRows": `{}`,
		"partial":   `{"rows":[],"hasMore":true}`,
		"truncated": `{"rows":[],"hasMore":false,"truncated":true}`,
		"failed":    `{"rows":[],"hasMore":false,"diagnostics":[{"severity":"error","code":"source_failed"}]}`,
	} {
		t.Run(name, func(t *testing.T) {
			datasets := map[string]json.RawMessage{"primary": fixture.Datasets["primary"], "empty": json.RawMessage(payload)}
			_, err := Materialize(context.Background(), fixture.ReportSpec, datasets)
			require.Error(t, err)
		})
	}
}
