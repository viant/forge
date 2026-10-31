package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func TestCategoricalHeatmapAutomaticDomainPDF(t *testing.T) {
	for _, tc := range []struct {
		name   string
		values []any
		colors []string
	}{
		{"range", []any{2, 8}, []string{"#000000", "#ffffff"}},
		{"constant", []any{0, 0}, []string{"#808080"}},
		{"missing", []any{nil, nil}, []string{"#eeeeee"}},
		{"negative", []any{-8, -2}, []string{"#000000", "#ffffff"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw, err := os.ReadFile("testdata/presentation-report.json")
			if err != nil {
				t.Fatal(err)
			}
			var spec map[string]any
			if err = json.Unmarshal(raw, &spec); err != nil {
				t.Fatal(err)
			}
			matrix := map[string]any{"rowField": "room", "columnField": "slot", "valueField": "value", "rowCategories": []string{"Room"}, "columnCategories": []string{"AM", "PM"}, "colorScale": map[string]any{"type": "sequential", "domain": "auto", "colors": []string{"#000000", "#ffffff"}}}
			chart := map[string]any{"type": "heatmap", "heatmap": matrix, "xField": "slot", "yFields": []string{"value"}}
			spec["blocks"] = []any{map[string]any{"id": "matrix", "kind": "chartBlock", "title": "Synthetic occupancy", "datasetRef": "primary", "chartSpec": chart, "chartModel": chart}}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"matrix"}}
			raw, err = json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			payload, err := json.Marshal(map[string]any{"rows": []any{map[string]any{"room": "Room", "slot": "AM", "value": tc.values[0]}, map[string]any{"room": "Room", "slot": "PM", "value": tc.values[1]}}})
			if err != nil {
				t.Fatal(err)
			}
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
			if err != nil {
				t.Fatal(err)
			}
			var printed struct {
				Pages []struct {
					Elements []struct {
						SVG string `json:"svg"`
					} `json:"elements"`
				} `json:"pages"`
			}
			if err = json.Unmarshal(artifacts.ReportPrint, &printed); err != nil {
				t.Fatal(err)
			}
			var svg string
			for _, page := range printed.Pages {
				for _, element := range page.Elements {
					svg += element.SVG
				}
			}
			if strings.Count(svg, `stroke="#ffffff"`) != 2 || strings.Contains(svg, "NaN") || strings.Contains(svg, "Infinity") {
				t.Fatalf("invalid matrix SVG: %s", svg)
			}
			for _, color := range tc.colors {
				if !strings.Contains(svg, `fill="`+color+`"`) {
					t.Fatalf("missing expected color %s", color)
				}
			}
			report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			if err != nil {
				t.Fatal(err)
			}
			pdf, err := reportpdf.Render(report, reportpdf.Options{})
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.HasPrefix(pdf.Bytes, []byte("%PDF-")) || len(pdf.Diagnostics) > 0 {
				t.Fatalf("invalid PDF or diagnostics: %+v", pdf.Diagnostics)
			}
			if dir := os.Getenv("HEATMAP_ARTIFACT_DIR"); dir != "" {
				if err = os.MkdirAll(dir, 0700); err != nil {
					t.Fatal(err)
				}
				if err = os.WriteFile(filepath.Join(dir, tc.name+".pdf"), pdf.Bytes, 0600); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}
