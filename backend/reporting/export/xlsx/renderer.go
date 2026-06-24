package xlsx

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

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
		if err := workbook.SetCellStr(sheetName, cellName, strings.TrimSpace(column.Label)); err != nil {
			return nil, err
		}
		if err := workbook.SetCellStyle(sheetName, cellName, cellName, headerStyle); err != nil {
			return nil, err
		}
	}

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
			if err := workbook.SetCellStr(sheetName, cellName, formatXLSXValue(cell.DisplayValue)); err != nil {
				return nil, err
			}
		}
	}

	buffer, err := workbook.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func formatXLSXValue(value any) string {
	switch actual := value.(type) {
	case nil:
		return ""
	case string:
		return actual
	case bool:
		return strconv.FormatBool(actual)
	case float64:
		return strconv.FormatFloat(actual, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(actual), 'f', -1, 64)
	case int:
		return strconv.Itoa(actual)
	case int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return fmt.Sprint(actual)
	default:
		data, err := json.Marshal(actual)
		if err != nil {
			return fmt.Sprint(actual)
		}
		return string(data)
	}
}
