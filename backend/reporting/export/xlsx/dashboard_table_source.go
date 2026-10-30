package xlsx

import (
	"fmt"
	"strings"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/viant/forge/backend/reporting/tablemeta"
)

func dashboardNumberFormat(format string) string {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "currency2":
		return xlsxNumberFormat("currency")
	case "number":
		return "General"
	case "number5":
		return "#,##0.00000"
	case "compact", "compactnumber":
		return "General"
	default:
		return xlsxNumberFormat(format)
	}
}

func dashboardTableValues(block reportfill.Block) ([]reportfill.TableColumn, [][]any, error) {
	columns := append([]reportfill.TableColumn{}, block.Content.Columns...)
	for i := range columns {
		columns[i].Label = tablemeta.Header(columns[i].Label, columns[i].Key, block.Content.ColumnGroups)
	}
	rows := make([][]any, 0, len(block.Content.ResolvedRows))
	for _, resolved := range block.Content.ResolvedRows {
		cells := map[string]reportfill.ResolvedTableCell{}
		for _, cell := range resolved.Cells {
			cells[cell.Key] = cell
		}
		values := make([]any, len(columns))
		for i, column := range columns {
			value, ok := cells[column.Key]
			if !ok {
				return nil, nil, fmt.Errorf("xlsx export missing cell for column %q at row %d", column.Key, resolved.RowIndex)
			}
			values[i] = dashboardTableCellValue(column, value)
		}
		rows = append(rows, values)
	}
	return columns, rows, nil
}

func (w *visualDashboardWriter) tableSource(block reportfill.Block) (string, error) {
	columns, rows, err := dashboardTableValues(block)
	if err != nil {
		return "", err
	}
	sheet := w.sheetName("Table " + firstText(block.Title, block.ID))
	if _, err = w.file.NewSheet(sheet); err != nil {
		return "", err
	}
	if err = w.heading(sheet, 1, firstText(block.Title, block.ID), w.titleStyle); err != nil {
		return "", err
	}
	if err = w.note(sheet, 2, "Resolved report values, including authored calculations and totals. Filters explore this snapshot; complete underlying records remain on dataset worksheets."); err != nil {
		return "", err
	}
	if err = w.filteredTable(sheet, 4, columns, rows); err != nil {
		return "", err
	}
	return sheet, w.finishSheet(sheet, len(rows)+4, len(columns), false)
}

// Display aliases and value maps are semantic labels. Keep numeric formatting
// separate so workbook measurements retain their original precision and type.
func dashboardTableCellValue(column reportfill.TableColumn, cell reportfill.ResolvedTableCell) any {
	sourceKey := firstText(cell.SourceKey, column.SourceKey, column.Key)
	displayKey := firstText(cell.DisplayKey, column.DisplayKey, sourceKey)
	if displayKey != sourceKey || len(column.DisplayValueMap) > 0 {
		return cell.DisplayValue
	}
	return cell.Value
}
