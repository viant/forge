package xlsx

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// Independently invented inventory changes at the same locations test
// three stored periods through the native materializer and both export routes.
func TestSignedInventoryChartsAcrossAuthoredTabs(t *testing.T) {
	artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
		blocks := []any{map[string]any{"id": "periods", "kind": "tabGroupBlock", "sectionIds": []string{"day", "week", "month"}}}
		for _, period := range []string{"day", "week", "month"} {
			blocks = append(blocks,
				map[string]any{"id": period, "kind": "sectionBlock", "title": period, "navigationLabel": period, "blockIds": []string{period + "Inventory"}},
				map[string]any{"id": period + "Inventory", "kind": "chartBlock", "title": period + " inventory change", "datasetRef": "primary",
					"chartSpec": map[string]any{"type": "horizontal_bar", "xField": "location", "yFields": []string{period}},
					"chartModel": map[string]any{"type": "horizontal_bar", "preserveCategoryOrder": true, "xAxis": map[string]any{"dataKey": "location", "label": "Location"}, "yAxis": map[string]any{"format": "number"},
						"series": map[string]any{"categoryColors": map[string]any{"east": "#445566"}, "values": []any{map[string]any{"value": period, "type": "horizontal_bar", "dataLabels": "always", "pointColorMode": "bySign"}}}}})
		}
		spec["blocks"] = blocks
		spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"periods"}}
		inputs["primary"] = json.RawMessage(`{"rows":[{"location":"North","day":12,"week":-3,"month":0},{"location":"East","day":-4,"week":0,"month":6},{"location":"West","day":0,"week":8,"month":-2},{"location":"South","day":null,"week":null,"month":null}]}`)
	})
	fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	var svg string
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			svg += element.SVG
		}
	}
	require.Contains(t, strings.ToLower(svg), "#0f9960")
	require.Contains(t, strings.ToLower(svg), "#db3737")
	require.Contains(t, strings.ToLower(svg), "#445566")
	for _, printRoute := range []bool{false, true} {
		t.Run(fmt.Sprint(printRoute), func(t *testing.T) {
			var data []byte
			if printRoute {
				data, err = RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
			} else {
				data, err = RenderDashboard(fill)
			}
			require.NoError(t, err)
			book, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer book.Close()
			entries := workbookZIP(t, data)
			for index, period := range []string{"day", "week", "month"} {
				source := "Chart " + period + " inventory change"
				chart := entries[fmt.Sprintf("xl/charts/chart%d.xml", index+1)]
				require.Contains(t, chart, "&#39;"+source+"&#39;!$B$5:$B$8")
				require.Contains(t, chart, "&#39;"+source+"&#39;!$A$5:$A$8")
				require.Contains(t, chart, `<orientation val="maxMin">`)
				require.Contains(t, chart, `<showVal val="1">`)
				require.Contains(t, chart, `<plotVisOnly val="1">`)
				require.Contains(t, chart, `<dispBlanksAs val="gap">`)
				require.Contains(t, chart, `<c14:invertSolidFillFmt`)
				require.Contains(t, chart, `<a:srgbClr val="DB3737">`)
				require.NotContains(t, chart, `<invertIfNegative`)
				points := nativePointXML.FindAllString(chart, -1)
				require.Len(t, points, 1, "only explicit category overrides freeze a point color")
				require.Contains(t, points[0], `<idx val="1">`)
				require.Contains(t, points[0], `<a:srgbClr val="445566">`)
				require.Equal(t, "North", mustCellValue(t, book, source, "A5"))
				require.Equal(t, "West", mustCellValue(t, book, source, "A7"))
				require.Empty(t, mustCellValue(t, book, source, "B8"), "null remains blank")
				zeroRow := map[string]string{"day": "B7", "week": "B6", "month": "B5"}[period]
				require.Equal(t, "0", mustCellValue(t, book, source, zeroRow))
				kind, err := book.GetCellType(source, zeroRow)
				require.NoError(t, err)
				require.Contains(t, []excelize.CellType{excelize.CellTypeNumber, excelize.CellTypeUnset}, kind)
				sheetIndex, err := book.GetSheetIndex(period)
				require.NoError(t, err)
				require.Greater(t, sheetIndex, 0)
				require.Contains(t, entries[fmt.Sprintf("xl/worksheets/sheet%d.xml", sheetIndex+1)], "<drawing ")
			}
			chartCount := 0
			for name := range entries {
				if strings.HasPrefix(name, "xl/charts/chart") && strings.HasSuffix(name, ".xml") {
					chartCount++
				}
				require.False(t, strings.HasPrefix(name, "xl/media/") && strings.HasSuffix(name, ".svg"))
			}
			require.Equal(t, 3, chartCount)
			// Excelize roundtrip keeps native objects and signed fills, including
			// after a source edit crossing zero; no native-runtime claim is made.
			require.NoError(t, book.SetCellValue("Chart day inventory change", "B5", -12))
			buffer, err := book.WriteToBuffer()
			require.NoError(t, err)
			roundtrip, err := excelize.OpenReader(bytes.NewReader(buffer.Bytes()))
			require.NoError(t, err)
			defer roundtrip.Close()
			require.Equal(t, "-12", mustCellValue(t, roundtrip, "Chart day inventory change", "B5"))
			require.Contains(t, workbookZIP(t, buffer.Bytes())["xl/charts/chart1.xml"], `<c14:invertSolidFillFmt`)
		})
	}
}

func TestSignedSeriesAreTargetedByBindingAfterComboGroupingAndSlicing(t *testing.T) {
	block := reportfill.Block{ChartContent: &reportfill.ChartContent{
		ResolvedChart: &reportfill.ResolvedChart{Kind: "directSeries", Type: "bar", XAxisKey: "location", SeriesKeys: []string{"line", "delta", "other"}, Rows: []map[string]any{{"location": "North", "line": 10, "delta": 1, "other": -1}, {"location": "East", "line": 12, "delta": -2, "other": 2}}},
		ChartModel:    map[string]any{"type": "bar", "series": map[string]any{"categoryColors": map[string]any{"East": "#abcdef"}, "values": []any{map[string]any{"value": "line", "type": "line", "axis": "right"}, map[string]any{"value": "delta", "type": "bar", "pointColorMode": "bySign"}, map[string]any{"value": "other", "type": "bar", "pointColorMode": "bySign"}}}},
	}}
	require.Empty(t, nativeChartDiagnostic(block.ChartContent))
	book := excelize.NewFile()
	defer book.Close()
	_, err := book.NewSheet("Chart source")
	require.NoError(t, err)
	for i, row := range [][]any{{"Location", "Line", "Delta", "Other"}, {"North", 10, 1, -1}, {"East", 12, -2, 2}} {
		require.NoError(t, book.SetSheetRow("Chart source", fmt.Sprintf("A%d", i+4), &row))
	}
	charts, err := dashboardNativeCharts("Chart source", block)
	require.NoError(t, err)
	require.Len(t, charts, 2)
	require.NoError(t, sliceNativeCharts(charts, 1, 1))
	require.NoError(t, book.AddChart("Sheet1", "A1", charts[0], charts[1:]...))
	buffer, err := book.WriteToBuffer()
	require.NoError(t, err)
	data, err := visibleChartRows(buffer.Bytes(), book, nativeChartDecoration{SignedSeries: nativeSignedSeries("Chart source", block, 1, 1)})
	require.NoError(t, err)
	series := nativeSeriesXML.FindAllString(workbookZIP(t, data)["xl/charts/chart1.xml"], -1)
	require.Len(t, series, 3)
	for i, value := range series {
		require.NoError(t, xml.Unmarshal([]byte(value), new(anyXML)))
		if i == 2 {
			require.NotContains(t, value, "invertSolidFillFmt", "line series remains untouched")
			continue
		}
		require.Contains(t, value, "invertSolidFillFmt")
		require.Contains(t, value, `<idx val="0">`, "override indexes follow the print slice")
		require.Contains(t, value, `<a:srgbClr val="ABCDEF">`)
		require.Contains(t, value, "$6:")
	}
	for _, kind := range []string{"line", "area", "scatter"} {
		block.ChartContent.ChartModel["series"] = map[string]any{"values": []any{map[string]any{"value": "delta", "type": kind, "pointColorMode": "bySign"}}}
		require.NotEmpty(t, nativeChartDiagnostic(block.ChartContent))
	}
}

type anyXML struct {
	XMLName xml.Name
}
