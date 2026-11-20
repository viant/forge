package materializer_test

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportcsv "github.com/viant/forge/backend/reporting/export/csv"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/viant/forge/backend/reporting/materializer"
	"github.com/xuri/excelize/v2"
)

func TestSummaryRowNativeMaterializationAndTypedExports(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/report-table-summary.json")
	require.NoError(t, err)
	var fixture struct {
		Spec     json.RawMessage            `json:"spec"`
		Datasets map[string]json.RawMessage `json:"datasets"`
	}
	require.NoError(t, json.Unmarshal(raw, &fixture))
	artifacts, err := materializer.Materialize(t.Context(), fixture.Spec, fixture.Datasets)
	require.NoError(t, err)
	fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	require.Len(t, fill.Blocks[0].Content.ResolvedRows, 2)
	require.Len(t, fill.Datasets[0].Rows, 2)
	summary := fill.Blocks[0].Content.SummaryRow
	require.NotNil(t, summary)
	require.Equal(t, "Grand Total", summary.Cells[0].Value)
	require.EqualValues(t, 40, summary.Cells[1].Value)
	require.EqualValues(t, 0, summary.Cells[2].Value)
	require.Nil(t, summary.Cells[3].Value)
	// Each table gets one scoped footer, not a new source row or aggregate.
	require.Equal(t, 2, strings.Count(string(artifacts.ReportPrint), `"text":"Grand Total"`))
	require.Contains(t, string(artifacts.ReportPrint), `"rowKey":"summary"`)
	fill.Blocks = fill.Blocks[:1]
	csv, err := reportcsv.Render(fill)
	require.NoError(t, err)
	require.Contains(t, string(csv), "Grand Total,40,0,")
	data, err := reportxlsx.Render(fill)
	require.NoError(t, err)
	book, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer book.Close()
	label, err := book.GetCellValue("Report", "A4")
	require.NoError(t, err)
	require.Equal(t, "Grand Total", label)
	for cell, want := range map[string]string{"B4": "40", "C4": "0", "D4": ""} {
		got, err := book.GetCellValue("Report", cell, excelize.Options{RawCellValue: true})
		require.NoError(t, err)
		require.Equal(t, want, got)
	}
	kind, err := book.GetCellType("Report", "C4")
	require.NoError(t, err)
	require.Contains(t, []excelize.CellType{excelize.CellTypeNumber, excelize.CellTypeUnset}, kind)
	// The editable table contains the footer; its filter and raw-data sheets do not.
	data, err = reportxlsx.RenderDatasourceDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	dashboard, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer dashboard.Close()
	tableIndex, err := dashboard.GetSheetIndex("Table Observations")
	require.NoError(t, err)
	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	for _, entry := range archive.File {
		if entry.Name == fmt.Sprintf("xl/worksheets/sheet%d.xml", tableIndex+1) {
			reader, err := entry.Open()
			require.NoError(t, err)
			body, err := io.ReadAll(reader)
			require.NoError(t, err)
			reader.Close()
			var sheet struct {
				AutoFilter struct {
					Ref string `xml:"ref,attr"`
				} `xml:"autoFilter"`
			}
			require.NoError(t, xml.Unmarshal(body, &sheet))
			require.Equal(t, "A4:D6", strings.ReplaceAll(sheet.AutoFilter.Ref, "$", ""))
		}
	}
	label, err = dashboard.GetCellValue("Table Observations", "A7")
	require.NoError(t, err)
	require.Equal(t, "Grand Total", label)
	source, err := dashboard.GetRows("Data primary")
	require.NoError(t, err)
	for _, row := range source {
		require.NotContains(t, row, "Grand Total")
	}
	z, err := dashboard.WriteToBuffer()
	require.NoError(t, err)
	require.NotEmpty(t, z)
	// A missing bound summary is visible as a scoped diagnostic and cannot be exported as a complete table.
	delete(fixture.Datasets, "summary")
	artifacts, err = materializer.Materialize(t.Context(), fixture.Spec, fixture.Datasets)
	require.NoError(t, err)
	fill, err = reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	require.Nil(t, fill.Blocks[0].Content.SummaryRow)
	require.Len(t, fill.Blocks[0].Content.ResolvedRows, 2)
	require.Contains(t, string(artifacts.ReportFill), "table_summary_missing")
	fill.Blocks = fill.Blocks[:1]
	_, err = reportcsv.Render(fill)
	require.ErrorContains(t, err, "summary data is unavailable")
	_, err = reportxlsx.Render(fill)
	require.ErrorContains(t, err, "summary data is unavailable")
}
