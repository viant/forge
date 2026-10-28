package xlsx

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	"github.com/viant/forge/backend/reporting/materializer"
	reportprint "github.com/viant/forge/backend/reporting/print"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/xuri/excelize/v2"
)

// All source examples are public, independently invented framework fixtures.
// This exercises the exact same materialized print in both PDF and XLSX.
func printExample(t *testing.T, adjust ...func(map[string]any, map[string]json.RawMessage)) *materializer.Artifacts {
	t.Helper()
	read := func(name string) map[string]any {
		data, err := os.ReadFile(filepath.Join("../../../../doc/examples", name))
		require.NoError(t, err)
		var value map[string]any
		require.NoError(t, json.Unmarshal(data, &value))
		return value
	}
	heat, ranges, geo := read("categorical-heatmap.json"), read("category-range.json"), read("campus-zone-geometry.json")
	analytics := read("laboratory-table-analytics.json")
	heatSpec := heat["chartSpec"].(map[string]any)
	heatSpec["xField"] = "weekday"
	heatSpec["yFields"] = []string{"occupiedSeats"}
	rangeSpec := ranges["chartSpec"].(map[string]any)
	rangeSpec["xField"] = "room"
	rangeSpec["yFields"] = []string{"measuredCelsius", "targetMin", "targetMax", "targetCelsius"}
	geoBlock := geo["block"].(map[string]any)
	geoBlock["datasetRef"] = "geometry"
	series := map[string]any{"type": "line", "xAxis": map[string]any{"dataKey": "period", "label": "Period"}, "yAxis": map[string]any{"label": "Measurement", "format": "number"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "label": "Measurement", "type": "line", "color": "#137cbd"}}}}
	blocks := []any{
		map[string]any{"id": "tabs", "kind": "tabGroupBlock", "title": "Synthetic report", "sectionIds": []string{"overview", "visuals", "tables"}},
		map[string]any{"id": "overview", "kind": "sectionBlock", "title": "Overview", "navigationLabel": "Overview", "blockIds": []string{"metric", "comparisonMetric", "trend", "details", "notes"}},
		map[string]any{"id": "metric", "kind": "kpiBlock", "title": "Sample measurement", "datasetRef": "primary", "valueField": "value", "valueLabel": "Measurement", "valueFormat": "number", "description": "Independent synthetic measurements", "tone": "info"},
		map[string]any{"id": "trend", "kind": "chartBlock", "title": "Measurements over time", "datasetRef": "primary", "chartSpec": map[string]any{"type": "line", "xField": "period", "yFields": []string{"value"}}, "chartModel": series},
		map[string]any{"id": "details", "kind": "tableBlock", "title": "Measurement details", "datasetRef": "primary", "columns": []any{map[string]any{"key": "period", "label": "Period"}, map[string]any{"key": "value", "label": "Measurement", "format": "number"}}},
		map[string]any{"id": "notes", "kind": "markdownBlock", "title": "Method", "markdown": "**Synthetic example.** These values are invented for renderer verification.\n\nAll admitted data remains available in separate worksheets."},
		map[string]any{"id": "visuals", "kind": "sectionBlock", "title": "Spatial and category views", "navigationLabel": "Spatial and category views", "blockIds": []string{"heatmap", "ranges", "campus"}},
		map[string]any{"id": "heatmap", "kind": "chartBlock", "title": "Workspace occupancy", "datasetRef": "heat", "chartSpec": heatSpec, "chartModel": map[string]any{"type": "heatmap", "heatmap": heatSpec["heatmap"], "series": map[string]any{"valueKey": "occupiedSeats", "values": []any{map[string]any{"value": "occupiedSeats", "label": "Occupied seats", "type": "heatmap"}}}}},
		map[string]any{"id": "ranges", "kind": "chartBlock", "title": "Room measurements and targets", "datasetRef": "ranges", "chartSpec": rangeSpec, "chartModel": map[string]any{"type": "category-range", "categoryRange": rangeSpec["categoryRange"], "xAxis": map[string]any{"dataKey": "room"}, "series": map[string]any{"values": []any{map[string]any{"value": "measuredCelsius", "label": "Measured", "type": "bar"}}}}}, geoBlock,
	}
	blocks[2].(map[string]any)["sparkline"] = map[string]any{"datasetRef": "primary", "categoryField": "period", "valueField": "value", "comparisonDatasetRef": "comparison"}
	blocks = append(blocks[:3], append([]any{map[string]any{"id": "comparisonMetric", "kind": "kpiBlock", "title": "Comparison measurement", "datasetRef": "comparison", "valueField": "value", "valueLabel": "Measurement", "valueFormat": "number", "tone": "warning"}}, blocks[3:]...)...)
	blocks = append(blocks, map[string]any{"id": "tables", "kind": "sectionBlock", "title": "Analytical tables", "navigationLabel": "Analytical tables", "blockIds": []string{"inventory", "inspections"}}, analytics["hierarchy"], analytics["pivot"])
	rows := []any{map[string]any{"period": "Period 01", "value": 12.125}, map[string]any{"period": "Period 02", "value": 18.25}, map[string]any{"period": "Period 03", "value": 15.5}, map[string]any{"period": "Period 04", "value": 23.75}}
	payloads := map[string]any{"primary": rows, "heat": heat["rows"], "ranges": ranges["rows"], "geometry": geo["rows"]}
	payloads["comparison"] = []any{map[string]any{"period": "Period 01", "value": 10}, map[string]any{"period": "Period 02", "value": nil}, map[string]any{"period": "Period 03", "value": 20}, map[string]any{"period": "Period 04", "value": 21}}
	payloads["inventory"] = analytics["inventoryRows"]
	payloads["inspections"] = analytics["inspectionRows"]
	datasets := []any{}
	inputs := map[string]json.RawMessage{}
	for _, id := range []string{"primary", "comparison", "heat", "ranges", "geometry", "inventory", "inspections"} {
		datasets = append(datasets, map[string]any{"id": id, "dataSourceRef": "synthetic", "request": map[string]any{"limit": 100, "offset": 0}})
		data, err := json.Marshal(map[string]any{"rows": payloads[id]})
		require.NoError(t, err)
		inputs[id] = data
	}
	order := []string{}
	for _, block := range blocks {
		order = append(order, block.(map[string]any)["id"].(string))
	}
	spec := map[string]any{"version": 1, "kind": "reportSpec", "title": "Synthetic visual report", "source": map[string]any{"kind": "report", "containerId": "synthetic", "stateKey": "synthetic", "dataSourceRef": "synthetic"}, "parameters": map[string]any{"viewMode": "chart", "groupBy": "", "pageSize": 100, "orderField": "", "orderDir": "asc"}, "refinements": []any{}, "calculatedFields": []any{}, "scope": map[string]any{"params": []any{}, "dataSourceRef": "synthetic"}, "layoutIntent": map[string]any{"kind": "stack", "blockOrder": order}, "datasets": datasets, "blocks": blocks}
	spec["layoutIntent"].(map[string]any)["items"] = []any{map[string]any{"blockId": "metric", "span": 6}, map[string]any{"blockId": "comparisonMetric", "span": 6}}
	for _, apply := range adjust {
		apply(spec, inputs)
	}
	spec["layoutIntent"].(map[string]any)["resultPanePosition"] = "bottom"
	raw, err := json.Marshal(spec)
	require.NoError(t, err)
	_, err = reportspec.DecodeJSON(raw)
	require.NoError(t, err)
	artifacts, err := materializer.Materialize(context.Background(), raw, inputs)
	require.NoError(t, err)
	return artifacts
}

func TestDashboardCanonicalPrintPair(t *testing.T) {
	artifacts := printExample(t)
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	book, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer book.Close()
	require.Equal(t, []string{"Dashboard", "Overview", "Spatial and category views"}, book.GetSheetList()[:3])
	entries := workbookZIP(t, data)
	charts, svg := 0, 0
	for name, content := range entries {
		if strings.HasPrefix(name, "xl/charts/chart") && strings.HasSuffix(name, ".xml") {
			charts++
			require.True(t, strings.Contains(content, "Chart Measurements over time") || strings.Contains(content, "Chart Sample measurement trend"))
		}
		if strings.HasSuffix(name, ".svg") {
			svg++
			require.NotContains(t, content, "<script")
		}
	}
	require.Equal(t, 2, charts)
	// The overview's sparkline is native; the canonical monotone line is a
	// picture there, with its editable companion on a separate source sheet.
	require.Equal(t, 1, strings.Count(entries["xl/drawings/drawing1.xml"], "<xdr:graphicFrame"))
	require.Contains(t, entries["xl/drawings/drawing1.xml"], "Static print visual: trend__svg_page_")
	require.GreaterOrEqual(t, svg, 3)
	require.Contains(t, entries["xl/sharedStrings.xml"], "Sample measurement")
	require.Contains(t, entries["xl/sharedStrings.xml"], "Synthetic example.")
	require.Contains(t, entries["xl/sharedStrings.xml"], "Electrical")
	require.Contains(t, entries["xl/sharedStrings.xml"], "Room 101")
	require.Equal(t, "", mustCellValue(t, book, "Values", "F5"))
	require.Equal(t, "", mustCellValue(t, book, "Values", "H5"))
	require.Contains(t, entries["xl/worksheets/sheet3.xml"], "rowBreaks")
	require.Contains(t, entries["xl/worksheets/sheet2.xml"], `fitToPage="true"`)
	print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	pdf, err := reportpdf.Render(print, reportpdf.Options{CreationDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)})
	require.NoError(t, err)
	require.Empty(t, pdf.Diagnostics)
	if prefix := os.Getenv("FORGE_XLSX_PRINT_EXAMPLE"); prefix != "" {
		require.NoError(t, os.WriteFile(prefix+".xlsx", data, 0600))
		require.NoError(t, os.WriteFile(prefix+".pdf", pdf.Bytes, 0600))
		require.NoError(t, os.WriteFile(prefix+".print.json", artifacts.ReportPrint, 0600))
		require.NoError(t, os.WriteFile(prefix+".fill.json", artifacts.ReportFill, 0600))
	}
}

func TestDashboardPrintRejectsMismatchedFill(t *testing.T) {
	artifacts := printExample(t)
	fill := bytes.Replace(artifacts.ReportFill, []byte(`12.125`), []byte(`42.125`), 1)
	_, err := RenderDashboardWithPrint(fill, artifacts.ReportPrint)
	require.ErrorContains(t, err, "does not match")
}

func TestDashboardSVGRejectsActiveContent(t *testing.T) {
	w := visualDashboardWriter{}
	for _, svg := range []string{`<svg width="10" height="10"><script>alert(1)</script></svg>`, `<svg width="10" height="10"><image href="https://example.test/private"/></svg>`} {
		require.Error(t, w.printSVG("unused", reportprint.Element{SVG: svg}, 0))
	}
}

func paginatedPrintExample(t *testing.T, limit int) *materializer.Artifacts {
	return printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
		chart := map[string]any{"id": "bars", "kind": "chartBlock", "title": "Measurements by period", "datasetRef": "primary", "chartSpec": map[string]any{"type": "horizontal_bar", "xField": "period", "yFields": []string{"value"}}, "chartModel": map[string]any{"type": "horizontal_bar", "xAxis": map[string]any{"dataKey": "period", "label": "Period"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "label": "Measurement", "type": "horizontal_bar", "dataLabels": "auto"}}}}}
		if limit > 0 {
			chart["rowLimit"] = limit
		}
		spec["blocks"] = []any{chart}
		spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"bars"}}
		rows := make([]map[string]any, 50)
		for i := range rows {
			rows[i] = map[string]any{"period": fmt.Sprintf("Period %02d", i+1), "value": float64(i) + 0.25}
		}
		data, err := json.Marshal(map[string]any{"rows": rows})
		require.NoError(t, err)
		inputs["primary"] = data
	})
}

func TestDashboardNativeChartPaginationUsesCanonicalSlices(t *testing.T) {
	for _, limit := range []int{0, 5} {
		t.Run(fmt.Sprint(limit), func(t *testing.T) {
			artifacts := paginatedPrintExample(t, limit)
			print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			bindings := []*reportprint.ChartSource{}
			for _, page := range print.Pages {
				for _, element := range page.Elements {
					if element.ChartSource != nil {
						bindings = append(bindings, element.ChartSource)
					}
				}
			}
			if limit == 0 {
				require.Greater(t, len(bindings), 1)
			} else {
				require.Len(t, bindings, 1)
				require.Equal(t, 5, bindings[0].RowCount)
			}
			data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
			require.NoError(t, err)
			book, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer book.Close()
			sourceRows, err := book.GetRows("Chart Measurements by period")
			require.NoError(t, err)
			require.Len(t, sourceRows, 54)
			labels := map[string]bool{}
			for _, row := range sourceRows[4:] {
				labels[row[0]] = true
			}
			require.Len(t, labels, 50)
			require.True(t, labels["Period 50"])
			entries := workbookZIP(t, data)
			for i, binding := range bindings {
				chart := entries[fmt.Sprintf("xl/charts/chart%d.xml", i+1)]
				require.Contains(t, chart, fmt.Sprintf("$B$%d:$B$%d", binding.RowOffset+5, binding.RowOffset+binding.RowCount+4))
				require.Contains(t, chart, `<plotVisOnly val="1">`)
			}
			for name := range entries {
				require.False(t, strings.HasPrefix(name, "xl/media/") && strings.HasSuffix(name, ".svg"), "Native pagination must not flatten a supported chart")
			}
		})
	}
}

func TestDashboardPrintRejectsInvalidChartBinding(t *testing.T) {
	artifacts := paginatedPrintExample(t, 5)
	print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	for i := range print.Pages {
		for j := range print.Pages[i].Elements {
			if binding := print.Pages[i].Elements[j].ChartSource; binding != nil {
				binding.RowOffset = 500
			}
		}
	}
	raw, err := json.Marshal(print)
	require.NoError(t, err)
	_, err = RenderDashboardWithPrint(artifacts.ReportFill, raw)
	require.ErrorContains(t, err, "slice exceeds")
}

func TestDashboardCanonicalPrimitiveCoverage(t *testing.T) {
	artifacts := printExample(t)
	print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	picture := image.NewRGBA(image.Rect(0, 0, 2, 2))
	picture.Set(0, 0, color.RGBA{R: 19, G: 124, B: 189, A: 255})
	var encoded bytes.Buffer
	require.NoError(t, png.Encode(&encoded, picture))
	print.Pages = []reportprint.Page{{Number: 1, Elements: []reportprint.Element{
		{ID: "notes__badge", Kind: "tableCellBadge", Box: reportprint.Box{X: 36, Y: 36, Width: 100, Height: 24}, RowKey: "one", ColumnKey: "status", Label: "Ready", BackgroundColor: "#e9f6ed", TextColor: "#14532d", FontSize: 10},
		{ID: "notes__tone", Kind: "tableCellTone", Box: reportprint.Box{X: 36, Y: 70, Width: 100, Height: 24}, RowKey: "one", ColumnKey: "tone", Tone: "info", Label: "Stable", BackgroundColor: "#eef4ff", TextColor: "#137cbd", FontSize: 10},
		{ID: "notes__bar", Kind: "tableCellDataBar", Box: reportprint.Box{X: 36, Y: 104, Width: 100, Height: 18}, RowKey: "one", ColumnKey: "value", Value: 50, Min: 0, Max: 100, FillColor: "#137cbd", BackgroundColor: "#dbeafe"},
		{ID: "notes__bar_label", Kind: "tableCellText", Box: reportprint.Box{X: 36, Y: 104, Width: 100, Height: 18}, RowKey: "one", ColumnKey: "value", Text: "50", FontSize: 10, Align: "center", Color: "#101828"},
		{ID: "notes__negative_bar", Kind: "tableCellDataBar", Box: reportprint.Box{X: 36, Y: 140, Width: 60, Height: 18}, RowKey: "two", ColumnKey: "value", Value: -30, Min: -100, Max: 100, FillColor: "#dc6803"},
		{ID: "notes__negative_label", Kind: "tableCellText", Box: reportprint.Box{X: 36, Y: 140, Width: 100, Height: 18}, RowKey: "two", ColumnKey: "value", Text: "-30", FontSize: 10, Align: "center", Color: "#101828"},
		{ID: "notes__line", Kind: "line", Box: reportprint.Box{X: 160, Y: 36, Width: 40, Height: 40}, StrokeColor: "#137cbd", StrokeWidth: 1},
		{ID: "notes__square_border", Kind: "rect", Box: reportprint.Box{X: 160, Y: 104, Width: 100, Height: 54}, StrokeColor: "#137cbd", StrokeWidth: 1},
		{ID: "notes__image", Kind: "image", Box: reportprint.Box{X: 220, Y: 36, Width: 40, Height: 40}, Image: &reportprint.Image{MimeType: "image/png", Payload: base64.StdEncoding.EncodeToString(encoded.Bytes())}},
	}}}
	print.Bookmarks = []reportprint.Bookmark{}
	print.Pages[0].HeaderElements = []reportprint.Element{}
	print.Pages[0].FooterElements = []reportprint.Element{}
	raw, err := json.Marshal(print)
	require.NoError(t, err)
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, raw)
	require.NoError(t, err)
	entries := workbookZIP(t, data)
	media := ""
	for name, content := range entries {
		if strings.HasSuffix(name, ".svg") {
			media += content
		}
	}
	require.Contains(t, media, ">Ready</text>")
	require.Contains(t, media, ">Stable</text>")
	joined := ""
	for name, content := range entries {
		if strings.HasPrefix(name, "xl/drawings/") {
			joined += content
		}
	}
	require.Contains(t, joined, "straightConnector1")
	require.Contains(t, joined, ".png")
	require.Contains(t, media, `clip-path="url(#bar)"`)
	require.Contains(t, media, `rx="12"`)
	// Tiny PNG compatibility must preserve every source pixel and alpha, not
	// replace transparent pixels with an opaque background or rescale geometry.
	for name, content := range entries {
		if !strings.HasSuffix(name, ".png") {
			continue
		}
		decoded, err := png.Decode(strings.NewReader(content))
		require.NoError(t, err)
		require.Equal(t, image.Rect(0, 0, 16, 16), decoded.Bounds())
		for y := 0; y < 16; y++ {
			for x := 0; x < 16; x++ {
				want := color.NRGBAModel.Convert(picture.At(x/8, y/8))
				require.Equal(t, want, color.NRGBAModel.Convert(decoded.At(x, y)))
			}
		}
	}
	if prefix := os.Getenv("FORGE_XLSX_PRINT_EXAMPLE"); prefix != "" {
		pdf, err := reportpdf.Render(print, reportpdf.Options{})
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(prefix+"-bars.xlsx", data, 0600))
		require.NoError(t, os.WriteFile(prefix+"-bars.pdf", pdf.Bytes, 0600))
	}
}
