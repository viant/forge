package materializer

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	"github.com/stretchr/testify/require"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func TestGeoObservedLegendAndDistinctSummary(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/sensor-distinct-device-geometry.json")
	require.NoError(t, err)
	var example struct {
		Block             map[string]any
		Rows              []map[string]any
		DeviceMemberships map[string][]string
	}
	require.NoError(t, json.Unmarshal(raw, &example))
	devices := map[string]bool{}
	for _, members := range example.DeviceMemberships {
		for _, device := range members {
			devices[device] = true
		}
	}
	require.Len(t, devices, 6)
	raw, err = os.ReadFile("testdata/presentation-report.json")
	require.NoError(t, err)
	var spec map[string]any
	require.NoError(t, json.Unmarshal(raw, &spec))
	spec["blocks"] = []any{example.Block}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"sensors"}}
	geoConfig := example.Block["geo"].(map[string]any)
	color := geoConfig["color"].(map[string]any)
	rules := color["rules"].([]any)
	for i := len(rules); i < 421; i++ {
		rules = append(rules, map[string]any{"value": i, "label": "Unobserved category", "color": "#778899"})
	}
	color["rules"] = rules
	materialize := func() *Artifacts {
		source, e := json.Marshal(spec)
		require.NoError(t, e)
		rows, e := json.Marshal(map[string]any{"rows": example.Rows})
		require.NoError(t, e)
		artifacts, e := Materialize(context.Background(), source, map[string]json.RawMessage{"primary": rows})
		require.NoError(t, e)
		return artifacts
	}
	artifacts := materialize()
	fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	geo := fill.Blocks[0].GeoContent.ResolvedGeo
	require.Nil(t, geo.Summary)
	require.Len(t, geo.Legend.Rules, 2)
	require.Len(t, geo.Regions, 3)
	require.Equal(t, float64(4), geo.Regions[1].RawValue)
	require.Equal(t, float64(4), geo.Regions[2].RawValue)
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	canonical := ""
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			if strings.Contains(element.SVG, "<circle ") {
				canonical = element.SVG
			}
		}
	}
	require.Equal(t, 2, strings.Count(canonical, "<circle "))
	require.NotContains(t, string(artifacts.ReportPrint), "Unobserved category")
	require.NotContains(t, string(artifacts.ReportPrint), "Total Distinct devices")
	rendered, err := reportpdf.Render(printed, reportpdf.Options{})
	require.NoError(t, err)
	require.Empty(t, rendered.Diagnostics)
	reader, err := pdfreader.NewReader(bytes.NewReader(rendered.Bytes), int64(len(rendered.Bytes)))
	require.NoError(t, err)
	plain, err := reader.GetPlainText()
	require.NoError(t, err)
	text, err := io.ReadAll(plain)
	require.NoError(t, err)
	require.Contains(t, string(text), "series A: 4")
	require.Contains(t, string(text), "series B: 4")
	require.NotContains(t, string(text), "Unobserved category")
	require.NotContains(t, string(text), "Total Distinct devices")
	workbook, err := reportxlsx.RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	archive, err := zip.NewReader(bytes.NewReader(workbook), int64(len(workbook)))
	require.NoError(t, err)
	found := false
	for _, file := range archive.File {
		if strings.HasSuffix(file.Name, ".svg") {
			stream, e := file.Open()
			require.NoError(t, e)
			data, e := io.ReadAll(stream)
			require.NoError(t, e)
			require.NoError(t, stream.Close())
			found = found || string(data) == canonical
		}
	}
	require.True(t, found, "XLSX retains the exact canonical map SVG")
	for _, mutation := range []func(map[string]any){
		func(content map[string]any) { delete(content["geo"].(map[string]any), "summary") },
		func(content map[string]any) { delete(content["resolvedGeo"].(map[string]any), "summary") },
	} {
		var wire map[string]any
		require.NoError(t, json.Unmarshal(artifacts.ReportFill, &wire))
		content := wire["blocks"].([]any)[0].(map[string]any)["content"].(map[string]any)
		mutation(content)
		bad, e := json.Marshal(wire)
		require.NoError(t, e)
		_, e = reportfill.DecodeJSON(bad)
		require.Error(t, e)
	}
	delete(geoConfig, "summary")
	delete(color, "legendScope")
	defaults, err := reportfill.DecodeJSON(materialize().ReportFill)
	require.NoError(t, err)
	require.Equal(t, "8", defaults.Blocks[0].GeoContent.ResolvedGeo.Summary.TotalValue)
	require.Len(t, defaults.Blocks[0].GeoContent.ResolvedGeo.Legend.Rules, 421)
	require.Equal(t, geo.Regions, defaults.Blocks[0].GeoContent.ResolvedGeo.Regions)
	// The legacy tile path supplies an executable default-total witness.
	geoConfig["shape"] = "us-states"
	geoConfig["format"] = "number"
	for _, key := range []string{"geometry", "projection", "symbolSize", "seriesField"} {
		delete(geoConfig, key)
	}
	example.Rows = []map[string]any{{"location": "WA", "status": "A", "count": 4}, {"location": "NY", "status": "B", "count": 4}}
	legacy := materialize()
	require.Contains(t, string(legacy.ReportPrint), "Total Distinct devices: 8")
	geoConfig["summary"] = false
	color["legendScope"] = "observed"
	suppressed := materialize()
	require.NotContains(t, string(suppressed.ReportPrint), "Total Distinct devices")
	suppressedFill, err := reportfill.DecodeJSON(suppressed.ReportFill)
	require.NoError(t, err)
	require.Nil(t, suppressedFill.Blocks[0].GeoContent.ResolvedGeo.Summary)
	require.Len(t, suppressedFill.Blocks[0].GeoContent.ResolvedGeo.Legend.Rules, 2)
	require.Len(t, suppressedFill.Blocks[0].GeoContent.ResolvedGeo.Regions, 2)

}
