package xlsx

import (
	"fmt"
	"github.com/viant/forge/backend/reporting/tablemeta"
	"sort"
	"strings"
	"unicode"
	"unicode/utf16"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

// RenderDashboard renders one workbook with a dashboard and authored section/tab
// data sheets. Hosts must execute with DatasetFetchComplete before calling this
// function; incomplete producer results are rejected rather than exported as if
// complete. Raw dataset tables are retained alongside presentation tables so a
// block's row limit cannot discard source data. Render retains the legacy
// single-table export contract.
func RenderDashboard(report *reportfill.ReportFill) ([]byte, error) {
	if report == nil {
		return nil, fmt.Errorf("reportFill is required")
	}
	if err := report.Validate(); err != nil {
		return nil, err
	}
	for _, diagnostic := range report.Diagnostics {
		if blocksDashboardExport(diagnostic) {
			return nil, fmt.Errorf("xlsx dashboard report diagnostic %q: %s", diagnostic.Code, diagnostic.Message)
		}
	}
	for _, dataset := range report.Datasets {
		for _, diagnostic := range dataset.Provenance.Diagnostics {
			if blocksDashboardExport(diagnostic) {
				return nil, fmt.Errorf("xlsx dashboard dataset %q diagnostic %q: %s", dataset.ID, diagnostic.Code, diagnostic.Message)
			}
		}
		if dataset.Provenance.HasMore || dataset.Provenance.Truncated {
			return nil, fmt.Errorf("xlsx dashboard requires complete dataset %q", dataset.ID)
		}
	}
	if err := validateDashboardReferences(report); err != nil {
		return nil, err
	}
	workbook := excelize.NewFile()
	defer workbook.Close()
	if err := workbook.SetSheetName("Sheet1", "Dashboard"); err != nil {
		return nil, err
	}
	writer := dashboardWriter{file: workbook, names: map[string]bool{"dashboard": true}, datasets: map[string]bool{}}
	var err error
	writer.headerStyle, err = workbook.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	if err != nil {
		return nil, err
	}
	if err := writer.text("Dashboard", 1, 1, "Dashboard"); err != nil {
		return nil, err
	}
	writer.dashboardRow = 3
	for _, group := range dashboardGroups(report.Blocks) {
		if err := writer.group(group, report.Datasets); err != nil {
			return nil, err
		}
	}
	// Retain datasets with no visible block (including dependency/auxiliary data).
	for _, dataset := range report.Datasets {
		if !writer.datasets[dataset.ID] {
			if err := writer.group(dashboardGroup{title: "Data " + dataset.ID, datasetIDs: []string{dataset.ID}}, report.Datasets); err != nil {
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

func blocksDashboardExport(diagnostic reportfill.Diagnostic) bool {
	if strings.EqualFold(diagnostic.Severity, "error") || strings.EqualFold(diagnostic.Severity, "fatal") {
		return true
	}
	switch strings.ToLower(strings.TrimSpace(diagnostic.Code)) {
	case "truncated", "incomplete_result", "incomplete_dataset":
		return true
	}
	return false
}

func validateDashboardReferences(report *reportfill.ReportFill) error {
	datasets := map[string]bool{}
	for _, dataset := range report.Datasets {
		if datasets[dataset.ID] {
			return fmt.Errorf("xlsx dashboard duplicate dataset %q", dataset.ID)
		}
		datasets[dataset.ID] = true
	}
	children := map[string][]string{}
	for _, block := range report.Blocks {
		if _, ok := children[block.ID]; ok {
			return fmt.Errorf("xlsx dashboard duplicate block %q", block.ID)
		}
		if block.DatasetRef != "" && !datasets[block.DatasetRef] {
			return fmt.Errorf("xlsx dashboard block %q references unknown dataset %q", block.ID, block.DatasetRef)
		}
		children[block.ID] = append([]string{}, block.ChildBlockIDs...)
		if block.SectionContent != nil {
			children[block.ID] = append(children[block.ID], block.SectionContent.BlockIDs...)
		}
		if block.CompositeContent != nil {
			children[block.ID] = append(children[block.ID], block.CompositeContent.ChildBlockIDs...)
		}
	}
	state := map[string]int{}
	var visit func(string) error
	visit = func(id string) error {
		if state[id] == 1 {
			return fmt.Errorf("xlsx dashboard cyclic block reference %q", id)
		}
		if state[id] == 2 {
			return nil
		}
		next, ok := children[id]
		if !ok {
			return fmt.Errorf("xlsx dashboard references unknown block %q", id)
		}
		state[id] = 1
		for _, child := range next {
			if err := visit(child); err != nil {
				return err
			}
		}
		state[id] = 2
		return nil
	}
	for _, block := range report.Blocks {
		if err := visit(block.ID); err != nil {
			return err
		}
	}
	return nil
}

type dashboardGroup struct {
	title      string
	blocks     []reportfill.Block
	datasetIDs []string
}

// Section membership comes from authored IDs, never application field names.
// Tab groups determine section order and labels; unlisted sections are retained
// because a workbook represents the entire authored report, including inactive tabs.
func dashboardGroups(blocks []reportfill.Block) []dashboardGroup {
	byID := map[string]reportfill.Block{}
	for _, block := range blocks {
		byID[block.ID] = block
	}
	sections := []string{}
	labels := map[string]string{}
	added := map[string]bool{}
	for _, block := range blocks {
		if block.TabGroupContent == nil {
			continue
		}
		for _, tab := range block.TabGroupContent.Tabs {
			labels[tab.ID] = firstText(tab.Title, tab.NavigationLabel)
		}
		for _, id := range block.TabGroupContent.SectionIDs {
			if !added[id] {
				sections = append(sections, id)
				added[id] = true
			}
		}
	}
	for _, block := range blocks {
		if block.SectionContent != nil && !added[block.ID] {
			sections = append(sections, block.ID)
			added[block.ID] = true
		}
	}
	groups := []dashboardGroup{}
	assigned := map[string]bool{}
	for _, id := range sections {
		section, ok := byID[id]
		if !ok || section.SectionContent == nil {
			continue
		}
		group := dashboardGroup{title: firstText(labels[id], section.SectionContent.Title, section.Title, id)}
		visited := map[string]bool{}
		var walk func(string)
		walk = func(id string) {
			if visited[id] {
				return
			}
			visited[id] = true
			block, ok := byID[id]
			if !ok {
				return
			}
			if block.SectionContent != nil {
				for _, child := range block.SectionContent.BlockIDs {
					walk(child)
				}
			} else if block.CompositeContent != nil {
				for _, child := range block.CompositeContent.ChildBlockIDs {
					walk(child)
				}
			} else if len(block.ChildBlockIDs) > 0 {
				for _, child := range block.ChildBlockIDs {
					walk(child)
				}
			} else {
				group.blocks = append(group.blocks, block)
				assigned[id] = true
			}
		}
		for _, child := range section.SectionContent.BlockIDs {
			walk(child)
		}
		groups = append(groups, group)
	}
	remaining := dashboardGroup{title: "Report"}
	for _, block := range blocks {
		if !assigned[block.ID] && block.SectionContent == nil && block.TabGroupContent == nil && block.CompositeContent == nil {
			remaining.blocks = append(remaining.blocks, block)
		}
	}
	if len(remaining.blocks) > 0 || len(groups) == 0 {
		groups = append(groups, remaining)
	}
	return groups
}

type dashboardWriter struct {
	file         *excelize.File
	names        map[string]bool
	datasets     map[string]bool
	headerStyle  int
	dashboardRow int
}

func (w *dashboardWriter) group(group dashboardGroup, datasets []reportfill.Dataset) error {
	sheet := w.sheetName(group.title)
	if _, err := w.file.NewSheet(sheet); err != nil {
		return err
	}
	if err := w.text(sheet, 1, 1, group.title); err != nil {
		return err
	}
	if err := w.text("Dashboard", 1, w.dashboardRow, group.title); err != nil {
		return err
	}
	w.dashboardRow += 2
	row := 3
	needed := map[string]bool{}
	for _, id := range group.datasetIDs {
		needed[id] = true
	}
	for _, block := range group.blocks {
		if block.DatasetRef != "" {
			needed[block.DatasetRef] = true
		}
		title := firstText(block.Title, block.ID)
		switch {
		case block.Content != nil:
			if err := w.text(sheet, 1, row, title); err != nil {
				return err
			}
			row++
			rows := make([][]any, 0, len(block.Content.ResolvedRows))
			for _, resolved := range block.Content.ResolvedRows {
				cells := map[string]reportfill.ResolvedTableCell{}
				for _, cell := range resolved.Cells {
					cells[cell.Key] = cell
				}
				values := make([]any, len(block.Content.Columns))
				for i, column := range block.Content.Columns {
					cell, ok := cells[column.Key]
					if !ok {
						return fmt.Errorf("xlsx export missing cell for column %q at row %d", column.Key, resolved.RowIndex)
					}
					// Raw values retain numeric types even when the display string is formatted.
					values[i] = cell.Value
				}
				rows = append(rows, values)
			}
			columns := append([]reportfill.TableColumn{}, block.Content.Columns...)
			for i := range columns {
				columns[i].Label = tablemeta.Header(columns[i].Label, columns[i].Key, block.Content.ColumnGroups)
			}
			if err := w.table(sheet, row, columns, rows); err != nil {
				return err
			}
			row += len(rows) + 3
		case block.ChartContent != nil && block.ChartContent.ResolvedChart != nil:
			chart := block.ChartContent.ResolvedChart
			columns, rows, err := chartTable(chart)
			if err != nil {
				return err
			}
			if err := w.text(sheet, 1, row, title); err != nil {
				return err
			}
			row++
			if err := w.table(sheet, row, columns, rows); err != nil {
				return err
			}
			if err := w.chart(sheet, row, title, chart, len(columns)-1, len(rows)); err != nil {
				return err
			}
			row += len(rows) + 3
		case block.KPIContent != nil:
			content := block.KPIContent
			columns := []reportfill.TableColumn{{Key: "value", Label: firstText(content.ValueLabel, content.Title), Format: content.ValueFormat}}
			if err := w.text(sheet, 1, row, title); err != nil {
				return err
			}
			row++
			if err := w.table(sheet, row, columns, [][]any{{content.Value}}); err != nil {
				return err
			}
			if err := w.text("Dashboard", 1, w.dashboardRow, title); err != nil {
				return err
			}
			if _, err := setXLSXCell(w.file, "Dashboard", fmt.Sprintf("B%d", w.dashboardRow), reportfill.ResolvedTableCell{Value: content.Value}); err != nil {
				return err
			}
			w.dashboardRow += 2
			row += 4
		case block.MarkdownContent != nil:
			if err := w.text(sheet, 1, row, block.MarkdownContent.Markdown); err != nil {
				return err
			}
			row += 2
		}
	}
	for _, dataset := range datasets {
		if !needed[dataset.ID] {
			continue
		}
		fields := map[string]bool{}
		for _, data := range dataset.Rows {
			for field := range data {
				fields[field] = true
			}
		}
		keys := make([]string, 0, len(fields))
		for field := range fields {
			keys = append(keys, field)
		}
		sort.Strings(keys)
		columns, rows := mapTable(keys, dataset.Rows)
		if err := w.text(sheet, 1, row, "Dataset "+dataset.ID); err != nil {
			return err
		}
		row++
		if err := w.table(sheet, row, columns, rows); err != nil {
			return err
		}
		row += len(rows) + 3
		w.datasets[dataset.ID] = true
	}
	return w.file.SetColWidth(sheet, "A", "H", 20)
}

func mapTable(keys []string, records []map[string]any) ([]reportfill.TableColumn, [][]any) {
	columns := make([]reportfill.TableColumn, len(keys))
	for i, key := range keys {
		columns[i] = reportfill.TableColumn{Key: key, Label: key}
	}
	rows := make([][]any, len(records))
	for i, record := range records {
		rows[i] = make([]any, len(keys))
		for j, key := range keys {
			rows[i][j] = record[key]
		}
	}
	return columns, rows
}

func (w *dashboardWriter) text(sheet string, column, row int, value string) error {
	cell, err := excelize.CoordinatesToCellName(column, row)
	if err != nil {
		return err
	}
	return w.file.SetCellStr(sheet, cell, value)
}

func (w *dashboardWriter) table(sheet string, row int, columns []reportfill.TableColumn, rows [][]any) error {
	if row+len(rows) > 1048576 || len(columns) > 16384 {
		return fmt.Errorf("xlsx dashboard exceeds Excel worksheet limits on %q", sheet)
	}
	styles := map[string]int{}
	for j, column := range columns {
		name, err := excelize.CoordinatesToCellName(j+1, row)
		if err != nil {
			return err
		}
		if err = w.file.SetCellStr(sheet, name, firstText(column.Label, column.Key)); err != nil {
			return err
		}
		if err = w.file.SetCellStyle(sheet, name, name, w.headerStyle); err != nil {
			return err
		}
		for i, values := range rows {
			name, err = excelize.CoordinatesToCellName(j+1, row+i+1)
			if err != nil {
				return err
			}
			numeric, err := setXLSXCell(w.file, sheet, name, reportfill.ResolvedTableCell{Value: values[j]})
			if err != nil {
				return err
			}
			if format := xlsxNumberFormat(column.Format); numeric && format != "" {
				style, ok := styles[format]
				if !ok {
					style, err = w.file.NewStyle(&excelize.Style{CustomNumFmt: &format})
					if err != nil {
						return err
					}
					styles[format] = style
				}
				if err = w.file.SetCellStyle(sheet, name, name, style); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// Resolved category rows use canonical name/value keys in JS fills, while the
// Go inline compiler retains the authored keys. Cartesian grouped fills may be
// either a resolved wide table or authored long rows; pivot only the latter.
func chartTable(chart *reportfill.ResolvedChart) ([]reportfill.TableColumn, [][]any, error) {
	if chart.Kind == "category" {
		name, value := chart.NameKey, chart.ValueKey
		if len(chart.Rows) > 0 {
			if _, ok := chart.Rows[0][name]; !ok {
				name = "name"
			}
			if _, ok := chart.Rows[0][value]; !ok {
				value = "value"
			}
		}
		columns, rows := mapTable([]string{name, value}, chart.Rows)
		return columns, rows, nil
	}
	keys := append([]string{chart.XAxisKey}, chart.SeriesKeys...)
	if chart.Kind == "groupedSeries" && len(chart.Rows) > 0 {
		_, longName := chart.Rows[0][chart.NameKey]
		_, longValue := chart.Rows[0][chart.ValueKey]
		if longName && longValue {
			rows := [][]any{}
			indexes := map[string]int{}
			positions := map[string]int{}
			for i, key := range chart.SeriesKeys {
				positions[key] = i + 1
			}
			for _, record := range chart.Rows {
				category := record[chart.XAxisKey]
				identity := fmt.Sprintf("%T:%v", category, category)
				index, ok := indexes[identity]
				if !ok {
					index = len(rows)
					indexes[identity] = index
					row := make([]any, len(keys))
					row[0] = category
					rows = append(rows, row)
				}
				position, ok := positions[fmt.Sprint(record[chart.NameKey])]
				if !ok {
					return nil, nil, fmt.Errorf("xlsx chart contains undeclared series")
				}
				if rows[index][position] != nil {
					return nil, nil, fmt.Errorf("xlsx chart contains duplicate category/series pair")
				}
				rows[index][position] = record[chart.ValueKey]
			}
			columns, _ := mapTable(keys, nil)
			return columns, rows, nil
		}
	}
	columns, rows := mapTable(keys, chart.Rows)
	return columns, rows, nil
}

func (w *dashboardWriter) chart(sheet string, headerRow int, title string, resolved *reportfill.ResolvedChart, seriesCount, rowCount int) error {
	types := map[string]excelize.ChartType{"line": excelize.Line, "bar": excelize.Col, "column": excelize.Col, "area": excelize.Area, "pie": excelize.Pie, "donut": excelize.Doughnut, "doughnut": excelize.Doughnut, "scatter": excelize.Scatter, "horizontal_bar": excelize.Bar, "stacked_bar": excelize.ColStacked, "stacked_area": excelize.AreaStacked}
	kind, ok := types[strings.ToLower(resolved.Type)]
	if !ok || len(resolved.Rows) == 0 {
		return nil
	}
	if seriesCount == 0 {
		return nil
	}
	quoted := "'" + strings.ReplaceAll(sheet, "'", "''") + "'!"
	chart := &excelize.Chart{Type: kind, Dimension: excelize.ChartDimension{Width: 720, Height: 360}, Legend: excelize.ChartLegend{Position: "bottom"}}
	for i := 0; i < seriesCount; i++ {
		column, _ := excelize.ColumnNumberToName(i + 2)
		chart.Series = append(chart.Series, excelize.ChartSeries{Name: fmt.Sprintf("%s$%s$%d", quoted, column, headerRow), Categories: fmt.Sprintf("%s$A$%d:$A$%d", quoted, headerRow+1, headerRow+rowCount), Values: fmt.Sprintf("%s$%s$%d:$%s$%d", quoted, column, headerRow+1, column, headerRow+rowCount)})
		if kind == excelize.Pie || kind == excelize.Doughnut {
			break
		}
	}
	// Titles live in worksheet cells so the renderer remains compatible with
	// both Excelize 2.10 and 2.11, whose chart-title option types differ.
	if err := w.text("Dashboard", 1, w.dashboardRow, title); err != nil {
		return err
	}
	w.dashboardRow++
	anchor := fmt.Sprintf("A%d", w.dashboardRow)
	if err := w.file.AddChart("Dashboard", anchor, chart); err != nil {
		return err
	}
	w.dashboardRow += 20
	return nil
}

func firstText(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (w *dashboardWriter) sheetName(title string) string {
	title = strings.Map(func(r rune) rune {
		if strings.ContainsRune(":\\/?*[]", r) || unicode.IsControl(r) {
			return '-'
		}
		return r
	}, strings.TrimSpace(title))
	title = strings.Trim(title, "'")
	if title == "" {
		title = "Report"
	}
	truncate := func(value string, limit int) string {
		runes := []rune(value)
		for len(utf16.Encode(runes)) > limit {
			runes = runes[:len(runes)-1]
		}
		return string(runes)
	}
	for n := 1; ; n++ {
		suffix := ""
		if n > 1 {
			suffix = fmt.Sprintf(" (%d)", n)
		}
		candidate := strings.Trim(truncate(title, 31-len(suffix)), "'") + suffix
		if !w.names[strings.ToLower(candidate)] {
			w.names[strings.ToLower(candidate)] = true
			return candidate
		}
	}
}
