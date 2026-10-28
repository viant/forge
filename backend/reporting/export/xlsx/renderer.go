package xlsx

import (
	"encoding/json"
	"fmt"
	"github.com/viant/forge/backend/reporting/tablemeta"
	"math"
	"strconv"
	"strings"
	"unicode/utf16"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

func Render(report *reportfill.ReportFill) ([]byte, error) {
	if report == nil {
		return nil, fmt.Errorf("reportFill is required")
	}
	if err := report.Validate(); err != nil {
		return nil, err
	}
	tableBlocks := make([]reportfill.Block, 0, len(report.Blocks))
	for _, block := range report.Blocks {
		if strings.TrimSpace(block.Kind) == "tableBlock" {
			tableBlocks = append(tableBlocks, block)
		}
	}
	if len(tableBlocks) == 0 {
		return nil, fmt.Errorf("xlsx export requires exactly one tableBlock, got 0")
	}
	if len(tableBlocks) > 1 {
		return nil, fmt.Errorf("xlsx export requires exactly one tableBlock, got %d", len(tableBlocks))
	}
	block := tableBlocks[0]
	if block.Content == nil {
		return nil, fmt.Errorf("xlsx export requires tableBlock content")
	}
	columns := block.Content.Columns
	if len(columns) == 0 {
		return nil, fmt.Errorf("xlsx export requires tableBlock content columns")
	}

	workbook := excelize.NewFile()
	defer workbook.Close()
	const sheetName = "Report"
	defaultSheet := workbook.GetSheetName(workbook.GetActiveSheetIndex())
	if defaultSheet != "" && defaultSheet != sheetName {
		if err := workbook.SetSheetName(defaultSheet, sheetName); err != nil {
			return nil, err
		}
	}
	sheetIndex, err := workbook.GetSheetIndex(sheetName)
	if err != nil {
		return nil, err
	}
	if sheetIndex == -1 {
		sheetIndex, err = workbook.NewSheet(sheetName)
		if err != nil {
			return nil, err
		}
	}
	workbook.SetActiveSheet(sheetIndex)

	headerStyle, err := workbook.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
	})
	if err != nil {
		return nil, err
	}

	for columnIndex, column := range columns {
		cellName, err := excelize.CoordinatesToCellName(columnIndex+1, 1)
		if err != nil {
			return nil, err
		}
		if err := setXLSXText(workbook, sheetName, cellName, tablemeta.Header(strings.TrimSpace(column.Label), column.Key, block.Content.ColumnGroups)); err != nil {
			return nil, err
		}
		if err := workbook.SetCellStyle(sheetName, cellName, cellName, headerStyle); err != nil {
			return nil, err
		}
	}

	numberStyles := map[string]int{}
	for rowIndex, row := range block.Content.ResolvedRows {
		cellByKey := make(map[string]reportfill.ResolvedTableCell, len(row.Cells))
		for _, cell := range row.Cells {
			cellByKey[strings.TrimSpace(cell.Key)] = cell
		}
		for columnIndex, column := range columns {
			key := strings.TrimSpace(column.Key)
			cell, ok := cellByKey[key]
			if !ok {
				return nil, fmt.Errorf("xlsx export missing cell for column %q at row %d", key, rowIndex)
			}
			cellName, err := excelize.CoordinatesToCellName(columnIndex+1, rowIndex+2)
			if err != nil {
				return nil, err
			}
			numeric, err := setXLSXCell(workbook, sheetName, cellName, cell)
			if err != nil {
				return nil, err
			}
			if numeric {
				if format := xlsxNumberFormat(column.Format); format != "" {
					style, found := numberStyles[format]
					if !found {
						style, err = workbook.NewStyle(&excelize.Style{CustomNumFmt: &format})
						if err != nil {
							return nil, err
						}
						numberStyles[format] = style
					}
					if err := workbook.SetCellStyle(sheetName, cellName, cellName, style); err != nil {
						return nil, err
					}
				}
			}
		}
	}

	buffer, err := workbook.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

// Spreadsheet formatting must not round the underlying measurements or turn
// ordinary numeric cells into text. Long integer identifiers stay text because
// Excel cannot represent more than fifteen decimal digits exactly.
func setXLSXCell(workbook *excelize.File, sheet, name string, cell reportfill.ResolvedTableCell) (bool, error) {
	value := cell.DisplayValue
	if value == nil || value == "" {
		value = cell.Value
	}
	switch actual := value.(type) {
	case nil:
		return false, workbook.SetCellValue(sheet, name, nil)
	case string:
		return false, setXLSXText(workbook, sheet, name, actual)
	case bool:
		return false, workbook.SetCellBool(sheet, name, actual)
	case json.Number:
		text := actual.String()
		if !strings.ContainsAny(text, ".eE") && len(strings.TrimLeft(text, "-+")) > 15 {
			return false, setXLSXText(workbook, sheet, name, text)
		}
		number, err := actual.Float64()
		if err != nil || math.IsNaN(number) || math.IsInf(number, 0) {
			return false, fmt.Errorf("xlsx export requires a finite numeric value")
		}
		if math.Abs(number) >= 1e15 && math.Trunc(number) == number {
			return false, setXLSXText(workbook, sheet, name, text)
		}
		return true, workbook.SetCellFloat(sheet, name, number, -1, 64)
	case float64:
		if math.IsNaN(actual) || math.IsInf(actual, 0) {
			return false, fmt.Errorf("xlsx export requires a finite numeric value")
		}
		if math.Abs(actual) >= 1e15 && math.Trunc(actual) == actual {
			return false, setXLSXText(workbook, sheet, name, strconv.FormatFloat(actual, 'f', -1, 64))
		}
		return true, workbook.SetCellValue(sheet, name, actual)
	case float32:
		if math.IsNaN(float64(actual)) || math.IsInf(float64(actual), 0) {
			return false, fmt.Errorf("xlsx export requires a finite numeric value")
		}
		return true, workbook.SetCellValue(sheet, name, actual)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		text := fmt.Sprint(actual)
		if len(strings.TrimLeft(text, "-+")) > 15 {
			return false, setXLSXText(workbook, sheet, name, text)
		}
		return true, workbook.SetCellValue(sheet, name, actual)
	default:
		data, err := json.Marshal(actual)
		if err != nil {
			return false, err
		}
		return false, setXLSXText(workbook, sheet, name, string(data))
	}
}

func setXLSXText(workbook *excelize.File, sheet, cell, value string) error {
	if len(utf16.Encode([]rune(value))) > 32767 {
		return fmt.Errorf("xlsx cell %s!%s exceeds Excel text length limit", sheet, cell)
	}
	return workbook.SetCellStr(sheet, cell, value)
}

func xlsxNumberFormat(format string) string {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "currency":
		return `"$"#,##0.00`
	case "compactnumber":
		return "#,##0.#####"
	case "integer":
		return "0"
	case "number":
		return "0.00000"
	case "percent":
		return `0.0"%"`
	case "percentfraction":
		return "0.0%"
	case "percentfraction2":
		return "0.00%"
	default:
		return ""
	}
}
