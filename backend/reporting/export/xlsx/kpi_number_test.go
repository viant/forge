package xlsx

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

// Independent fractional measurements exercise the KPI number0 and number1
// format through native materialization and XLSX export without rounding data.
func TestKPINumberPrecisionPreservesRawValues(t *testing.T) {
	for _, example := range []struct {
		name           string
		value          any
		raw, displayed string
	}{
		{"positive", 12345.67891, "12345.67891", "12,346"},
		{"negative", -12345.67891, "-12345.67891", "-12,346"},
		{"integer", 12, "12", "12"},
		{"zero", 0, "0", "0"},
		{"null", nil, "", ""},
	} {
		t.Run(example.name, func(t *testing.T) {
			artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
				spec["blocks"] = []any{
					map[string]any{"id": "metric", "kind": "kpiBlock", "title": "Measurement", "datasetRef": "primary", "valueField": "value", "valueLabel": "Measurement", "valueFormat": "number0", "secondaryField": "value", "secondaryLabel": "Decimal", "secondaryFormat": "number1"},
				}
				spec["layoutIntent"] = map[string]any{"kind": "stack", "blockOrder": []string{"metric"}}
				data, err := json.Marshal(map[string]any{"rows": []any{map[string]any{"value": example.value}}, "hasMore": false})
				require.NoError(t, err)
				inputs["primary"] = data
			})
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			require.NoError(t, err)
			expectedValue := example.value
			if expectedValue != nil {
				number, err := json.Number(fmt.Sprint(example.value)).Float64()
				require.NoError(t, err)
				expectedValue = number
			}
			require.Equal(t, expectedValue, fill.Blocks[0].KPIContent.Value)
			require.Equal(t, expectedValue, fill.Blocks[0].KPIContent.SecondaryValue)
			if example.value != nil {
				require.Contains(t, string(artifacts.ReportPrint), example.displayed)
			}
			data, err := RenderDatasourceDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
			require.NoError(t, err)
			book, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer book.Close()
			for _, target := range []struct{ sheet, cell string }{{"Values", "D5"}, {"Values", "G5"}} {
				raw, err := book.GetCellValue(target.sheet, target.cell, excelize.Options{RawCellValue: true})
				require.NoError(t, err)
				require.Equal(t, example.raw, raw, fmt.Sprint(target))
				visible, err := book.GetCellValue(target.sheet, target.cell)
				require.NoError(t, err)
				expected := example.displayed
				if target.cell == "G5" {
					switch example.name {
					case "positive":
						expected = "12,345.7"
					case "negative":
						expected = "-12,345.7"
					case "integer":
						expected = "12.0"
					case "zero":
						expected = "0.0"
					}
				}
				require.Equal(t, expected, visible, fmt.Sprint(target))
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
				expectedFormat := "#,##0"
				if target.cell == "G5" {
					expectedFormat = "#,##0.0"
				}
				require.Equal(t, expectedFormat, *style.CustomNumFmt)
			}
		})
	}
}
