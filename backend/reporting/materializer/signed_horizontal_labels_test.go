package materializer

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"io"
	"strconv"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	"github.com/stretchr/testify/require"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
	identity "github.com/viant/forge/backend/resource"
)

// The embedded lowerer and materializer generate this SVG before the real PDF
// export consumes it; no Node-generated print artifact enters this proof.
func TestNativeSignedHorizontalLabelsFitAndExport(t *testing.T) {
	envelope := refinementFieldsEnvelope(t)
	var builder map[string]any
	require.NoError(t, json.Unmarshal(envelope.BuilderDefinition, &builder))
	builder["reportBuilder"].(map[string]any)["measures"].([]any)[0].(map[string]any)["format"] = "currency2"
	encode := func(value any) json.RawMessage {
		raw, err := json.Marshal(value)
		require.NoError(t, err)
		return raw
	}
	envelope.BuilderDefinition = encode(builder)
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Signed changes","blocks":[{"id":"group","kind":"compositeBlock","title":"Changes","layout":"responsiveGrid","childBlockIds":["changes","space"],"runtime":{"chrome":"none","childWeights":{"changes":1,"space":1},"minColumnWidth":40}},{"id":"changes","kind":"chartBlock","datasetRef":"primary","chartSpec":{"type":"horizontal_bar","xField":"region","yFields":["count"]}},{"id":"space","kind":"compositeBlock","title":"Space","childBlockIds":[],"runtime":{"chrome":"none","spacerHeight":0}}]}`)
	for index, dependency := range envelope.Dependencies {
		switch dependency.Kind {
		case "report":
			envelope.Dependencies[index].ContentFingerprint = identity.ContentFingerprint(envelope.ReportDocument)
		case "builder":
			envelope.Dependencies[index].ContentFingerprint = identity.ContentFingerprint(envelope.BuilderDefinition)
		}
	}
	lowered, err := Lower(t.Context(), encode(envelope))
	require.NoError(t, err)
	artifacts, err := Materialize(t.Context(), lowered, map[string]json.RawMessage{
		"primary":  json.RawMessage(`{"rows":[{"region":"North","count":987654321.12},{"region":"South","count":-987654321.12}]}`),
		"regional": json.RawMessage(`{"rows":[]}`), "comparison": json.RawMessage(`{"rows":[]}`),
	})
	require.NoError(t, err)
	print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	labels := 0
	for _, page := range print.Pages {
		for _, element := range page.Elements {
			if element.SVG == "" || !strings.HasPrefix(element.ID, "changes") {
				continue
			}
			var svg struct {
				Width string `xml:"width,attr"`
				Text  []struct {
					X        string `xml:"x,attr"`
					FontSize string `xml:"font-size,attr"`
					Anchor   string `xml:"text-anchor,attr"`
					Value    string `xml:",chardata"`
				} `xml:"text"`
			}
			require.NoError(t, xml.Unmarshal([]byte(element.SVG), &svg))
			width, err := strconv.ParseFloat(svg.Width, 64)
			require.NoError(t, err)
			for _, text := range svg.Text {
				if !strings.Contains(text.Value, "987,654,321.12") {
					continue
				}
				labels++
				x, err := strconv.ParseFloat(text.X, 64)
				require.NoError(t, err)
				size, err := strconv.ParseFloat(text.FontSize, 64)
				require.NoError(t, err)
				// The canonical SVG estimator uses six units per glyph at size 10.
				span := float64(len([]rune(text.Value))) * size * .6
				left, right := x, x+span
				if text.Anchor == "end" {
					left, right = x-span, x
				} else if text.Anchor == "middle" {
					left, right = x-span/2, x+span/2
				}
				require.GreaterOrEqual(t, left, 0.0, text.Value)
				require.LessOrEqual(t, right, width, text.Value)
			}
		}
	}
	require.GreaterOrEqual(t, labels, 2)
	rendered, err := reportpdf.Render(print, reportpdf.Options{})
	require.NoError(t, err)
	require.Empty(t, rendered.Diagnostics)
	reader, err := pdfreader.NewReader(bytes.NewReader(rendered.Bytes), int64(len(rendered.Bytes)))
	require.NoError(t, err)
	text, err := reader.GetPlainText()
	require.NoError(t, err)
	plain, err := io.ReadAll(text)
	require.NoError(t, err)
	require.Contains(t, string(plain), "$987,654,321.12")
	require.Contains(t, string(plain), "-$987,654,321.12")
}
