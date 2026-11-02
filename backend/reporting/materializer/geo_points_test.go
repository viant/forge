package materializer

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"os"
	"regexp"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	"github.com/stretchr/testify/require"
	reporthtml "github.com/viant/forge/backend/reporting/export/html"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// Independently invented points; the canonical bundle is executed by Goja.
func TestGeoGeometryPointsNative(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/sensor-point-geometry.json")
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
	payload, err := json.Marshal(map[string]any{"rows": example.Rows})
	require.NoError(t, err)
	artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
	require.NoError(t, err)
	fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	regions := fill.Blocks[0].GeoContent.ResolvedGeo.Regions
	require.Equal(t, 16.0, regions[1].Symbol.Radius)
	require.Equal(t, 32.0, regions[2].Symbol.Radius)
	require.Equal(t, 0.0, *regions[3].Symbol.RawValue)
	require.Nil(t, regions[4].Symbol.RawValue)
	require.Equal(t, "No value", regions[4].Symbol.DisplayValue)
	require.Equal(t, "No row", regions[5].Symbol.DisplayValue)
	// The wire payload contains independent region copies; every point copy
	// consumed by ranking or initial selection needs its symbol, not just Regions.
	for _, field := range []string{"ranking", "activeRegion"} {
		for _, malformed := range []string{"missingPointSymbol", "polygonSymbol", "unknownKey"} {
			t.Run(field+"/"+malformed, func(t *testing.T) {
				var wire map[string]any
				require.NoError(t, json.Unmarshal(artifacts.ReportFill, &wire))
				geo := wire["blocks"].([]any)[0].(map[string]any)["content"].(map[string]any)["resolvedGeo"].(map[string]any)
				var region map[string]any
				if field == "ranking" {
					region = geo[field].([]any)[0].(map[string]any)
				} else {
					region = geo[field].(map[string]any)
				}
				switch malformed {
				case "missingPointSymbol":
					delete(region, "symbol")
				case "polygonSymbol":
					region["key"] = "plan"
				case "unknownKey":
					region["key"] = "unknown"
				}
				bad, err := json.Marshal(wire)
				require.NoError(t, err)
				_, err = reportfill.DecodeJSON(bad)
				require.ErrorContains(t, err, field)
			})
		}
	}
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	html, err := reporthtml.Render(printed)
	require.NoError(t, err)
	images := regexp.MustCompile(`data:image/svg\+xml;base64,([^" ]+)`).FindSubmatch(html)
	require.Len(t, images, 2)
	mapSVG, err := base64.StdEncoding.DecodeString(string(images[1]))
	require.NoError(t, err)
	require.Contains(t, string(mapSVG), `<circle cx="296" cy="158" r="16"`)
	require.Contains(t, string(mapSVG), `<circle cx="480" cy="158" r="32"`)
	rendered, err := reportpdf.Render(printed, reportpdf.Options{})
	require.NoError(t, err)
	require.Empty(t, rendered.Diagnostics)
	reader, err := pdfreader.NewReader(bytes.NewReader(rendered.Bytes), int64(len(rendered.Bytes)))
	require.NoError(t, err)
	plain, err := reader.GetPlainText()
	require.NoError(t, err)
	text, err := io.ReadAll(plain)
	require.NoError(t, err)
	for _, label := range []string{"Sensor A", "Sensor B", "Sensor C", "Sensor D", "Sensor E", "Observations", "No value", "No row"} {
		require.Contains(t, string(text), label)
	}
	// The native fpdf circle uses six cubic segments for fill and six for
	// stroke. Crosses have only line segments, never positive bubble area.
	curves := 0
	for page := 1; page <= reader.NumPage(); page++ {
		stream, err := io.ReadAll(reader.Page(page).V.Key("Contents").Reader())
		require.NoError(t, err)
		curves += strings.Count(string(stream), " c\n")
	}
	require.Equal(t, 36, curves, "native PDF must draw all three actual circular marks")
	if stem := os.Getenv("FORGE_POINT_PROOF"); stem != "" {
		require.NoError(t, os.WriteFile(stem+".pdf", rendered.Bytes, 0600))
		require.NoError(t, os.WriteFile(stem+".html", html, 0600))
	}
	for _, rows := range []string{`{"rows":[]}`, `{"rows":[{"sensorId":"A","reading":0,"observations":0}]}`} {
		empty, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": json.RawMessage(rows)})
		require.NoError(t, err)
		_, err = reportfill.DecodeJSON(empty.ReportFill)
		require.NoError(t, err)
	}
	t.Run("valuelessPolygon", func(t *testing.T) {
		var polygonSpec map[string]any
		require.NoError(t, json.Unmarshal(raw, &polygonSpec))
		geo := polygonSpec["blocks"].([]any)[0].(map[string]any)["geo"].(map[string]any)
		delete(geo, "symbolSize")
		geometry := geo["geometry"].(map[string]any)
		geometry["features"] = geometry["features"].([]any)[:1]
		polygonRaw, err := json.Marshal(polygonSpec)
		require.NoError(t, err)
		empty, err := Materialize(context.Background(), polygonRaw, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[]}`)})
		require.NoError(t, err)
		decoded, err := reportfill.DecodeJSON(empty.ReportFill)
		require.NoError(t, err)
		require.Empty(t, decoded.Blocks[0].GeoContent.ResolvedGeo.Ranking)
		require.Empty(t, decoded.Blocks[0].GeoContent.ResolvedGeo.Summary.TopKey)
	})
	for _, bad := range []string{`{"rows":[{"sensorId":"A","reading":0,"observations":-1}]}`, `{"rows":[{"sensorId":"A","reading":0,"observations":"2"}]}`} {
		_, err = Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": json.RawMessage(bad)})
		require.ErrorContains(t, err, "nonnegative finite")
	}
	example.Block["geo"].(map[string]any)["symbolSize"].(map[string]any)["unknown"] = 1
	raw, err = json.Marshal(spec)
	require.NoError(t, err)
	_, err = Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
	require.Error(t, err, "unknown authored symbol keys must reject")
	delete(example.Block["geo"].(map[string]any), "symbolSize")
	raw, err = json.Marshal(spec)
	require.NoError(t, err)
	_, err = Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
	require.ErrorContains(t, err, "symbolSize", "points without declared size must reject")
}
