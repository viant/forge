package materializer

import (
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
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func TestGeoCategoricalPointsNative(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/sensor-category-point-geometry.json")
	require.NoError(t, err)
	var example struct {
		Block map[string]any
		Rows  []map[string]any
	}
	require.NoError(t, json.Unmarshal(raw, &example))
	raw, err = os.ReadFile("testdata/presentation-report.json")
	require.NoError(t, err)
	var spec map[string]any
	require.NoError(t, json.Unmarshal(raw, &spec))
	spec["blocks"] = []any{example.Block}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"sensors"}}
	raw, err = json.Marshal(spec)
	require.NoError(t, err)
	materialize := func(rows []map[string]any) *Artifacts {
		payload, e := json.Marshal(map[string]any{"rows": rows})
		require.NoError(t, e)
		artifacts, e := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
		require.NoError(t, e)
		return artifacts
	}
	artifacts := materialize(example.Rows)
	fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	geo := fill.Blocks[0].GeoContent.ResolvedGeo
	reversed := materialize([]map[string]any{example.Rows[1], example.Rows[0]})
	reversedFill, e := reportfill.DecodeJSON(reversed.ReportFill)
	require.NoError(t, e)
	require.Equal(t, geo, reversedFill.Blocks[0].GeoContent.ResolvedGeo)
	require.Len(t, geo.Geometry.Features, 2)
	require.Len(t, geo.Regions, 3)
	require.Equal(t, "status", geo.SeriesField)
	for _, region := range geo.Regions[1:] {
		require.Equal(t, "North", region.Key)
		require.Equal(t, float64(4), region.RawValue)
		require.Equal(t, 4.0, *region.Symbol.RawValue)
		require.Equal(t, 24.0, region.Symbol.Radius)
	}
	require.Equal(t, "#336699", geo.Regions[1].Color)
	require.Equal(t, "#cc6633", geo.Regions[2].Color)
	require.NotEqual(t, geo.Regions[1].MarkID, geo.Regions[2].MarkID)
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	reversedPrint, err := reportprint.DecodeJSON(reversed.ReportPrint)
	require.NoError(t, err)
	// The admitted source rows retain their order and therefore their fill hash;
	// rendered pages and mark selection are independent of that row ordering.
	require.Equal(t, printed.Pages, reversedPrint.Pages)
	svg := ""
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			if strings.Contains(element.SVG, `<circle cx="480"`) {
				svg = element.SVG
			}
		}
	}
	require.Equal(t, 2, strings.Count(svg, "<circle "))
	require.Contains(t, svg, `<circle cx="480" cy="250" r="24" fill="#336699"`)
	require.Contains(t, svg, `<circle cx="480" cy="250" r="24" fill="#cc6633"`)
	rendered, err := reportpdf.Render(printed, reportpdf.Options{})
	require.NoError(t, err)
	require.Empty(t, rendered.Diagnostics)
	reader, err := pdfreader.NewReader(bytes.NewReader(rendered.Bytes), int64(len(rendered.Bytes)))
	require.NoError(t, err)
	plain, err := reader.GetPlainText()
	require.NoError(t, err)
	text, err := io.ReadAll(plain)
	require.NoError(t, err)
	require.Contains(t, string(text), `series A: 4`)
	require.Contains(t, string(text), `series B: 4`)
	curves := 0
	for page := 1; page <= reader.NumPage(); page++ {
		stream, e := io.ReadAll(reader.Page(page).V.Key("Contents").Reader())
		require.NoError(t, e)
		curves += strings.Count(string(stream), " c\n")
	}
	require.Equal(t, 24, curves)
	withC := materialize(append(example.Rows, map[string]any{"location": "North", "status": "C", "count": 2}))
	added, err := reportfill.DecodeJSON(withC.ReportFill)
	require.NoError(t, err)
	require.Equal(t, geo.Geometry, added.Blocks[0].GeoContent.ResolvedGeo.Geometry)
	require.Len(t, added.Blocks[0].GeoContent.ResolvedGeo.Regions, 4)
	for _, rows := range [][]map[string]any{nil, {{"location": "North", "status": nil, "count": 4}, {"location": "North", "status": "", "count": 4}, {"location": "North", "status": 0, "count": 4}, {"location": "North", "status": "0", "count": 4}, {"location": "North", "status": false, "count": 4}}} {
		_, e := reportfill.DecodeJSON(materialize(rows).ReportFill)
		require.NoError(t, e)
	}
	categories := []any{nil, "", 0, "0", false}
	colors := []string{"#112233", "#223344", "#334455", "#445566", "#556677"}
	rules := []any{}
	rows := []map[string]any{}
	for i, value := range categories {
		rules = append(rules, map[string]any{"value": value, "color": colors[i], "label": colors[i]})
		rows = append(rows, map[string]any{"location": "North", "status": value, "count": 4})
	}
	example.Block["geo"].(map[string]any)["color"] = map[string]any{"field": "status", "rules": rules}
	raw, err = json.Marshal(spec)
	require.NoError(t, err)
	typed, err := reportfill.DecodeJSON(materialize(rows).ReportFill)
	require.NoError(t, err)
	identities := map[string]bool{}
	expectedColors := map[string]string{"null": colors[0], `""`: colors[1], "0": colors[2], `"0"`: colors[3], "false": colors[4]}
	for _, region := range typed.Blocks[0].GeoContent.ResolvedGeo.Regions[1:] {
		require.Equal(t, expectedColors[string(region.SeriesValue)], region.Color)
		require.False(t, identities[region.MarkID])
		identities[region.MarkID] = true
	}
	var wire map[string]any
	require.NoError(t, json.Unmarshal(materialize(rows).ReportFill, &wire))
	wireGeo := wire["blocks"].([]any)[0].(map[string]any)["content"].(map[string]any)["resolvedGeo"].(map[string]any)
	wireRegions := wireGeo["regions"].([]any)
	for _, item := range wireRegions {
		region := item.(map[string]any)
		if value, ok := region["seriesValue"].(float64); ok && value == 0 {
			duplicate := map[string]any{}
			for key, value := range region {
				duplicate[key] = value
			}
			duplicate["markId"] = `["North",-0]`
			duplicate["seriesValue"] = json.RawMessage(`-0`)
			wireGeo["regions"] = append(wireRegions, duplicate)
			break
		}
	}
	bad, err := json.Marshal(wire)
	require.NoError(t, err)
	_, err = reportfill.DecodeJSON(bad)
	require.ErrorContains(t, err, "duplicate typed mark identity")
	for _, row := range []map[string]any{{"location": "Unknown", "status": "C", "count": 1}, {"location": "North", "count": 1}, {"location": "North", "status": map[string]any{}, "count": 1}, {"location": "background", "status": "A", "count": 1}} {
		payload, e := json.Marshal(map[string]any{"rows": []any{row}})
		require.NoError(t, e)
		_, e = Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
		require.Error(t, e)
	}
	example.Block["geo"].(map[string]any)["seriesField"] = "status.code"
	raw, err = json.Marshal(spec)
	require.NoError(t, err)
	for _, status := range []any{nil, false, 0, ""} {
		payload, e := json.Marshal(map[string]any{"rows": []any{map[string]any{"location": "North", "status": status, "count": 4}}})
		require.NoError(t, e)
		_, e = Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
		require.ErrorContains(t, e, "present scalar")
	}
	_, err = reportfill.DecodeJSON(materialize([]map[string]any{{"location": "North", "status": map[string]any{"code": nil}, "count": 4}}).ReportFill)
	require.NoError(t, err)
}
