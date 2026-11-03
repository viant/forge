package materializer

import (
	"bytes"
	"encoding/csv"
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
	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/xuri/excelize/v2"
)

func staticPivotFixture(t *testing.T) (map[string]any, []map[string]any) {
	t.Helper()
	raw, err := os.ReadFile("../../../doc/examples/library-static-pivot.json")
	require.NoError(t, err)
	var fixture struct {
		Block map[string]any   `json:"block"`
		Rows  []map[string]any `json:"rows"`
	}
	require.NoError(t, json.Unmarshal(raw, &fixture))
	raw, err = os.ReadFile("testdata/presentation-report.json")
	require.NoError(t, err)
	var spec map[string]any
	require.NoError(t, json.Unmarshal(raw, &spec))
	spec["title"] = "Library visits"
	spec["blocks"] = []any{fixture.Block}
	spec["layoutIntent"] = map[string]any{"kind": "single", "resultPanePosition": "bottom", "blockOrder": []string{"visits"}}
	return spec, fixture.Rows
}

func TestStaticPivotNativeExports(t *testing.T) {
	for _, domain := range []string{"observed", "fixed", "observed-multiple", "fixed-multiple"} {
		t.Run(domain, func(t *testing.T) {
			spec, rows := staticPivotFixture(t)
			block := spec["blocks"].([]any)[0].(map[string]any)
			pivot := block["pivot"].(map[string]any)
			if strings.HasPrefix(domain, "fixed") {
				delete(pivot, "columnDomain")
				pivot["columnCategories"] = []string{"March", "January", "February"}
			}
			multiple := strings.HasSuffix(domain, "multiple")
			if multiple {
				block["columns"] = append(block["columns"].([]any), map[string]any{"key": "renewals", "label": "Renewals"})
				pivot["values"] = append(pivot["values"].([]any), map[string]any{"field": "renewals", "label": "Renewals", "aggregate": "sum", "format": "integer"})
				for index, value := range []any{2, 0, -1, nil, nil, nil, 1} {
					rows[index]["renewals"] = value
				}
			}
			raw, err := json.Marshal(spec)
			require.NoError(t, err)
			decodedSpec, err := reportspec.DecodeJSON(raw)
			require.NoError(t, err)
			require.Equal(t, []string{"registeredMembers", "balance"}, decodedSpec.Blocks[0].Pivot.StaticFields)
			payload, err := json.Marshal(map[string]any{"rows": rows, "hasMore": false})
			require.NoError(t, err)
			artifacts, err := Materialize(t.Context(), raw, map[string]json.RawMessage{"primary": payload})
			require.NoError(t, err)
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			require.NoError(t, err)
			table := fill.Blocks[0]
			require.Equal(t, decodedSpec.Blocks[0].Pivot, table.Pivot)
			columnCount := 7
			if multiple {
				columnCount = 10
			}
			require.Len(t, table.Content.Columns, columnCount)
			require.Len(t, table.Content.ResolvedRows, 4)
			require.Len(t, fill.Datasets[0].Rows, len(rows))
			for index, column := range table.Content.Columns {
				require.Equal(t, index < 2, column.RowIdentity)
			}
			csvBytes, err := reportcsv.Render(fill)
			require.NoError(t, err)
			records, err := csv.NewReader(bytes.NewReader(csvBytes)).ReadAll()
			require.NoError(t, err)
			expected := [][]string{
				{"Rows / Branch ID", "Rows / Branch", "Members", "Balance", "March / Circulation", "January / Circulation", "February / Circulation"},
				{"10", "North", "120", "-2.5", "8", "0", ""},
				{"20", "South", "0", "0", "", "-3", ""},
				{"30", "West", "", "", "", "", ""},
				{"40", "East", "", "", "", "", "4"},
			}
			if multiple {
				expected = [][]string{
					{"Rows / Branch ID", "Rows / Branch", "Members", "Balance", "March / Circulation", "March / Renewals", "January / Circulation", "January / Renewals", "February / Circulation", "February / Renewals"},
					{"10", "North", "120", "-2.5", "8", "2", "0", "0", "", ""},
					{"20", "South", "0", "0", "", "", "-3", "-1", "", ""},
					{"30", "West", "", "", "", "", "", "", "", ""},
					{"40", "East", "", "", "", "", "", "", "4", "1"},
				}
			}
			require.Equal(t, expected, records)
			xlsxBytes, err := reportxlsx.Render(fill)
			require.NoError(t, err)
			workbook, err := excelize.OpenReader(bytes.NewReader(xlsxBytes))
			require.NoError(t, err)
			defer workbook.Close()
			for rowIndex, record := range expected {
				for columnIndex, value := range record {
					cell, err := excelize.CoordinatesToCellName(columnIndex+1, rowIndex+1)
					require.NoError(t, err)
					actual, err := workbook.GetCellValue("Report", cell, excelize.Options{RawCellValue: true})
					require.NoError(t, err)
					require.Equal(t, value, actual, cell)
					if rowIndex > 0 && columnIndex != 1 && value != "" {
						kind, err := workbook.GetCellType("Report", cell)
						require.NoError(t, err)
						require.Contains(t, []excelize.CellType{excelize.CellTypeUnset, excelize.CellTypeNumber}, kind, cell)
					}
				}
			}
			print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			staticText := map[string][]string{}
			for _, page := range print.Pages {
				for _, cell := range page.Elements {
					if cell.Kind == "tableCellText" && (cell.ColumnKey == "registeredMembers" || cell.ColumnKey == "balance") {
						staticText[cell.ColumnKey] = append(staticText[cell.ColumnKey], cell.Text)
					}
				}
			}
			require.Equal(t, []string{"120", "0", "—", "—"}, staticText["registeredMembers"])
			require.Equal(t, []string{"-2.5", "0", "—", "—"}, staticText["balance"])
			pdf, err := reportpdf.Render(print, reportpdf.Options{})
			require.NoError(t, err)
			require.Empty(t, pdf.Diagnostics)
			reader, err := pdfreader.NewReader(bytes.NewReader(pdf.Bytes), int64(len(pdf.Bytes)))
			require.NoError(t, err)
			text, err := reader.GetPlainText()
			require.NoError(t, err)
			plain, err := io.ReadAll(text)
			require.NoError(t, err)
			for _, word := range []string{"Members", "Balance", "March", "January", "February", "North", "South", "West", "East", "120", "-2.5", "-3"} {
				require.Contains(t, string(plain), word)
			}
			require.Equal(t, 1, strings.Count(string(plain), "120"))
			require.NotContains(t, string(plain), "null")
			dashboardBytes, err := reportxlsx.RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
			require.NoError(t, err)
			dashboard, err := excelize.OpenReader(bytes.NewReader(dashboardBytes))
			require.NoError(t, err)
			defer dashboard.Close()
			foundTable := false
			for _, sheet := range dashboard.GetSheetList() {
				sheetRows, err := dashboard.GetRows(sheet)
				require.NoError(t, err)
				for index, record := range sheetRows {
					if len(record) < 4 || record[2] != "Members" || record[3] != "Balance" {
						continue
					}
					foundTable = true
					require.Equal(t, expected[0], record)
					require.Equal(t, expected[1][:4], sheetRows[index+1][:4])
				}
			}
			require.True(t, foundTable, "dashboard workbook lost static pivot table")
			for _, field := range []string{"registeredMembers", "balance"} {
				presented, err := MaterializePresented(t.Context(), raw, map[string]json.RawMessage{"primary": payload}, TablePresentations{"visits": {Sort: &TableSort{Key: field, Direction: "asc"}}}, true)
				require.NoError(t, err)
				ordered, err := reportfill.DecodeJSON(presented.ReportFill)
				require.NoError(t, err)
				want := "South"
				if field == "balance" {
					want = "North"
				}
				require.Equal(t, want, ordered.Blocks[0].Content.ResolvedRows[0].Cells[1].Value)
			}
			for _, field := range []string{"month", "circulation"} {
				require.Error(t, ValidateTablePresentations(raw, TablePresentations{"visits": {Sort: &TableSort{Key: field, Direction: "asc"}}}))
			}
		})
	}
}

func TestStaticPivotRejectsInconsistentProducerValues(t *testing.T) {
	for _, value := range []any{121, nil, "120", true} {
		spec, rows := staticPivotFixture(t)
		rows[1]["registeredMembers"] = value
		raw, err := json.Marshal(spec)
		require.NoError(t, err)
		payload, err := json.Marshal(map[string]any{"rows": rows})
		require.NoError(t, err)
		artifacts, err := MaterializeFill(t.Context(), raw, map[string]json.RawMessage{"primary": payload})
		require.Nil(t, artifacts)
		require.Error(t, err)
		if value == nil || value == 121 {
			require.True(t, strings.Contains(err.Error(), "static field registeredMembers has inconsistent values for row tuple [10,\"North\"]"), err)
		} else {
			require.ErrorContains(t, err, "finite numbers or null")
		}
	}
}
