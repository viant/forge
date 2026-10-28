package xlsx

import (
	"fmt"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

// Preserve typed materialized KPI calculations independently of formatted print
// cells, including secondary values that need not exist in a raw dataset row.
func (w *visualDashboardWriter) metricValues(report *reportfill.ReportFill) (string, error) {
	rows := [][]any{}
	for _, block := range report.Blocks {
		if value := block.KPIContent; value != nil {
			rows = append(rows, []any{block.ID, firstText(value.Title, block.Title), value.ValueLabel, value.Value, value.ValueFormat, value.SecondaryLabel, value.SecondaryValue, value.SecondaryFormat})
		}
	}
	if len(rows) == 0 {
		return "", nil
	}
	sheet := w.sheetName("Values")
	if _, err := w.file.NewSheet(sheet); err != nil {
		return "", err
	}
	if err := w.heading(sheet, 1, "Resolved KPI values", w.titleStyle); err != nil {
		return "", err
	}
	if err := w.note(sheet, 2, "Typed materialized values. Editing or filtering this snapshot does not rerun report calculations or change the printed KPI cards."); err != nil {
		return "", err
	}
	columns := []reportfill.TableColumn{{Key: "id", Label: "Block ID"}, {Key: "title", Label: "Title"}, {Key: "label", Label: "Value label"}, {Key: "value", Label: "Value"}, {Key: "format", Label: "Format"}, {Key: "secondaryLabel", Label: "Secondary label"}, {Key: "secondary", Label: "Secondary value"}, {Key: "secondaryFormat", Label: "Secondary format"}}
	if err := w.filteredTable(sheet, 4, columns, rows); err != nil {
		return "", err
	}
	for i, row := range rows {
		for _, pair := range []struct {
			column string
			format int
		}{{"D", 4}, {"G", 7}} {
			format := dashboardNumberFormat(fmt.Sprint(row[pair.format]))
			if format == "" {
				continue
			}
			style, err := w.file.NewStyle(&excelize.Style{CustomNumFmt: &format})
			if err != nil {
				return "", err
			}
			cell := fmt.Sprintf("%s%d", pair.column, i+5)
			if err = w.file.SetCellStyle(sheet, cell, cell, style); err != nil {
				return "", err
			}
		}
	}
	return sheet, w.finishSheet(sheet, len(rows)+4, len(columns), false)
}
