package csv

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	reportfill "github.com/viant/forge/backend/reporting/fill"
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
		return nil, fmt.Errorf("csv export requires exactly one tableBlock, got 0")
	}
	if len(tableBlocks) > 1 {
		return nil, fmt.Errorf("csv export requires exactly one tableBlock, got %d", len(tableBlocks))
	}
	block := tableBlocks[0]
	if block.Content == nil {
		return nil, fmt.Errorf("csv export requires tableBlock content")
	}
	columns := block.Content.Columns
	if len(columns) == 0 {
		return nil, fmt.Errorf("csv export requires tableBlock content columns")
	}

	buffer := new(bytes.Buffer)
	writer := csv.NewWriter(buffer)
	header := make([]string, 0, len(columns))
	for _, column := range columns {
		header = append(header, strings.TrimSpace(column.Label))
	}
	if err := writer.Write(header); err != nil {
		return nil, err
	}
	for rowIndex, row := range block.Content.ResolvedRows {
		cellByKey := make(map[string]reportfill.ResolvedTableCell, len(row.Cells))
		for _, cell := range row.Cells {
			cellByKey[strings.TrimSpace(cell.Key)] = cell
		}
		record := make([]string, 0, len(columns))
		for _, column := range columns {
			key := strings.TrimSpace(column.Key)
			cell, ok := cellByKey[key]
			if !ok {
				return nil, fmt.Errorf("csv export missing cell for column %q at row %d", key, rowIndex)
			}
			record = append(record, formatCSVValue(cell.DisplayValue))
		}
		if err := writer.Write(record); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func formatCSVValue(value any) string {
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
