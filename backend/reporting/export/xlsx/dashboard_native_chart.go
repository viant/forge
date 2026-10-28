package xlsx

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strconv"
	"strings"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

var dashboardChartTypes = map[string]excelize.ChartType{
	"line": excelize.Line, "bar": excelize.Col, "column": excelize.Col,
	"area": excelize.Area, "pie": excelize.Pie, "donut": excelize.Doughnut, "doughnut": excelize.Doughnut,
	"scatter": excelize.Scatter, "horizontal_bar": excelize.Bar, "stacked_bar": excelize.ColStacked, "stacked_area": excelize.AreaStacked,
	"funnel_bar": excelize.Bar,
}

type nativeChartDecoration struct {
	PointColors []string
	Mini        bool
}

func chartMap(value any) map[string]any { result, _ := value.(map[string]any); return result }
func chartString(value any) string      { result, _ := value.(string); return strings.TrimSpace(result) }
func sortedKeys(values map[string]bool) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
func chartValues(model map[string]any) []any {
	values, _ := chartMap(model["series"])["values"].([]any)
	return values
}
func chartSeriesModel(model map[string]any, key string) map[string]any {
	for _, value := range chartValues(model) {
		entry := chartMap(value)
		if chartString(entry["value"]) == key {
			return entry
		}
	}
	return nil
}

// Unsupported semantics are surfaced beside the preserved source, rather than
// rendered as a misleading native approximation (for example a dual-axis line
// silently placed on one axis).
func nativeChartDiagnostic(content *reportfill.ChartContent) string {
	resolved := content.ResolvedChart
	if _, ok := dashboardChartTypes[strings.ToLower(resolved.Type)]; !ok {
		return "Native Excel visual unavailable for chart type " + resolved.Type + ". Resolved values are preserved in the linked source worksheet."
	}
	if len(resolved.Rows) == 0 {
		return "No chart rows to plot. The linked worksheet retains the exported chart context."
	}
	if (resolved.Type == "pie" || resolved.Type == "donut" || resolved.Type == "doughnut") && resolved.Kind != "category" {
		return "Native Excel category charts require a single category/value series. The canonical print visual and all resolved values are retained."
	}
	if annotations, ok := content.ChartModel["annotations"].([]any); ok && len(annotations) > 0 {
		return "The authored annotations are retained in the static print visual. Source filters explore data but do not update that visual."
	}
	for _, value := range chartValues(content.ChartModel) {
		series := chartMap(value)
		if chartString(series["pointColorMode"]) != "" || chartString(series["strokeDasharray"]) != "" {
			return "The authored point styling is retained in the static print visual. Source filters explore data but do not update that visual."
		}
		if kind := chartString(series["type"]); kind != "" {
			if _, ok := dashboardChartTypes[kind]; !ok {
				return "Native Excel visual unavailable for series type " + kind + ". The canonical print visual retains its appearance."
			}
		}
	}
	return ""
}

func (w *visualDashboardWriter) chartSource(block reportfill.Block) (string, string, error) {
	content := block.ChartContent
	diagnostic := nativeChartDiagnostic(content)
	columns, rows, err := chartTable(content.ResolvedChart)
	if err != nil {
		return "", "", err
	}
	if _, supported := dashboardChartTypes[strings.ToLower(content.ResolvedChart.Type)]; !supported {
		// Preserve every resolved field for unsupported multidimensional shapes.
		keys := map[string]bool{}
		for _, record := range content.ResolvedChart.Rows {
			for key := range record {
				keys[key] = true
			}
		}
		ordered := sortedKeys(keys)
		columns, rows = mapTable(ordered, content.ResolvedChart.Rows)
	}
	for i := range columns {
		entry := chartSeriesModel(content.ChartModel, columns[i].Key)
		if i == 0 {
			columns[i].Label = firstText(chartString(chartMap(content.ChartModel["xAxis"])["label"]), columns[i].Key)
		} else {
			columns[i].Label = firstText(chartString(entry["label"]), columns[i].Label)
			columns[i].Format = firstText(chartString(entry["format"]), chartString(chartMap(content.ChartModel["yAxis"])["format"]))
		}
	}
	sheet := w.sheetName("Chart " + firstText(block.Title, block.ID))
	if _, err = w.file.NewSheet(sheet); err != nil {
		return "", "", err
	}
	if err = w.heading(sheet, 1, firstText(block.Title, block.ID), w.titleStyle); err != nil {
		return "", "", err
	}
	if err = w.note(sheet, 2, "Filter the headers to change this chart's plotted rows. Edit existing values to update the chart. Adding rows requires extending the chart ranges. Other charts are independent."); err != nil {
		return "", "", err
	}
	if err = w.filteredTable(sheet, 4, columns, rows); err != nil {
		return "", "", err
	}
	if diagnostic == "" {
		numericValues := 0
		for i, values := range rows {
			for j, value := range values {
				if value == nil || (j == 0 && resolvedType(content) != "scatter") {
					continue
				}
				cell, _ := excelize.CoordinatesToCellName(j+1, i+5)
				kind, err := w.file.GetCellType(sheet, cell)
				if err != nil {
					return "", "", err
				}
				if kind == excelize.CellTypeSharedString || kind == excelize.CellTypeInlineString || kind == excelize.CellTypeBool {
					diagnostic = "Native Excel visual unavailable: plotted values must be numeric. Original typed values are preserved in the linked source worksheet."
				}
				if j > 0 {
					numericValues++
				}
			}
		}
		if numericValues == 0 {
			diagnostic = "No numeric chart values to plot. Missing observations are retained as blanks in the source worksheet."
		}
	}
	lastRow := len(rows) + 4
	if center := content.ResolvedChart.Center; center != nil {
		lastRow += 3
		var value any
		if center.Value != nil {
			value = *center.Value
		}
		if err = w.table(sheet, lastRow, []reportfill.TableColumn{{Key: "center", Label: center.Label + " (dataset snapshot)"}}, [][]any{{value}}); err != nil {
			return "", "", err
		}
		lastRow++
	}
	if err = w.finishSheet(sheet, lastRow, len(columns), false); err != nil {
		return "", "", err
	}
	if diagnostic != "" {
		if err = w.note(sheet, 2, "Filters on this sheet explore resolved values; they do not redraw a static print visual. "+diagnostic); err != nil {
			return "", "", err
		}
	}
	return sheet, diagnostic, nil
}

func resolvedType(content *reportfill.ChartContent) string {
	return strings.ToLower(content.ResolvedChart.Type)
}

func (w *visualDashboardWriter) nativeChart(visual, source string, row int, block reportfill.Block) error {
	charts, err := dashboardNativeCharts(source, block)
	if err != nil {
		return err
	}
	if err = w.file.AddChart(visual, fmt.Sprintf("A%d", row), charts[0], charts[1:]...); err != nil {
		return err
	}
	w.chartDecorations = append(w.chartDecorations, nativeChartDecoration{PointColors: nativePointColors(block)})
	return nil
}

func nativePointColors(block reportfill.Block) []string {
	resolved := block.ChartContent.ResolvedChart
	categoryColors := chartMap(chartMap(block.ChartContent.ChartModel["series"])["categoryColors"])
	if resolved.Kind != "category" && ((resolved.Type != "horizontal_bar" && resolved.Type != "funnel_bar") || len(categoryColors) == 0) {
		return nil
	}
	_, rows, err := chartTable(resolved)
	if err != nil {
		return nil
	}
	palette := []string{"137CBD", "0F9960", "D9822B", "8F398F", "C23030", "5C7080", "2965CC", "29A634"}
	if values, ok := chartMap(block.ChartContent.ChartModel["series"])["palette"].([]any); ok && len(values) > 0 {
		palette = nil
		for _, value := range values {
			if color := excelChartColor(chartString(value)); color != "" {
				palette = append(palette, color)
			}
		}
		if len(palette) == 0 {
			palette = []string{"137CBD"}
		}
	}
	keys := make([]string, 0, len(categoryColors))
	for key := range categoryColors {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]string, len(rows))
	for i, row := range rows {
		color := palette[i%len(palette)]
		for _, key := range keys {
			if strings.EqualFold(strings.TrimSpace(key), strings.TrimSpace(fmt.Sprint(row[0]))) {
				if authored := excelChartColor(chartString(categoryColors[key])); authored != "" {
					color = authored
				}
				break
			}
		}
		result[i] = color
	}
	return result
}

// Excel combination charts preserve authored series types, labels and axes.
// Split groups by label policy as well, since Excel applies labels per group.
func dashboardNativeCharts(source string, block reportfill.Block, visibleRows ...int) ([]*excelize.Chart, error) {
	base, err := dashboardNativeChart(source, block)
	if err != nil {
		return nil, err
	}
	resolved := block.ChartContent.ResolvedChart
	rowCount := len(resolved.Rows)
	if len(visibleRows) > 0 {
		rowCount = visibleRows[0]
	}
	if resolved.Kind == "category" {
		base.PlotArea.ShowPercent = true
		return []*excelize.Chart{base}, nil
	}
	groups := []*excelize.Chart{}
	indexes := map[string]int{}
	for i, series := range base.Series {
		entry := chartSeriesModel(block.ChartContent.ChartModel, resolved.SeriesKeys[i])
		kind := firstText(chartString(entry["type"]), resolved.Type)
		right := chartString(entry["axis"]) == "right"
		labels := nativeDataLabels(chartString(entry["dataLabels"]), kind, rowCount)
		identity := fmt.Sprintf("%s/%t/%t", kind, right, labels)
		index, ok := indexes[identity]
		if !ok {
			index = len(groups)
			indexes[identity] = index
			chart := *base
			chart.Type = dashboardChartTypes[kind]
			chart.Series = nil
			chart.YAxis.Secondary = right
			chart.PlotArea.ShowVal = labels
			if right {
				chart.YAxis.NumFmt.CustomNumFmt = xlsxNumberFormat(chartString(entry["format"]))
				if chartString(entry["format"]) == "number" {
					chart.YAxis.NumFmt.CustomNumFmt = "General"
				}
				if err = applyNativeAxisTitle(&chart.YAxis, chartString(entry["label"])); err != nil {
					return nil, err
				}
			}
			groups = append(groups, &chart)
		}
		groups[index].Series = append(groups[index].Series, series)
	}
	// Excel requires a primary group before a secondary group.
	primary := false
	rightSeries := 0
	for _, chart := range groups {
		if chart.YAxis.Secondary {
			rightSeries += len(chart.Series)
		}
	}
	for _, chart := range groups {
		if chart.YAxis.Secondary && rightSeries > 1 {
			if label := chartString(chartMap(block.ChartContent.ChartModel["yAxis"])["label"]); label != "" {
				if err := applyNativeAxisTitle(&chart.YAxis, label); err != nil {
					return nil, err
				}
			}
		}
		primary = primary || !chart.YAxis.Secondary
	}
	if !primary {
		// With no left-axis series there is only one value axis. Keep its
		// authored format/title, but give Excel a valid primary axis group.
		for _, chart := range groups {
			chart.YAxis.Secondary = false
		}
	}
	sort.SliceStable(groups, func(i, j int) bool { return !groups[i].YAxis.Secondary && groups[j].YAxis.Secondary })
	return groups, nil
}

func sliceNativeCharts(charts []*excelize.Chart, offset, count int) error {
	for _, chart := range charts {
		for i := range chart.Series {
			for _, target := range []*string{&chart.Series[i].Categories, &chart.Series[i].Values} {
				formula := *target
				split := strings.LastIndex(formula, "!")
				if split < 0 {
					return fmt.Errorf("invalid generated chart source range")
				}
				cells := strings.Split(formula[split+1:], ":")
				if len(cells) != 2 {
					return fmt.Errorf("invalid generated chart source range")
				}
				column, _, err := excelize.CellNameToCoordinates(strings.ReplaceAll(cells[0], "$", ""))
				if err != nil {
					return err
				}
				name, _ := excelize.ColumnNumberToName(column)
				*target = fmt.Sprintf("%s$%s$%d:$%s$%d", formula[:split+1], name, offset+5, name, offset+count+4)
			}
		}
	}
	return nil
}

func nativeDataLabels(mode, kind string, rows int) bool {
	switch mode {
	case "none":
		return false
	case "always":
		return true
	case "auto":
		switch kind {
		case "horizontal_bar", "funnel_bar":
			return rows <= 12
		case "bar", "column":
			return rows <= 10
		case "line", "area":
			return rows <= 8
		}
		return false
	}
	return false
}

func dashboardNativeChart(source string, block reportfill.Block) (*excelize.Chart, error) {
	resolved := block.ChartContent.ResolvedChart
	columns, rows, err := chartTable(resolved)
	if err != nil {
		return nil, err
	}
	if len(columns) < 2 {
		return nil, fmt.Errorf("xlsx chart %q has no value series", block.ID)
	}
	model := block.ChartContent.ChartModel
	chart := &excelize.Chart{Type: dashboardChartTypes[strings.ToLower(resolved.Type)], Dimension: excelize.ChartDimension{Width: 720, Height: 390}, Legend: excelize.ChartLegend{Position: "bottom", Font: &excelize.Font{Size: 11}}, ShowBlanksAs: "gap", HoleSize: 60}
	vary := resolved.Kind == "category"
	chart.VaryColors = &vary
	if resolved.Type == "horizontal_bar" || resolved.Type == "funnel_bar" {
		chart.XAxis.ReverseOrder = true
		chart.YAxis.TickLabelPosition = excelize.ChartTickLabelHigh
	}
	chart.YAxis.MajorGridLines = true
	chart.YAxis.NumFmt.CustomNumFmt = xlsxNumberFormat(chartString(chartMap(model["yAxis"])["format"]))
	if chartString(chartMap(model["yAxis"])["format"]) == "number" {
		chart.YAxis.NumFmt.CustomNumFmt = "General"
	}
	if err = applyNativeAxisTitle(&chart.XAxis, chartString(chartMap(model["xAxis"])["label"])); err != nil {
		return nil, err
	}
	if err = applyNativeAxisTitle(&chart.YAxis, chartString(chartMap(model["yAxis"])["label"])); err != nil {
		return nil, err
	}
	chart.XAxis.Font = excelize.Font{Size: 10, Color: "526574"}
	chart.YAxis.Font = chart.XAxis.Font
	palette := []string{"137CBD", "0F9960", "D9822B", "8F398F", "C23030", "5C7080", "2965CC", "29A634"}
	if values, ok := chartMap(model["series"])["palette"].([]any); ok && len(values) > 0 {
		for i, value := range values {
			if color := excelChartColor(chartString(value)); color != "" {
				if i < len(palette) {
					palette[i] = color
				} else {
					palette = append(palette, color)
				}
			}
		}
	}
	quoted := sheetReference(source)
	for i := 1; i < len(columns); i++ {
		column, _ := excelize.ColumnNumberToName(i + 1)
		color := palette[(i-1)%len(palette)]
		entry := chartSeriesModel(model, columns[i].Key)
		if authored := excelChartColor(chartString(entry["color"])); authored != "" {
			color = authored
		}
		series := excelize.ChartSeries{Name: fmt.Sprintf("%s$%s$4", quoted, column), Categories: fmt.Sprintf("%s$A$5:$A$%d", quoted, len(rows)+4), Values: fmt.Sprintf("%s$%s$5:$%s$%d", quoted, column, column, len(rows)+4), Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{color}}}
		series.Marker = excelize.ChartMarker{Symbol: "circle", Size: 4, Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{color}}}
		series.Marker.Border.Fill = series.Fill
		series.Marker.Border.Width = 0.5
		series.Marker.Border.Type = 1 // explicit solid line uses authored marker color
		series.Line.Width = 2
		series.Line.Fill = series.Fill
		chart.Series = append(chart.Series, series)
		if chart.Type == excelize.Pie || chart.Type == excelize.Doughnut {
			break
		}
	}
	return chart, nil
}

// Excelize changed axis titles from rich-text slices in 2.10 to a title
// structure in 2.11. Decode only this exported field so hosts on either version
// keep authored labels without reflection or changing the dependency version.
func applyNativeAxisTitle(axis *excelize.ChartAxis, label string) error {
	return applyNativeTitle(axis, label)
}

func applyNativeTitle(target any, label string) error {
	if label == "" {
		return nil
	}
	runs := []excelize.RichTextRun{{Text: label}}
	data, err := json.Marshal(map[string]any{"Title": runs})
	if err != nil {
		return err
	}
	if err = json.Unmarshal(data, target); err == nil {
		return nil
	}
	data, err = json.Marshal(map[string]any{"Title": map[string]any{"Paragraph": runs}})
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

func excelChartColor(value string) string {
	// ReportPrint accepts CSS token fallbacks. Excel requires an RGB hex value.
	if strings.HasPrefix(value, "var(") {
		if index := strings.LastIndex(value, ","); index >= 0 {
			value = strings.TrimSuffix(strings.TrimSpace(value[index+1:]), ")")
		}
	}
	value = strings.TrimPrefix(strings.TrimSpace(value), "#")
	if len(value) == 3 {
		value = string([]byte{value[0], value[0], value[1], value[1], value[2], value[2]})
	}
	if len(value) != 6 {
		return ""
	}
	for _, r := range value {
		if !strings.ContainsRune("0123456789abcdefABCDEF", r) {
			return ""
		}
	}
	return strings.ToUpper(value)
}

// Excelize 2.10/2.11 always emit plotVisOnly=false without a public option.
// Change only that known generated element. Fail closed if its representation
// changes, so a future dependency update cannot silently break filter behavior.
func visibleChartRows(data []byte, decorations ...nativeChartDecoration) ([]byte, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, err
	}
	var output bytes.Buffer
	writer := zip.NewWriter(&output)
	for _, entry := range reader.File {
		if !strings.HasPrefix(entry.Name, "xl/charts/chart") || !strings.HasSuffix(entry.Name, ".xml") {
			if err = writer.Copy(entry); err != nil {
				return nil, err
			}
			continue
		}
		stream, err := entry.Open()
		if err != nil {
			return nil, err
		}
		content, readErr := io.ReadAll(stream)
		closeErr := stream.Close()
		if readErr != nil {
			return nil, readErr
		}
		if closeErr != nil {
			return nil, closeErr
		}
		old := []byte(`<plotVisOnly val="0"></plotVisOnly>`)
		if bytes.Count(content, old) != 1 {
			return nil, fmt.Errorf("xlsx chart %s has an unexpected visibility element", entry.Name)
		}
		content = bytes.Replace(content, old, []byte(`<plotVisOnly val="1"></plotVisOnly>`), 1)
		number, err := strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(entry.Name, "xl/charts/chart"), ".xml"))
		if err != nil {
			return nil, err
		}
		if number > 0 && number <= len(decorations) && len(decorations[number-1].PointColors) > 0 {
			content, err = applyPointColors(content, decorations[number-1].PointColors)
			if err != nil {
				return nil, err
			}
		}
		if number > 0 && number <= len(decorations) && decorations[number-1].Mini {
			layout := `<plotArea><layout><manualLayout><layoutTarget val="inner"></layoutTarget><xMode val="factor"></xMode><yMode val="factor"></yMode><wMode val="factor"></wMode><hMode val="factor"></hMode><x val="0.02"></x><y val="0.05"></y><w val="0.96"></w><h val="0.9"></h></manualLayout></layout>`
			if bytes.Count(content, []byte("<plotArea>")) != 1 {
				return nil, fmt.Errorf("xlsx miniature chart has unexpected plot layout")
			}
			content = bytes.Replace(content, []byte("<plotArea>"), []byte(layout), 1)
		}
		header := entry.FileHeader
		part, err := writer.CreateHeader(&header)
		if err != nil {
			return nil, err
		}
		if _, err = part.Write(content); err != nil {
			return nil, err
		}
	}
	if err = writer.Close(); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

var nativeSeriesXML = regexp.MustCompile(`(?s)<ser>.*?</ser>`)
var nativePointXML = regexp.MustCompile(`(?s)<dPt>.*?</dPt>`)

func applyPointColors(content []byte, colors []string) ([]byte, error) {
	var points strings.Builder
	for i, color := range colors {
		fmt.Fprintf(&points, `<dPt><idx val="%d"></idx><spPr><a:solidFill><a:srgbClr val="%s"></a:srgbClr></a:solidFill></spPr></dPt>`, i, color)
	}
	failed := false
	result := nativeSeriesXML.ReplaceAllFunc(content, func(series []byte) []byte {
		// Pie charts have a generated theme-colored point at index zero. Replace
		// all generated point styles with the complete authored palette.
		series = nativePointXML.ReplaceAll(series, nil)
		anchor := []byte("<dLbls>")
		if !bytes.Contains(series, anchor) {
			anchor = []byte("<cat>")
		}
		if !bytes.Contains(series, anchor) {
			failed = true
			return series
		}
		return bytes.Replace(series, anchor, append([]byte(points.String()), anchor...), 1)
	})
	if failed || bytes.Equal(content, result) {
		return nil, fmt.Errorf("xlsx native category chart has an unexpected series structure")
	}
	return result, nil
}
