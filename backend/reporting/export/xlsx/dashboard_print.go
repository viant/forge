package xlsx

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"unicode/utf16"

	"github.com/dop251/goja"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// RenderDashboardWithPrint renders canonical print geometry alongside native
// editable charts and complete workbook data. Pass the original matched public
// artifacts, not a re-marshaled ReportFill (which omits some print-only metadata).
// The print's fill hash is checked before any content is rendered.
func RenderDashboardWithPrint(fillJSON, printJSON json.RawMessage) ([]byte, error) {
	return renderDashboardWithPrint(fillJSON, printJSON, reportfill.DecodeJSON)
}

// RenderDatasourceDashboardWithPrint renders server-materialized datasource
// results with opaque producer requests. Hosts remain responsible for datasource
// authorization. The original matched artifacts retain their canonical fill hash.
func RenderDatasourceDashboardWithPrint(fillJSON, printJSON json.RawMessage) ([]byte, error) {
	return renderDashboardWithPrint(fillJSON, printJSON, reportfill.DecodeDatasourceJSON)
}

func renderDashboardWithPrint(fillJSON, printJSON json.RawMessage, decodeFill func([]byte) (*reportfill.ReportFill, error)) ([]byte, error) {
	fill, err := decodeFill(fillJSON)
	if err != nil {
		return nil, err
	}
	if err = validateDashboardReport(fill); err != nil {
		return nil, err
	}
	print, err := reportprint.DecodeJSON(printJSON)
	if err != nil {
		return nil, err
	}
	// JSON.stringify preserves canonical producer key order while normalizing
	// whitespace, JSON escapes and numeric literals exactly as Forge does.
	runtime := goja.New()
	if err = runtime.Set("payload", string(fillJSON)); err != nil {
		return nil, err
	}
	canonical, err := runtime.RunString("JSON.stringify(JSON.parse(payload))")
	if err != nil {
		return nil, err
	}
	hash := uint32(2166136261)
	for _, unit := range utf16.Encode([]rune(canonical.String())) {
		hash ^= uint32(unit)
		hash *= 16777619
	}
	if print.FillHash != fmt.Sprintf("fnv1a:%08x", hash) || print.SpecHash != fill.SpecHash || print.FillVersion != fill.Version || print.SpecVersion != fill.SpecVersion {
		return nil, fmt.Errorf("xlsx reportPrint does not match reportFill")
	}
	if print.Source.Kind != fill.Source.Kind || print.Source.ContainerID != fill.Source.ContainerID || print.Source.StateKey != fill.Source.StateKey || print.Source.DataSourceRef != fill.Source.DataSourceRef {
		return nil, fmt.Errorf("xlsx reportPrint source does not match reportFill")
	}
	for _, diagnostic := range print.Diagnostics {
		if diagnostic.Severity == "error" || diagnostic.Severity == "fatal" {
			return nil, fmt.Errorf("xlsx reportPrint diagnostic %s: %s", diagnostic.Code, diagnostic.Message)
		}
	}
	if err = validatePrintGeometry(print); err != nil {
		return nil, err
	}
	if err = validatePrintBindings(fill, print); err != nil {
		return nil, err
	}
	return renderDashboardWorkbookPrint(fill, print)
}

func validatePrintBindings(fill *reportfill.ReportFill, print *reportprint.ReportPrint) error {
	blocks := map[string]reportfill.Block{}
	for _, block := range fill.Blocks {
		blocks[block.ID] = block
	}
	for _, page := range print.Pages {
		for _, element := range page.Elements {
			binding := element.ChartSource
			if binding == nil {
				continue
			}
			block, ok := blocks[binding.BlockID]
			if !ok || block.ChartContent == nil || block.ChartContent.ResolvedChart == nil || !strings.HasPrefix(element.ID, binding.BlockID+"__") {
				return fmt.Errorf("xlsx chart source references unknown or mismatched block %q", binding.BlockID)
			}
			_, rows, err := chartDisplayTable(block)
			if err != nil {
				return err
			}
			if binding.RowOffset > len(rows) || binding.RowCount > len(rows)-binding.RowOffset {
				return fmt.Errorf("xlsx chart source slice exceeds block %q rows", binding.BlockID)
			}
		}
	}
	return nil
}

func validatePrintGeometry(print *reportprint.ReportPrint) error {
	finite := func(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
	if !finite(print.PageGeometry.Width) || !finite(print.PageGeometry.Height) || print.PageGeometry.Width > 10000 || print.PageGeometry.Height > 10000 {
		return fmt.Errorf("xlsx reportPrint page geometry is outside supported bounds")
	}
	for _, page := range print.Pages {
		for _, elements := range [][]reportprint.Element{page.HeaderElements, page.Elements, page.FooterElements} {
			for _, element := range elements {
				b := element.Box
				for _, v := range []float64{b.X, b.Y, b.Width, b.Height, element.FontSize, element.StrokeWidth, element.Radius} {
					if !finite(v) {
						return fmt.Errorf("xlsx reportPrint element %q has non-finite geometry", element.ID)
					}
				}
				if b.X < 0 || b.Y < 0 || b.Width < 0 || b.Height < 0 {
					return fmt.Errorf("xlsx reportPrint element %q has negative geometry", element.ID)
				}
				if b.X+b.Width > print.PageGeometry.Width+1 || b.Y+b.Height > print.PageGeometry.Height+1 {
					return fmt.Errorf("xlsx reportPrint element %q extends outside its page", element.ID)
				}
			}
		}
	}
	return nil
}

// A fine worksheet grid preserves print positions and permits native text and
// table cells. Excelize's .5-column width is four pixels (3 points).
const printColumnPoints = 3.0
const printRowPoints = 3.0

func printCells(box reportprint.Box, yOffset float64) (string, string, int, int, error) {
	col := max(1, int(math.Round(box.X/printColumnPoints))+1)
	row := max(1, int(math.Round((box.Y+yOffset)/printRowPoints))+1)
	lastCol := max(col, int(math.Round((box.X+box.Width)/printColumnPoints)))
	lastRow := max(row, int(math.Round((box.Y+yOffset+box.Height)/printRowPoints)))
	first, err := excelize.CoordinatesToCellName(col, row)
	if err != nil {
		return "", "", 0, 0, err
	}
	last, err := excelize.CoordinatesToCellName(lastCol, lastRow)
	return first, last, col, row, err
}

func reportPrintElementOwner(owners []string, id string) string {
	for _, owner := range owners {
		if id == owner || strings.HasPrefix(id, owner+"__") {
			return owner
		}
	}
	return ""
}
func (w *visualDashboardWriter) groupOwnsElement(group dashboardGroup, id string) bool {
	owner := reportPrintElementOwner(w.ownerIDs, id)
	for _, blockID := range group.ids {
		if owner != "" && owner == blockID {
			return true
		}
	}
	return false
}

func (w *visualDashboardWriter) printGroup(sheet string, group dashboardGroup, print *reportprint.ReportPrint) error {
	type chartSource struct {
		block             reportfill.Block
		sheet, diagnostic string
		occurrences       int
		mini              bool
		nativeOccurrences int
		fidelityReason    string
	}
	sources := map[string]*chartSource{}
	tableSources := map[string]string{}
	for _, block := range group.blocks {
		if block.Content != nil {
			source, err := w.tableSource(block)
			if err != nil {
				return err
			}
			tableSources[block.ID] = source
		}
		if spark := dashboardSparkline(block); spark != nil {
			source, diagnostic, err := w.chartSource(*spark)
			if err != nil {
				return err
			}
			sources[block.ID] = &chartSource{block: *spark, sheet: source, diagnostic: diagnostic, mini: true}
		}
		if block.ChartContent != nil && block.ChartContent.ResolvedChart != nil {
			source, diagnostic, err := w.chartSource(block)
			if err != nil {
				return err
			}
			sources[block.ID] = &chartSource{block: block, sheet: source, diagnostic: diagnostic}
		}
	}
	for _, page := range print.Pages {
		for _, element := range page.Elements {
			for id, source := range sources {
				if element.Kind == "svg" && (strings.HasPrefix(element.ID, id+"__svg_page_") || (source.mini && element.ID == id+"__sparkline")) {
					source.occurrences++
				}
			}
		}
	}
	lastCol := int(math.Ceil(print.PageGeometry.Width / printColumnPoints))
	endCol, err := excelize.ColumnNumberToName(lastCol)
	if err != nil {
		return err
	}
	if err = w.file.SetColWidth(sheet, "A", endCol, 0.5); err != nil {
		return err
	}
	pageRows := int(math.Ceil(print.PageGeometry.Height / printRowPoints))
	pageCount := 0
	for _, page := range print.Pages {
		body := []reportprint.Element{}
		for _, element := range page.Elements {
			if w.groupOwnsElement(group, element.ID) {
				body = append(body, element)
			}
		}
		if len(body) == 0 {
			continue
		}
		ownTop, pageTop := body[0].Box.Y, body[0].Box.Y
		for _, element := range body {
			ownTop = math.Min(ownTop, element.Box.Y)
		}
		sharedElement := func(id string) bool {
			for _, shared := range group.sharedIDs {
				if id == shared || strings.HasPrefix(id, shared+"__") {
					return true
				}
			}
			return false
		}
		foreignBefore := false
		for _, element := range page.Elements {
			pageTop = math.Min(pageTop, element.Box.Y)
			if !w.groupOwnsElement(group, element.ID) && !sharedElement(element.ID) && element.Box.Y < ownTop {
				foreignBefore = true
			}
		}
		if foreignBefore {
			// A global PDF page can begin with another tab. Remove only that
			// leading gap, preserving every relative position within this tab.
			for i := range body {
				body[i].Box.Y -= ownTop - pageTop
			}
		} else {
			for _, element := range page.Elements {
				if sharedElement(element.ID) {
					body = append(body, element)
				}
			}
		}
		offset := float64(pageCount*pageRows) * printRowPoints
		if pageCount > 0 {
			if err = w.file.InsertPageBreak(sheet, fmt.Sprintf("A%d", pageCount*pageRows+1)); err != nil {
				return err
			}
		}
		pageCount++
		// Establish geometry before adding drawings, whose two-cell anchors are
		// computed using the current row sizes.
		for row := (pageCount-1)*pageRows + 1; row <= pageCount*pageRows; row++ {
			if err = w.file.SetRowHeight(sheet, row, printRowPoints); err != nil {
				return err
			}
		}
		for _, elements := range [][]reportprint.Element{page.HeaderElements, body, page.FooterElements} {
			sort.SliceStable(elements, func(i, j int) bool {
				a, b := 0, 0
				if elements[i].ZIndex != nil {
					a = *elements[i].ZIndex
				}
				if elements[j].ZIndex != nil {
					b = *elements[j].ZIndex
				}
				return a < b
			})
			for _, element := range elements {
				var source *chartSource
				if element.Kind == "tableCellText" && overlapsDataBar(element, elements) {
					if err = w.printDataBarLabel(sheet, element, offset); err != nil {
						return err
					}
					continue
				}
				if element.Kind == "svg" {
					if element.ChartSource != nil {
						source = sources[element.ChartSource.BlockID]
						if source == nil {
							return fmt.Errorf("xlsx chart source references unknown block %q", element.ChartSource.BlockID)
						}
					}
					for id, candidate := range sources {
						if source != nil {
							break
						}
						if strings.HasPrefix(element.ID, id+"__svg_page_") || (candidate.mini && element.ID == id+"__sparkline") {
							source = candidate
							break
						}
					}
				}
				if source != nil {
					source.fidelityReason = nativePrintFidelityReason(source.block, element.SVG)
				}
				if source != nil && source.diagnostic == "" && source.fidelityReason == "" && (element.ChartSource != nil || (source.occurrences == 1 && (source.block.RowLimit == nil || *source.block.RowLimit == 0 || *source.block.RowLimit >= len(source.block.ChartContent.ResolvedChart.Rows)))) {
					_, sourceRows, err := chartDisplayTable(source.block)
					if err != nil {
						return err
					}
					visibleRows := len(sourceRows)
					if binding := element.ChartSource; binding != nil {
						if binding.RowOffset > len(sourceRows) || binding.RowCount > len(sourceRows)-binding.RowOffset {
							return fmt.Errorf("xlsx chart source slice exceeds block %q rows", binding.BlockID)
						}
						visibleRows = binding.RowCount
					}
					charts, err := dashboardNativeCharts(source.sheet, source.block, visibleRows)
					if err != nil {
						return err
					}
					if source.mini {
						for _, chart := range charts {
							miniChart(chart)
						}
					}
					colors := nativePointColors(source.block)
					if binding := element.ChartSource; binding != nil {
						if err = sliceNativeCharts(charts, binding.RowOffset, binding.RowCount); err != nil {
							return err
						}
						if len(colors) > 0 {
							colors = colors[binding.RowOffset : binding.RowOffset+binding.RowCount]
						}
						for _, chart := range charts {
							chart.YAxis.Minimum = binding.MinValue
							chart.YAxis.Maximum = binding.MaxValue
						}
					}
					cell, _, col, row, err := printCells(element.Box, offset)
					if err != nil {
						return err
					}
					charts[0].Dimension = excelize.ChartDimension{Width: uint(math.Round(element.Box.Width * 4 / 3)), Height: uint(math.Round(element.Box.Height * 4 / 3))}
					charts[0].Format = excelize.GraphicOptions{OffsetX: max(0, int(math.Round((element.Box.X-float64(col-1)*printColumnPoints)*4/3))), OffsetY: max(0, int(math.Round((element.Box.Y+offset-float64(row-1)*printRowPoints)*4/3)))}
					if err = w.file.AddChart(sheet, cell, charts[0], charts[1:]...); err != nil {
						return err
					}
					w.chartDecorations = append(w.chartDecorations, nativeChartDecoration{PointColors: colors, Mini: source.mini})
					source.nativeOccurrences++
					continue
				}
				if err = w.printElement(sheet, element, offset); err != nil {
					return fmt.Errorf("xlsx print element %q: %w", element.ID, err)
				}
				for id, source := range sources {
					if strings.HasPrefix(element.ID, id+"__title") {
						cell, _, _, _, err := printCells(element.Box, offset)
						if err != nil {
							return err
						}
						if err = w.file.SetCellHyperLink(sheet, cell, sheetReference(source.sheet)+"A1", "Location"); err != nil {
							return err
						}
					}
				}
				for id, source := range tableSources {
					if strings.HasPrefix(element.ID, id+"__title") {
						cell, _, _, _, err := printCells(element.Box, offset)
						if err != nil {
							return err
						}
						if err = w.file.SetCellHyperLink(sheet, cell, sheetReference(source)+"A1", "Location"); err != nil {
							return err
						}
					}
				}
			}
		}
	}
	if pageCount == 0 {
		for _, source := range sources {
			if err = w.note(source.sheet, 2, "No visible chart was emitted for this tab in the exported scope. Filters explore the retained resolved values without rerunning the report."); err != nil {
				return err
			}
		}
		if err = w.heading(sheet, 1, group.title, w.titleStyle); err != nil {
			return err
		}
		if err = w.note(sheet, 3, "No visible print content for this authored tab in the exported scope. Complete admitted data remains available on the supporting worksheets."); err != nil {
			return err
		}
		return w.finishSheet(sheet, 6, 8, true)
	}
	lastRow := pageCount * pageRows
	if err = w.file.AddIgnoredErrors(sheet, fmt.Sprintf("A1:%s%d", endCol, lastRow), excelize.IgnoredErrorsNumberStoredAsText); err != nil {
		return err
	}
	// Links and interaction limits are outside the canonical print area.
	guideRow := lastRow + 3
	if err = w.text(sheet, 1, guideRow, "Chart controls and print fidelity"); err != nil {
		return err
	}
	guideRow += 6
	for _, block := range group.blocks {
		source := sources[block.ID]
		if source == nil {
			continue
		}
		label := "Filter or edit " + firstText(block.Title, block.ID) + ": " + source.sheet
		if err = w.link(sheet, guideRow, label, source.sheet); err != nil {
			return err
		}
		guideRow += 6
		if source.occurrences == 0 {
			if err = w.note(source.sheet, 2, "No visible print chart was emitted for this block. Filters explore its retained resolved values without rerunning the report."); err != nil {
				return err
			}
			continue
		}
		if source.diagnostic != "" || source.nativeOccurrences < source.occurrences {
			if err = w.text(sheet, 1, guideRow, "Static print visual: source filtering does not change this image. "+source.diagnostic+source.fidelityReason); err != nil {
				return err
			}
			guideRow += 6
			// Native equivalents remain available for paginated/limited views, but
			// use a separate full-data view instead of silently changing print scope.
			if source.diagnostic == "" {
				_, rows, _ := chartDisplayTable(source.block)
				if err = w.nativeChart(source.sheet, source.sheet, len(rows)+12, source.block); err != nil {
					return err
				}
			}
		}
	}
	grid := false
	if err = w.file.SetSheetView(sheet, 0, &excelize.ViewOptions{ShowGridLines: &grid, ShowRowColHeaders: &grid}); err != nil {
		return err
	}
	landscape := "portrait"
	if print.PageGeometry.Width > print.PageGeometry.Height {
		landscape = "landscape"
	}
	one, zero := 1, 0
	fit := true
	if err = w.file.SetSheetProps(sheet, &excelize.SheetPropsOptions{FitToPage: &fit}); err != nil {
		return err
	}
	size := 1
	if math.Abs(math.Min(print.PageGeometry.Width, print.PageGeometry.Height)-595) < 3 && math.Abs(math.Max(print.PageGeometry.Width, print.PageGeometry.Height)-842) < 3 {
		size = 9
	}
	margin := 0.0
	if err = w.file.SetPageMargins(sheet, &excelize.PageLayoutMarginsOptions{Left: &margin, Right: &margin, Top: &margin, Bottom: &margin, Header: &margin, Footer: &margin}); err != nil {
		return err
	}
	if err = w.file.SetPageLayout(sheet, &excelize.PageLayoutOptions{Size: &size, Orientation: &landscape, FitToWidth: &one, FitToHeight: &zero}); err != nil {
		return err
	}
	return w.file.SetDefinedName(&excelize.DefinedName{Name: "_xlnm.Print_Area", Scope: sheet, RefersTo: fmt.Sprintf("%s$A$1:$%s$%d", sheetReference(sheet), endCol, lastRow)})
}

func (w *visualDashboardWriter) printElement(sheet string, element reportprint.Element, offset float64) error {
	first, last, _, _, err := printCells(element.Box, offset)
	if err != nil {
		return err
	}
	switch element.Kind {
	case "tableCellBadge", "tableCellTone":
		return w.printLabelPill(sheet, element, offset)
	case "svg":
		return w.printSVG(sheet, element, offset)
	case "image":
		return w.printImage(sheet, element, offset)
	case "line":
		return w.printLine(sheet, element, offset)
	case "text", "tableCellText":
		style := &excelize.Style{Font: &excelize.Font{Family: "Arial", Size: element.FontSize, Color: excelChartColor(element.Color)}, Alignment: &excelize.Alignment{Horizontal: firstText(element.Align, "left"), Vertical: firstText(element.VerticalAlign, "center"), WrapText: element.Wrap}}
		if style.Alignment.Vertical == "middle" {
			style.Alignment.Vertical = "center"
		}
		if style.Font.Size <= 0 {
			style.Font.Size = 10
		}
		if style.Font.Color == "" {
			style.Font.Color = "101828"
		}
		style.Font.Bold, style.Font.Italic = reportprint.TextEmphasis(element.FontWeight)
		value := element.Text
		{
			oldID, err := w.file.GetCellStyle(sheet, first)
			if err != nil {
				return err
			}
			old, err := w.file.GetStyle(oldID)
			if err != nil {
				return err
			}
			style.Fill = old.Fill
		}
		if err = w.file.MergeCell(sheet, first, last); err != nil {
			return err
		}
		if len(element.TextRuns) > 0 {
			runs := make([]excelize.RichTextRun, 0, len(element.TextRuns))
			for _, run := range element.TextRuns {
				font := *style.Font
				weight := run.FontWeight
				if weight == "" {
					weight = element.FontWeight
				}
				font.Bold, font.Italic = reportprint.TextEmphasis(weight)
				runs = append(runs, excelize.RichTextRun{Text: run.Text, Font: &font})
			}
			err = w.file.SetCellRichText(sheet, first, runs)
		} else {
			err = setXLSXText(w.file, sheet, first, value)
		}
		if err != nil {
			return err
		}
		id, err := w.file.NewStyle(style)
		if err != nil {
			return err
		}
		return w.file.SetCellStyle(sheet, first, last, id)
	case "tableCellDataBar":
		return w.printDataBar(sheet, element, offset)
	case "rect":
		style := &excelize.Style{}
		if color := excelChartColor(element.FillColor); color != "" {
			style.Fill = excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{color}}
		}
		id, err := w.file.NewStyle(style)
		if err != nil {
			return err
		}
		if err = w.file.SetCellStyle(sheet, first, last, id); err != nil {
			return err
		}
		if element.Kind == "rect" && excelChartColor(element.StrokeColor) != "" {
			if err = w.printBorder(sheet, first, last, style, excelChartColor(element.StrokeColor)); err != nil {
				return err
			}
		}
		if element.Kind == "rect" && element.Radius > 0 {
			return w.printRoundedBorder(sheet, element, offset)
		}
		return nil
	default:
		return fmt.Errorf("unsupported canonical print primitive %q", element.Kind)
	}
}

func (w *visualDashboardWriter) printBorder(sheet, first, last string, base *excelize.Style, color string) error {
	x1, y1, err := excelize.CellNameToCoordinates(first)
	if err != nil {
		return err
	}
	x2, y2, err := excelize.CellNameToCoordinates(last)
	if err != nil {
		return err
	}
	borders := map[string][]excelize.Border{}
	for _, edge := range []struct {
		side           string
		x1, y1, x2, y2 int
	}{{"top", x1, y1, x2, y1}, {"bottom", x1, y2, x2, y2}, {"left", x1, y1, x1, y2}, {"right", x2, y1, x2, y2}} {
		for y := edge.y1; y <= edge.y2; y++ {
			for x := edge.x1; x <= edge.x2; x++ {
				cell, _ := excelize.CoordinatesToCellName(x, y)
				borders[cell] = append(borders[cell], excelize.Border{Type: edge.side, Color: color, Style: 1})
			}
		}
	}
	cells := make([]string, 0, len(borders))
	for cell := range borders {
		cells = append(cells, cell)
	}
	sort.Strings(cells)
	for _, cell := range cells {
		style := *base
		style.Border = borders[cell]
		id, err := w.file.NewStyle(&style)
		if err != nil {
			return err
		}
		if err = w.file.SetCellStyle(sheet, cell, cell, id); err != nil {
			return err
		}
	}
	return nil
}
