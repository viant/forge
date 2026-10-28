package xlsx

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

func TestNativeSingleRightAxisAndDefaultLabels(t *testing.T) {
	for _, kind := range []string{"horizontal_bar", "funnel_bar"} {
		report := visualExample(t)
		block := &report.Blocks[5]
		block.ChartContent.ResolvedChart.Type = kind
		for _, value := range chartValues(block.ChartContent.ChartModel) {
			entry := chartMap(value)
			entry["axis"] = "right"
			entry["type"] = kind
			delete(entry, "dataLabels")
		}
		charts, err := dashboardNativeCharts("Source", *block)
		require.NoError(t, err)
		require.Len(t, charts, 1)
		require.False(t, charts[0].YAxis.Secondary)
		_, data := openDashboard(t, report)
		if prefix := os.Getenv("FORGE_XLSX_PRINT_EXAMPLE"); prefix != "" {
			require.NoError(t, os.WriteFile(prefix+"-right-axis-"+kind+".xlsx", data, 0600))
		}
		xml := workbookZIP(t, data)["xl/charts/chart1.xml"]
		require.Contains(t, xml, `<showVal val="0">`)
	}
}

func TestNativeRightAxisNumberFormatAndSharedTitle(t *testing.T) {
	for _, mode := range []string{"single-right", "shared", "split-types", "split-labels"} {
		shared := mode != "single-right"
		report := visualExample(t)
		block := report.Blocks[5]
		values := chartValues(block.ChartContent.ChartModel)
		for i, value := range values {
			entry := chartMap(value)
			entry["format"] = "number"
			if shared || i == 1 {
				entry["axis"] = "right"
			}
			if i == 1 && mode == "split-types" {
				entry["type"] = "bar"
			}
			if i == 1 && mode == "split-labels" {
				entry["dataLabels"] = "always"
			}
		}
		charts, err := dashboardNativeCharts("Source", block)
		require.NoError(t, err)
		if mode == "shared" {
			require.Len(t, charts, 1)
		} else {
			require.Len(t, charts, 2)
		}
		for _, chart := range charts {
			if shared || chart.YAxis.Secondary {
				require.Equal(t, "General", chart.YAxis.NumFmt.CustomNumFmt)
				axis, err := json.Marshal(chart.YAxis)
				require.NoError(t, err)
				want := "Series B"
				if shared {
					want = "Measurement"
				}
				require.Contains(t, string(axis), `"Text":"`+want+`"`)
			}
		}
	}
}

func TestNativeNonRestrictingRowLimit(t *testing.T) {
	for _, limit := range []int{4, 10} {
		artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
			chart := map[string]any{"id": "bars", "kind": "chartBlock", "title": "All measurements", "datasetRef": "primary", "rowLimit": limit, "chartSpec": map[string]any{"type": "horizontal_bar", "xField": "period", "yFields": []string{"value"}}, "chartModel": map[string]any{"type": "horizontal_bar", "xAxis": map[string]any{"dataKey": "period"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "type": "horizontal_bar"}}}}}
			spec["blocks"] = []any{chart}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"bars"}}
		})
		data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
		require.NoError(t, err)
		entries := workbookZIP(t, data)
		require.Contains(t, entries["xl/drawings/drawing1.xml"], "<xdr:graphicFrame")
		for name := range entries {
			require.False(t, strings.HasSuffix(name, ".svg"), name)
		}
		require.Contains(t, entries["xl/charts/chart1.xml"], `<showVal val="0">`)
		require.Contains(t, entries["xl/charts/chart1.xml"], `<varyColors val="0">`)
		require.Contains(t, entries["xl/charts/chart1.xml"], `<orientation val="maxMin">`)
		if prefix := os.Getenv("FORGE_XLSX_PRINT_EXAMPLE"); prefix != "" && limit == 10 {
			require.NoError(t, os.WriteFile(prefix+"-unrestricted-bars.xlsx", data, 0600))
			print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			pdf, err := reportpdf.Render(print, reportpdf.Options{})
			require.NoError(t, err)
			require.NoError(t, os.WriteFile(prefix+"-unrestricted-bars.pdf", pdf.Bytes, 0600))
		}
	}
}

func TestPrintBorderCornersRetainBothSides(t *testing.T) {
	f := excelize.NewFile()
	defer f.Close()
	w := visualDashboardWriter{dashboardWriter: dashboardWriter{file: f}}
	require.NoError(t, w.printBorder("Sheet1", "B2", "D4", &excelize.Style{}, "123456"))
	for cell, want := range map[string][]string{"B2": {"top", "left"}, "D2": {"top", "right"}, "B4": {"bottom", "left"}, "D4": {"bottom", "right"}} {
		id, err := f.GetCellStyle("Sheet1", cell)
		require.NoError(t, err)
		style, err := f.GetStyle(id)
		require.NoError(t, err)
		got := []string{}
		for _, border := range style.Border {
			if border.Style != 0 {
				got = append(got, border.Type)
			}
		}
		require.ElementsMatch(t, want, got)
	}
	data, err := f.WriteToBuffer()
	require.NoError(t, err)
	opened, err := excelize.OpenReader(bytes.NewReader(data.Bytes()))
	require.NoError(t, err)
	require.NoError(t, opened.Close())
}

func TestCenteredDonutPrintPair(t *testing.T) {
	artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
		center := map[string]any{"label": "Total", "value": map[string]any{"field": "value", "operation": "sum"}, "format": "number"}
		for _, raw := range spec["blocks"].([]any) {
			block := raw.(map[string]any)
			if block["id"] != "trend" {
				continue
			}
			block["chartSpec"] = map[string]any{"type": "donut", "xField": "period", "yFields": []string{"value"}, "center": center}
			block["chartModel"] = map[string]any{"type": "donut", "center": center, "series": map[string]any{"nameKey": "period", "valueKey": "value", "palette": []string{"#137cbd", "#12b76a", "#f79009", "#7f56d9"}}}
		}
	})
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	entries := workbookZIP(t, data)
	centerInSVG := false
	for name, content := range entries {
		if strings.HasSuffix(name, ".svg") && strings.Contains(content, ">Total</text>") && strings.Contains(content, "69.625") {
			centerInSVG = true
		}
		if strings.HasPrefix(name, "xl/charts/") {
			require.NotContains(t, content, "dataset snapshot")
			require.NotContains(t, content, "Total measurement")
		}
	}
	require.True(t, centerInSVG)
	print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	pdf, err := reportpdf.Render(print, reportpdf.Options{})
	require.NoError(t, err)
	if prefix := os.Getenv("FORGE_XLSX_PRINT_EXAMPLE"); prefix != "" {
		require.NoError(t, os.WriteFile(prefix+"-donut.xlsx", data, 0600))
		require.NoError(t, os.WriteFile(prefix+"-donut.pdf", pdf.Bytes, 0600))
	}
}

func TestNativePrintInterpolationFidelity(t *testing.T) {
	report := visualExample(t)
	var block reportfill.Block
	for _, candidate := range report.Blocks {
		if candidate.ChartContent != nil && candidate.ChartContent.ResolvedChart.Type == "line" {
			block = candidate
			break
		}
	}
	require.NotNil(t, block.ChartContent)
	charts, err := dashboardNativeCharts("Source", block, 12)
	require.NoError(t, err)
	for _, chart := range charts {
		for _, series := range chart.Series {
			require.False(t, series.Line.Smooth)
		}
	}
	straight := `<svg><path fill="none" stroke="#123456" d="M0 0 L10 10 L20 0"/></svg>`
	curved := `<svg><path fill="none" stroke="#123456" d="M0 0 C3 0 7 10 10 10"/></svg>`
	require.Empty(t, nativePrintFidelityReason(block, straight))
	require.Contains(t, nativePrintFidelityReason(block, curved), "overshoot")
	block.ChartContent.ResolvedChart.Center = &reportfill.DonutCenter{}
	require.Contains(t, nativePrintFidelityReason(block, straight), "centered label")
}

func TestResolvedRoundedDataBars(t *testing.T) {
	for _, value := range []float64{-30, 30} {
		bar := reportprint.Element{Kind: "tableCellDataBar", Box: reportprint.Box{X: 40, Y: 20, Width: 90, Height: 12}, Value: value, Min: -100, Max: 100, Radius: 1, FillColor: "#123456", BackgroundColor: "#ffffff"}
		svg := dataBarSVG(bar)
		require.Contains(t, svg, `width="90" height="12" rx="6"`)
		require.Equal(t, 65, strings.Count(svg, "<rect"))
		require.Contains(t, svg, `fill="#123456"`)
		require.Contains(t, svg, `fill="#ffffff"`)
		bar.BackgroundColor = ""
		require.Contains(t, dataBarSVG(bar), `rx="6" fill="#123456"`)
	}
}
