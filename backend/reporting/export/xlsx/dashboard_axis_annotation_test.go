package xlsx

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reporthtml "github.com/viant/forge/backend/reporting/export/html"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// This mixed chart is independently invented from the public synthetic helper.
// Exercise the actual lowerer and complete workbook, including the canonical
// curved SVG and its editable bar/line companion with a secondary value axis.
func TestDashboardCanonicalSecondaryAxisAnnotation(t *testing.T) {
	artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
		chart := map[string]any{
			"id": "mixed", "kind": "chartBlock", "title": "Measurements and ratio", "datasetRef": "primary",
			"chartSpec": map[string]any{"type": "bar", "xField": "period", "yFields": []string{"value", "ratio"}},
			"chartModel": map[string]any{
				"type": "bar", "xAxis": map[string]any{"dataKey": "period", "label": "Period"},
				"yAxis": map[string]any{"label": "Measurement", "format": "number"},
				"series": map[string]any{"values": []any{
					map[string]any{"value": "value", "label": "Measurement", "type": "bar", "axis": "left", "format": "number"},
					map[string]any{"value": "ratio", "label": "Ratio", "type": "line", "axis": "right", "format": "percentFraction2"},
				}},
			},
		}
		spec["blocks"] = []any{chart}
		spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"mixed"}}
		inputs["primary"] = json.RawMessage(`{"rows":[{"period":"Period 01","value":12,"ratio":0.1},{"period":"Period 02","value":18,"ratio":0.3},{"period":"Period 03","value":15,"ratio":0.2},{"period":"Period 04","value":24,"ratio":0.4}]}`)
	})
	print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	canonicalSVG := ""
	for _, page := range print.Pages {
		for _, element := range page.Elements {
			if strings.Contains(element.SVG, `data-report-print-axis="right"`) {
				canonicalSVG = element.SVG
			}
		}
	}
	require.NotEmpty(t, canonicalSVG, "The native lowerer must supply the axis annotation")
	require.Equal(t, 4, strings.Count(canonicalSVG, `data-report-print-axis="right"`))
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	book, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer book.Close()
	require.Contains(t, book.GetSheetList(), "Dashboard")
	rows, err := book.GetRows("Chart Measurements and ratio")
	require.NoError(t, err)
	require.Len(t, rows, 8, "All four resolved rows remain editable")
	require.Equal(t, []string{"Period 04", "24", "40.00%"}, rows[7])
	ratio, err := book.GetCellValue("Chart Measurements and ratio", "C8", excelize.Options{RawCellValue: true})
	require.NoError(t, err)
	require.Equal(t, "0.4", ratio)
	entries := workbookZIP(t, data)
	chart := entries["xl/charts/chart1.xml"]
	require.Contains(t, chart, "<barChart>")
	require.Contains(t, chart, "<lineChart>")
	require.Contains(t, chart, `<axPos val="r">`)
	require.Contains(t, chart, "$B$5:$B$8")
	require.Contains(t, chart, "$C$5:$C$8")
	svgFound := false
	for name, content := range entries {
		if strings.HasSuffix(name, ".svg") && content == canonicalSVG {
			svgFound = true
		}
		require.False(t, strings.HasSuffix(name, ".png") || strings.HasSuffix(name, ".jpeg"), "Chart must retain vector/native output")
	}
	require.True(t, svgFound, "Workbook must preserve the annotated canonical SVG")
	require.Contains(t, entries["xl/drawings/drawing1.xml"], "Static print visual: mixed__svg_page_")
	_, err = reporthtml.Render(print)
	require.NoError(t, err)
	pdf, err := reportpdf.Render(print, reportpdf.Options{})
	require.NoError(t, err)
	require.Empty(t, pdf.Diagnostics)

	for _, annotation := range []string{
		`data-report-print-axis="left"`,
		`data-report-print-axis="url(https://example.invalid/x)"`,
		`data-report-print-other="right"`,
		`data-report-print-axis="right" onclick="alert(1)"`,
		`data-report-print-axis="right" href="https://example.invalid/x"`,
	} {
		t.Run(annotation, func(t *testing.T) {
			invalid, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			if err != nil {
				t.Fatal(err)
			}
			for i := range invalid.Pages {
				for j := range invalid.Pages[i].Elements {
					element := &invalid.Pages[i].Elements[j]
					element.SVG = strings.ReplaceAll(element.SVG, `data-report-print-axis="right"`, annotation)
				}
			}
			markup, err := json.Marshal(invalid)
			require.NoError(t, err)
			data, err := RenderDashboardWithPrint(artifacts.ReportFill, markup)
			require.ErrorContains(t, err, "unsupported embedded SVG attribute")
			require.Empty(t, data, "Unsafe input must not return a partial workbook")
		})
	}
}
