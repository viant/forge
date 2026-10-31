package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"reflect"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// Independently invented quantities run through the canonical bundle in Goja.
func TestCategoricalHeatmapNumericPresentationPDF(t *testing.T) {
	for _, tc := range []struct {
		name                  string
		format                map[string]any
		values                []any
		labels                []string
		rowCount, columnCount int
	}{
		{"precision", map[string]any{"decimals": 2}, []any{8.0 / 3, 2.671}, []string{"2.67"}, 1, 2},
		{"tiles", map[string]any{"decimals": 2}, []any{8.0 / 3, 2.671}, []string{"2.67"}, 20, 8},
		{"percent", map[string]any{"decimals": 2, "scale": 100, "suffix": "%"}, []any{0, 0.02671}, []string{"0.00%", "2.67%"}, 1, 2},
		{"currency", map[string]any{"decimals": 2, "prefix": "$", "grouping": true, "negativeStyle": "parentheses"}, []any{-1234.5, 0}, []string{"($1,234.50)", "$0.00"}, 1, 2},
		{"escaped", map[string]any{"decimals": 2, "prefix": "<", "suffix": "&"}, []any{0, 2.671}, []string{"<0.00&", "<2.67&"}, 1, 2},
		{"no-data", map[string]any{"decimals": 2}, []any{0, nil}, []string{"0.00", "No data"}, 1, 3},
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
			rowCategories := make([]string, tc.rowCount)
			columnCategories := make([]string, tc.columnCount)
			for r := range rowCategories {
				rowCategories[r] = fmt.Sprintf("R%d", r)
			}
			for c := range columnCategories {
				columnCategories[c] = fmt.Sprintf("C%d", c)
			}
			rows := []map[string]any{}
			for r, row := range rowCategories {
				for c, column := range columnCategories {
					if tc.name == "no-data" && c == 2 {
						continue
					}
					rows = append(rows, map[string]any{"row": row, "column": column, "value": tc.values[(r*tc.columnCount+c)%len(tc.values)], "evidence": fmt.Sprintf("%d:%d", r, c)})
				}
			}
			matrix := map[string]any{"rowField": "row", "columnField": "column", "valueField": "value", "rowCategories": rowCategories, "columnCategories": columnCategories, "format": tc.format, "colorScale": map[string]any{"type": "sequential", "domain": "auto", "colors": []string{"#000000", "#ffffff"}}}
			chart := map[string]any{"type": "heatmap", "heatmap": matrix, "xField": "column", "yFields": []string{"value"}}
			spec["blocks"] = []any{map[string]any{"id": "matrix", "kind": "chartBlock", "title": "Synthetic quantities", "datasetRef": "primary", "chartSpec": chart, "chartModel": chart}}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"matrix"}}
			raw, err = json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			payload, err := json.Marshal(map[string]any{"rows": rows})
			if err != nil {
				t.Fatal(err)
			}
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
			if err != nil {
				t.Fatal(err)
			}
			var expected struct {
				Rows []map[string]any `json:"rows"`
			}
			if err = json.Unmarshal(payload, &expected); err != nil {
				t.Fatal(err)
			}
			var evidence struct {
				Datasets []struct {
					Rows []map[string]any `json:"rows"`
				} `json:"datasets"`
			}
			if err = json.Unmarshal(artifacts.ReportFill, &evidence); err != nil {
				t.Fatal(err)
			}
			if len(evidence.Datasets) != 1 || !reflect.DeepEqual(evidence.Datasets[0].Rows, expected.Rows) {
				t.Fatal("formatting changed raw evidence")
			}
			report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
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
			svg := ""
			tiles := 0
			for _, page := range printed.Pages {
				for _, element := range page.Elements {
					if element.SVG != "" {
						svg += element.SVG
						tiles++
					}
				}
			}
			if tc.name == "tiles" && tiles < 2 {
				t.Fatal("large matrix did not tile")
			}
			if strings.Count(svg, `stroke="#ffffff"`) != tc.rowCount*tc.columnCount {
				t.Fatal("formatting lost coordinates")
			}
			if tc.name == "precision" || tc.name == "tiles" {
				if strings.Contains(svg, "2.666666") || strings.Count(svg, ">2.67</text>") < tc.rowCount*tc.columnCount {
					t.Fatal("raw precision leaked into labels")
				}
				if !strings.Contains(svg, `fill="#000000" stroke="#ffffff"`) || !strings.Contains(svg, `fill="#ffffff" stroke="#ffffff"`) {
					t.Fatal("formatting rounded the color domain")
				}
			}
			if tc.name == "escaped" && !strings.Contains(svg, "&lt;2.67&amp;") {
				t.Fatal("numeric affixes were not escaped")
			}
			rendered, err := reportpdf.Render(report, reportpdf.Options{})
			if err != nil {
				t.Fatal(err)
			}
			if len(rendered.Diagnostics) > 0 {
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
			for _, label := range tc.labels {
				if !strings.Contains(string(content), label) {
					t.Fatalf("PDF lost formatted label %q: %s", label, content)
				}
			}
			if strings.Contains(string(content), "2.666666") {
				t.Fatal("PDF contains raw decimal expansion")
			}
		})
	}
}
