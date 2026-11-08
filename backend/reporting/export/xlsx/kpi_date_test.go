package xlsx

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/xuri/excelize/v2"
)

// Independent leap-day inputs use the native embedded materializer and complete
// dashboard exporter. Formatting must never replace the original source value.
func TestKPIDateDashboardPreservesRawDates(t *testing.T) {
	var sourceSpec []byte
	artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
		spec["blocks"] = []any{map[string]any{"id": "period", "kind": "kpiBlock", "title": "Observation period", "datasetRef": "primary", "valueField": "start", "valueLabel": "Start", "valueFormat": "date", "secondaryField": "end", "secondaryLabel": "End", "secondaryFormat": "date"}}
		spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"period"}, "resultPanePosition": "bottom"}
		sourceSpec, _ = json.Marshal(spec)
		inputs["primary"] = json.RawMessage(`{"rows":[{"start":"2040-02-29T00:00:00Z","end":"2040-03-01"}]}`)
	})
	fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	require.Equal(t, "2040-02-29T00:00:00Z", fill.Blocks[0].KPIContent.Value)
	require.Equal(t, "2040-03-01", fill.Blocks[0].KPIContent.SecondaryValue)
	require.Contains(t, string(artifacts.ReportPrint), "Feb 29, 2040")
	require.Contains(t, string(artifacts.ReportPrint), "Mar 1, 2040")
	data, err := RenderDatasourceDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	book, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer book.Close()
	for cell, expected := range map[string]string{"D5": "2040-02-29T00:00:00Z", "G5": "2040-03-01"} {
		raw, err := book.GetCellValue("Values", cell, excelize.Options{RawCellValue: true})
		require.NoError(t, err)
		require.Equal(t, expected, raw)
		typ, err := book.GetCellType("Values", cell)
		require.NoError(t, err)
		require.Contains(t, []excelize.CellType{excelize.CellTypeSharedString, excelize.CellTypeInlineString}, typ)
	}
	for _, field := range []string{"valueFormat", "secondaryFormat"} {
		var spec map[string]any
		require.NoError(t, json.Unmarshal(sourceSpec, &spec))
		spec["blocks"].([]any)[0].(map[string]any)[field] = "unknown-date-format"
		invalid, err := json.Marshal(spec)
		require.NoError(t, err)
		_, err = reportspec.DecodeJSON(invalid)
		require.ErrorContains(t, err, "not supported for kpiBlock")
		for _, nested := range []bool{false, true} {
			var value map[string]any
			require.NoError(t, json.Unmarshal(artifacts.ReportFill, &value))
			block := value["blocks"].([]any)[0].(map[string]any)
			if nested {
				block = block["content"].(map[string]any)
			}
			block[field] = "unknown-date-format"
			invalid, err = json.Marshal(value)
			require.NoError(t, err)
			_, err = reportfill.DecodeJSON(invalid)
			require.ErrorContains(t, err, "not supported for kpiBlock")
		}
	}
	var visible string
	for _, sheet := range book.GetSheetList() {
		rows, err := book.GetRows(sheet)
		require.NoError(t, err)
		for _, row := range rows {
			for _, cell := range row {
				visible += "\n" + cell
			}
		}
	}
	require.Contains(t, visible, "Feb 29, 2040")
	require.Contains(t, visible, "Mar 1, 2040")
}
