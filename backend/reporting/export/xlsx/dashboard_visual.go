package xlsx

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/viant/forge/backend/reporting/tablemeta"
	"github.com/xuri/excelize/v2"
)

// visualDashboardWriter separates the authored visual report from the editable
// chart inputs and complete admitted data. A source worksheet belongs to one
// chart, so hiding rows cannot inadvertently filter a neighboring chart.
type visualDashboardWriter struct {
	dashboardWriter
	titleStyle       int
	noteStyle        int
	sectionStyle     int
	ownerIDs         []string
	chartDecorations []nativeChartDecoration
}

func renderDashboardWorkbook(report *reportfill.ReportFill) ([]byte, error) {
	return renderDashboardWorkbookPrint(report, nil)
}

func renderDashboardWorkbookPrint(report *reportfill.ReportFill, print *reportprint.ReportPrint) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()
	if err := f.SetSheetName("Sheet1", "Dashboard"); err != nil {
		return nil, err
	}
	w := &visualDashboardWriter{dashboardWriter: dashboardWriter{file: f, names: map[string]bool{"dashboard": true}}}
	for _, block := range report.Blocks {
		w.ownerIDs = append(w.ownerIDs, block.ID)
	}
	sort.Slice(w.ownerIDs, func(i, j int) bool { return len(w.ownerIDs[i]) > len(w.ownerIDs[j]) })
	styles := []struct {
		target *int
		style  *excelize.Style
	}{
		{&w.titleStyle, &excelize.Style{Font: &excelize.Font{Size: 22, Bold: true, Color: "243746"}}},
		{&w.headerStyle, &excelize.Style{Font: &excelize.Font{Bold: true, Color: "FFFFFF"}, Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"243746"}}, Alignment: &excelize.Alignment{WrapText: true}}},
		{&w.sectionStyle, &excelize.Style{Font: &excelize.Font{Size: 13, Bold: true, Color: "137CBD"}}},
		{&w.noteStyle, &excelize.Style{Font: &excelize.Font{Size: 10, Color: "526574"}, Alignment: &excelize.Alignment{WrapText: true, Vertical: "top"}}},
	}
	for _, item := range styles {
		var err error
		*item.target, err = f.NewStyle(item.style)
		if err != nil {
			return nil, err
		}
	}
	groups := dashboardGroups(report.Blocks)
	visualSheets := make([]string, len(groups))
	// Reserve and create every visual sheet first, in authored order.
	for i, group := range groups {
		visualSheets[i] = w.sheetName(group.title)
		if _, err := f.NewSheet(visualSheets[i]); err != nil {
			return nil, err
		}
	}
	if err := w.heading("Dashboard", 1, "Report dashboard", w.titleStyle); err != nil {
		return nil, err
	}
	row := 3
	for i, group := range groups {
		if err := w.link("Dashboard", row, group.title, visualSheets[i]); err != nil {
			return nil, err
		}
		row += 2
		var err error
		if print == nil {
			err = w.visualGroup(visualSheets[i], group)
		} else {
			err = w.printGroup(visualSheets[i], group, print)
		}
		if err != nil {
			return nil, err
		}
	}
	if err := w.note("Dashboard", row, "Filter a chart's source worksheet to select plotted rows. Edit those source values to update that chart. Raw dataset filters do not recalculate resolved charts or KPI snapshots."); err != nil {
		return nil, err
	}
	row += 4
	if err := w.heading("Dashboard", row, "Exported filter context", w.sectionStyle); err != nil {
		return nil, err
	}
	row += 2
	if err := w.note("Dashboard", row, "Parameters and refinements below describe this saved export. They do not rerun server queries, fetch more rows, or refresh this workbook."); err != nil {
		return nil, err
	}
	row += 3
	keys := make([]string, 0, len(report.Parameters))
	for key := range report.Parameters {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		if err := w.text("Dashboard", 1, row, key); err != nil {
			return nil, err
		}
		if err := w.text("Dashboard", 3, row, contextValue(report.Parameters[key])); err != nil {
			return nil, err
		}
		row++
	}
	for _, refinement := range report.Refinements {
		if err := w.note("Dashboard", row, contextValue(refinement)); err != nil {
			return nil, err
		}
		row += 3
	}
	metricSheet, err := w.metricValues(report)
	if err != nil {
		return nil, err
	}
	if metricSheet != "" {
		row += 2
		if err = w.link("Dashboard", row, "Resolved KPI values", metricSheet); err != nil {
			return nil, err
		}
		row += 2
	}
	for _, dataset := range report.Datasets {
		if err := w.rawDataset(dataset); err != nil {
			return nil, err
		}
	}
	if err := w.finishSheet("Dashboard", row+1, 8, true); err != nil {
		return nil, err
	}
	f.SetActiveSheet(0)
	buffer, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return visibleChartRows(buffer.Bytes(), w.chartDecorations...)
}

func contextValue(value any) string {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprint(value)
	}
	if text, ok := value.(string); ok {
		return text
	}
	return string(data)
}
func sheetReference(sheet string) string { return "'" + strings.ReplaceAll(sheet, "'", "''") + "'!" }

func (w *visualDashboardWriter) heading(sheet string, row int, text string, style int) error {
	cell := fmt.Sprintf("A%d", row)
	end := fmt.Sprintf("H%d", row)
	if err := w.text(sheet, 1, row, text); err != nil {
		return err
	}
	if err := w.file.MergeCell(sheet, cell, end); err != nil {
		return err
	}
	if err := w.file.SetCellStyle(sheet, cell, end, style); err != nil {
		return err
	}
	return w.file.SetRowHeight(sheet, row, 32)
}
func (w *visualDashboardWriter) note(sheet string, row int, text string) error {
	if err := w.heading(sheet, row, text, w.noteStyle); err != nil {
		return err
	}
	return w.file.SetRowHeight(sheet, row, 42)
}
func (w *visualDashboardWriter) link(sheet string, row int, label, target string) error {
	if err := w.text(sheet, 1, row, label); err != nil {
		return err
	}
	return w.file.SetCellHyperLink(sheet, fmt.Sprintf("A%d", row), sheetReference(target)+"A1", "Location")
}
func (w *visualDashboardWriter) finishSheet(sheet string, lastRow, cols int, visual bool) error {
	end, err := excelize.ColumnNumberToName(max(cols, 8))
	if err != nil {
		return err
	}
	// Eight 18-character columns enclose the 720-pixel native chart in Excel's
	// drawing units; narrower columns clipped the chart at the print boundary.
	width := 18.0
	if err = w.file.SetColWidth(sheet, "A", end, width); err != nil {
		return err
	}
	for column, width := range w.columnWidths[sheet] {
		name, err := excelize.ColumnNumberToName(column)
		if err != nil {
			return err
		}
		if err = w.file.SetColWidth(sheet, name, name, width); err != nil {
			return err
		}
	}
	grid := false
	if err = w.file.SetSheetView(sheet, 0, &excelize.ViewOptions{ShowGridLines: &grid}); err != nil {
		return err
	}
	frozenRows := 2
	if !visual {
		frozenRows = 4
	}
	if err = w.file.SetPanes(sheet, &excelize.Panes{Freeze: true, YSplit: frozenRows, TopLeftCell: fmt.Sprintf("A%d", frozenRows+1), ActivePane: "bottomLeft"}); err != nil {
		return err
	}
	landscape := "landscape"
	fit := true
	if err = w.file.SetSheetProps(sheet, &excelize.SheetPropsOptions{FitToPage: &fit}); err != nil {
		return err
	}
	one, unbounded := 1, 0
	if err = w.file.SetPageLayout(sheet, &excelize.PageLayoutOptions{Orientation: &landscape, FitToWidth: &one, FitToHeight: &unbounded}); err != nil {
		return err
	}
	if !visual {
		if err = w.file.SetDefinedName(&excelize.DefinedName{Name: "_xlnm.Print_Titles", Scope: sheet, RefersTo: sheetReference(sheet) + "$4:$4"}); err != nil {
			return err
		}
	}
	return w.file.SetDefinedName(&excelize.DefinedName{Name: "_xlnm.Print_Area", Scope: sheet, RefersTo: fmt.Sprintf("%s$A$1:$%s$%d", sheetReference(sheet), end, max(lastRow, 3))})
}

func (w *visualDashboardWriter) visualGroup(sheet string, group dashboardGroup) error {
	if err := w.heading(sheet, 1, group.title, w.titleStyle); err != nil {
		return err
	}
	row, maxCols := 3, 8
	for _, block := range group.blocks {
		title := firstText(block.Title, block.ID)
		switch {
		case block.Content != nil:
			if err := w.heading(sheet, row, title, w.sectionStyle); err != nil {
				return err
			}
			row++
			columns := append([]reportfill.TableColumn{}, block.Content.Columns...)
			for i := range columns {
				columns[i].Label = tablemeta.Header(columns[i].Label, columns[i].Key, block.Content.ColumnGroups)
			}
			rows := make([][]any, 0, len(block.Content.ResolvedRows))
			for _, resolved := range block.Content.ResolvedRows {
				cells := map[string]any{}
				for _, cell := range resolved.Cells {
					cells[cell.Key] = cell.Value
				}
				values := make([]any, len(columns))
				for i, column := range columns {
					value, ok := cells[column.Key]
					if !ok {
						return fmt.Errorf("xlsx export missing cell for column %q at row %d", column.Key, resolved.RowIndex)
					}
					values[i] = value
				}
				rows = append(rows, values)
			}
			if err := w.table(sheet, row, columns, rows); err != nil {
				return err
			}
			row += len(rows) + 3
			maxCols = max(maxCols, len(columns))
		case block.ChartContent != nil && block.ChartContent.ResolvedChart != nil:
			if err := w.heading(sheet, row, title, w.sectionStyle); err != nil {
				return err
			}
			row++
			source, diagnostic, err := w.chartSource(block)
			if err != nil {
				return err
			}
			if err = w.link(sheet, row, "Filter or edit chart data: "+source, source); err != nil {
				return err
			}
			row++
			model := block.ChartContent.ChartModel
			xLabel := chartString(chartMap(model["xAxis"])["label"])
			yLabel := chartString(chartMap(model["yAxis"])["label"])
			if xLabel != "" || yLabel != "" {
				if err = w.note(sheet, row, "Horizontal axis: "+firstText(xLabel, block.ChartContent.ResolvedChart.XAxisKey)+". Vertical axis: "+firstText(yLabel, "Value")+"."); err != nil {
					return err
				}
				row++
			}
			if diagnostic != "" {
				if err = w.note(sheet, row, diagnostic); err != nil {
					return err
				}
				row += 3
				continue
			}
			if err = w.nativeChart(sheet, source, row, block); err != nil {
				return err
			}
			row += 22
			if center := block.ChartContent.ResolvedChart.Center; center != nil {
				if err = w.note(sheet, row, center.Label+": "+center.FormattedValue+" (dataset snapshot; unchanged by chart filters)"); err != nil {
					return err
				}
				row += 3
			}
		case block.KPIContent != nil:
			content := block.KPIContent
			if err := w.heading(sheet, row, firstText(content.Title, title), w.sectionStyle); err != nil {
				return err
			}
			row++
			if err := w.table(sheet, row, []reportfill.TableColumn{{Key: "value", Label: firstText(content.ValueLabel, "Value"), Format: content.ValueFormat}}, [][]any{{content.Value}}); err != nil {
				return err
			}
			row += 4
		case block.MarkdownContent != nil:
			if err := w.note(sheet, row, block.MarkdownContent.Markdown); err != nil {
				return err
			}
			row += 3
		case block.FilterBarContent != nil:
			if err := w.heading(sheet, row, block.FilterBarContent.Title+" (exported values)", w.sectionStyle); err != nil {
				return err
			}
			row++
			for _, parameter := range block.FilterBarContent.Params {
				if err := w.note(sheet, row, firstText(parameter.Label, parameter.ID)+": "+contextValue(parameter.Value)); err != nil {
					return err
				}
				row += 3
			}
		default:
			if err := w.note(sheet, row, "Visual unavailable in Excel: "+title+" ("+block.Kind+"). Complete admitted data is retained on data worksheets."); err != nil {
				return err
			}
			row += 3
		}
	}
	return w.finishSheet(sheet, row, maxCols, true)
}

func (w *visualDashboardWriter) rawDataset(dataset reportfill.Dataset) error {
	fields := map[string]bool{}
	for _, record := range dataset.Rows {
		for field := range record {
			fields[field] = true
		}
	}
	keys := make([]string, 0, len(fields))
	for key := range fields {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	columns, rows := mapTable(keys, dataset.Rows)
	sheet := w.sheetName("Data " + dataset.ID)
	if _, err := w.file.NewSheet(sheet); err != nil {
		return err
	}
	if err := w.heading(sheet, 1, "Dataset "+dataset.ID, w.titleStyle); err != nil {
		return err
	}
	if err := w.note(sheet, 2, "Complete admitted rows. Filters on this sheet explore raw data; they do not recompute report charts or KPI snapshots."); err != nil {
		return err
	}
	if err := w.filteredTable(sheet, 4, columns, rows); err != nil {
		return err
	}
	lastRow := len(rows) + 4
	context := [][]any{}
	if len(dataset.Request.Filters) > 0 {
		context = append(context, []any{"Filters", contextValue(dataset.Request.Filters)})
	}
	if len(dataset.Request.Refinements) > 0 {
		context = append(context, []any{"Refinements", contextValue(dataset.Request.Refinements)})
	}
	if dataset.Scope != nil {
		context = append(context, []any{"Scope", contextValue(dataset.Scope)})
	}
	if len(context) > 0 {
		lastRow += 3
		if err := w.table(sheet, lastRow, []reportfill.TableColumn{{Key: "context", Label: "Snapshot context"}, {Key: "value", Label: "Exported value"}}, context); err != nil {
			return err
		}
		lastRow += len(context)
	}
	return w.finishSheet(sheet, lastRow, len(columns), false)
}

func (w *visualDashboardWriter) filteredTable(sheet string, row int, columns []reportfill.TableColumn, rows [][]any) error {
	if err := w.table(sheet, row, columns, rows); err != nil {
		return err
	}
	if len(columns) == 0 || len(rows) == 0 {
		return nil
	}
	end, err := excelize.CoordinatesToCellName(len(columns), row+len(rows))
	if err != nil {
		return err
	}
	return w.file.AutoFilter(sheet, fmt.Sprintf("A%d:%s", row, end), nil)
}
