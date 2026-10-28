package xlsx

import (
	"fmt"
	"math"
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
	if err := validateDashboardReport(report); err != nil {
		return nil, err
	}
	return renderDashboardWorkbook(report)
}

func validateDashboardReport(report *reportfill.ReportFill) error {
	if report == nil {
		return fmt.Errorf("reportFill is required")
	}
	if err := report.Validate(); err != nil {
		return err
	}
	for _, diagnostic := range report.Diagnostics {
		if blocksDashboardExport(diagnostic) {
			return fmt.Errorf("xlsx dashboard report diagnostic %q: %s", diagnostic.Code, diagnostic.Message)
		}
	}
	for _, dataset := range report.Datasets {
		for _, diagnostic := range dataset.Provenance.Diagnostics {
			if blocksDashboardExport(diagnostic) {
				return fmt.Errorf("xlsx dashboard dataset %q diagnostic %q: %s", dataset.ID, diagnostic.Code, diagnostic.Message)
			}
		}
		if dataset.Provenance.HasMore || dataset.Provenance.Truncated || (dataset.Request.Offset != nil && *dataset.Request.Offset > 0) {
			return fmt.Errorf("xlsx dashboard requires complete dataset %q", dataset.ID)
		}
	}
	if err := validateDashboardReferences(report); err != nil {
		return err
	}
	return nil
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
		if block.Sparkline != nil {
			for _, ref := range []string{block.Sparkline.DatasetRef, block.Sparkline.ComparisonDatasetRef} {
				if ref != "" && !datasets[ref] {
					return fmt.Errorf("xlsx dashboard block %q references unknown sparkline dataset %q", block.ID, ref)
				}
			}
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
	title     string
	blocks    []reportfill.Block
	ids       []string
	sharedIDs []string
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
		group := dashboardGroup{title: firstText(labels[id], section.SectionContent.Title, section.Title, id), ids: []string{id}}
		for _, container := range blocks {
			if container.TabGroupContent != nil {
				for _, sectionID := range container.TabGroupContent.SectionIDs {
					if sectionID == id {
						group.sharedIDs = append(group.sharedIDs, container.ID)
					}
				}
			}
		}
		visited := map[string]bool{}
		var walk func(string)
		walk = func(id string) {
			if visited[id] {
				return
			}
			visited[id] = true
			group.ids = append(group.ids, id)
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
			remaining.ids = append(remaining.ids, block.ID)
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
	headerStyle  int
	columnWidths map[string]map[int]float64
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
	return setXLSXText(w.file, sheet, cell, value)
}

func (w *dashboardWriter) table(sheet string, row int, columns []reportfill.TableColumn, rows [][]any) error {
	if row+len(rows) > 1048576 || len(columns) > 16384 {
		return fmt.Errorf("xlsx dashboard exceeds Excel worksheet limits on %q", sheet)
	}
	styles := map[string]int{}
	headerLines := 1
	if w.columnWidths == nil {
		w.columnWidths = map[string]map[int]float64{}
	}
	if w.columnWidths[sheet] == nil {
		w.columnWidths[sheet] = map[int]float64{}
	}
	for j, column := range columns {
		headerLines = max(headerLines, (len([]rune(firstText(column.Label, column.Key)))+17)/18)
		name, err := excelize.CoordinatesToCellName(j+1, row)
		if err != nil {
			return err
		}
		if err = setXLSXText(w.file, sheet, name, firstText(column.Label, column.Key)); err != nil {
			return err
		}
		if err = w.file.SetCellStyle(sheet, name, name, w.headerStyle); err != nil {
			return err
		}
		for i, values := range rows {
			width := math.Min(42, math.Max(18, float64(len([]rune(fmt.Sprint(values[j]))))+2))
			w.columnWidths[sheet][j+1] = math.Max(w.columnWidths[sheet][j+1], width)
			name, err = excelize.CoordinatesToCellName(j+1, row+i+1)
			if err != nil {
				return err
			}
			numeric, err := setXLSXCell(w.file, sheet, name, reportfill.ResolvedTableCell{Value: values[j]})
			if err != nil {
				return err
			}
			if format := dashboardNumberFormat(column.Format); numeric && format != "" {
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
	return w.file.SetRowHeight(sheet, row, math.Min(409, math.Max(24, float64(headerLines)*14+8)))
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
