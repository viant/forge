package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	pdfreader "github.com/ledongthuc/pdf"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"io"
	"os"
	"strings"
	"testing"
)

func TestDonutCenterMaterialization(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/donut-center.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		ChartSpec map[string]any   `json:"chartSpec"`
		Rows      []map[string]any `json:"rows"`
		Occupancy map[string]any   `json:"occupancy"`
		ZeroRows  []map[string]any `json:"zeroRows"`
		NullRows  []map[string]any `json:"nullRows"`
		LongLabel string           `json:"longLabel"`
	}
	if err = json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	longCenter := map[string]any{"label": fixture.LongLabel, "value": map[string]any{"field": "items", "operation": "sum"}, "format": "number"}
	for _, test := range []struct {
		name   string
		center map[string]any
		rows   []map[string]any
		want   string
	}{
		{"sum", fixture.ChartSpec["center"].(map[string]any), fixture.Rows, "500"},
		{"scalar", fixture.Occupancy, fixture.Rows, "72.5%"},
		{"wrapped-whole-words", map[string]any{"label": "Total items", "value": map[string]any{"field": "items", "operation": "sum"}, "format": "number"}, fixture.Rows, "500"},
		{"zero", fixture.Occupancy, fixture.ZeroRows, "0.0%"},
		{"null", fixture.Occupancy, fixture.NullRows, "Unavailable"},
		{"empty", fixture.Occupancy, []map[string]any{}, "Unavailable"},
		{"long-label", longCenter, fixture.Rows, "500"},
	} {
		t.Run(test.name, func(t *testing.T) {
			raw, err := os.ReadFile("testdata/presentation-report.json")
			if err != nil {
				t.Fatal(err)
			}
			var spec map[string]any
			if err = json.Unmarshal(raw, &spec); err != nil {
				t.Fatal(err)
			}
			chartSpec := map[string]any{"type": "donut", "xField": "category", "yFields": []string{"items"}, "center": test.center}
			chart := map[string]any{"type": "donut", "center": test.center, "series": map[string]any{"nameKey": "category", "valueKey": "items", "palette": []string{"#426b85", "#8a7644", "#72577c"}}}
			spec["blocks"] = []any{map[string]any{"id": "collection", "kind": "chartBlock", "title": "Library collection", "datasetRef": "primary", "chartSpec": chartSpec, "chartModel": chart}}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"collection"}}
			raw, err = json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			payload, err := json.Marshal(map[string]any{"rows": test.rows})
			if err != nil {
				t.Fatal(err)
			}
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
			if err != nil {
				t.Fatal(err)
			}
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			if err != nil {
				t.Fatal(err)
			}
			if fill.Blocks[0].ChartContent.ResolvedChart.Center.FormattedValue != test.want {
				t.Fatalf("resolved center mismatch: %+v", fill.Blocks[0].ChartContent.ResolvedChart.Center)
			}
			report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			if err != nil {
				t.Fatal(err)
			}
			if test.name == "wrapped-whole-words" {
				svg := ""
				for _, page := range report.Pages {
					for _, element := range page.Elements {
						svg += element.SVG
					}
				}
				if !strings.Contains(svg, ">Total</text>") || !strings.Contains(svg, ">items</text>") {
					t.Fatalf("expected whole words inside PDF hole: %s", svg)
				}
			}
			rendered, err := reportpdf.Render(report, reportpdf.Options{})
			if err != nil {
				t.Fatal(err)
			}
			if len(rendered.Diagnostics) != 0 {
				t.Fatalf("PDF diagnostics: %+v", rendered.Diagnostics)
			}
			reader, err := pdfreader.NewReader(bytes.NewReader(rendered.Bytes), int64(len(rendered.Bytes)))
			if err != nil {
				t.Fatal(err)
			}
			plain, err := reader.GetPlainText()
			if err != nil {
				t.Fatal(err)
			}
			content, err := io.ReadAll(plain)
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(string(content), test.want) {
				t.Fatalf("PDF lost center %s: %s", test.want, content)
			}
			if test.name == "empty" && !strings.Contains(strings.Join(strings.Fields(string(content)), " "), "No slice data.") {
				t.Fatalf("PDF lost empty state: %s", content)
			}
			label := test.center["label"].(string)
			if !strings.Contains(strings.Join(strings.Fields(string(content)), " "), strings.Join(strings.Fields(label), " ")) {
				t.Fatalf("PDF lost complete label %s: %s", label, content)
			}
		})
	}
}
