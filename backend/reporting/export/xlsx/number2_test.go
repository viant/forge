package xlsx

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
)

// Independent fractional measurements exercise the existing public number2
// format through native materialization and XLSX export without rounding data.
func TestNumber2DashboardPreservesRawPrecision(t *testing.T) {
	for _, example := range []struct {
		name           string
		value          any
		raw, displayed string
	}{
		{"positive", 12345.67891, "12345.67891", "12,345.68"},
		{"negative", -12345.67891, "-12345.67891", "-12,345.68"},
		{"zero", 0, "0", "0"},
		{"null", nil, "", ""},
	} {
		t.Run(example.name, func(t *testing.T) {
			artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
				spec["blocks"] = []any{
					map[string]any{"id": "metric", "kind": "kpiBlock", "title": "Measurement", "datasetRef": "primary", "valueField": "value", "valueLabel": "Measurement", "valueFormat": "number2"},
					map[string]any{"id": "details", "kind": "tableBlock", "title": "Measurements", "datasetRef": "primary", "columns": []any{map[string]any{"key": "value", "label": "Measurement", "format": "number2"}}},
				}
				spec["layoutIntent"] = map[string]any{"kind": "stack", "blockOrder": []string{"metric", "details"}}
				data, err := json.Marshal(map[string]any{"rows": []any{map[string]any{"value": example.value}}, "hasMore": false})
				require.NoError(t, err)
				inputs["primary"] = data
			})
			data, err := RenderDatasourceDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
			require.NoError(t, err)
			book, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer book.Close()
			for _, target := range []struct{ sheet, cell string }{{"Values", "D5"}, {"Table Measurements", "A5"}} {
				raw, err := book.GetCellValue(target.sheet, target.cell, excelize.Options{RawCellValue: true})
				require.NoError(t, err)
				require.Equal(t, example.raw, raw, fmt.Sprint(target))
				visible, err := book.GetCellValue(target.sheet, target.cell)
				require.NoError(t, err)
				require.Equal(t, example.displayed, visible, fmt.Sprint(target))
				if example.value == nil {
					continue
				}
				cellType, err := book.GetCellType(target.sheet, target.cell)
				require.NoError(t, err)
				// An omitted XLSX type is also a numeric cell per SpreadsheetML.
				require.Contains(t, []excelize.CellType{excelize.CellTypeNumber, excelize.CellTypeUnset}, cellType)
				styleID, err := book.GetCellStyle(target.sheet, target.cell)
				require.NoError(t, err)
				style, err := book.GetStyle(styleID)
				require.NoError(t, err)
				require.NotNil(t, style.CustomNumFmt)
				// Optional decimals match the UI number2 contract: at most two,
				// without forcing trailing zeroes or changing stored values.
				require.Equal(t, "#,##0.##", *style.CustomNumFmt)
			}
		})
	}
}
