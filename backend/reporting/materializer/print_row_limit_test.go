package materializer

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestPrintChartLimitPreservesAggregateAndEvidence(t *testing.T) {
	for _, tc := range []struct {
		name         string
		limit, marks int
	}{{"explicit", 1, 1}, {"unlimited", 0, 2}} {
		t.Run(tc.name, func(t *testing.T) {
			raw, err := os.ReadFile("testdata/presentation-report.json")
			if err != nil {
				t.Fatal(err)
			}
			var spec map[string]any
			if err = json.Unmarshal(raw, &spec); err != nil {
				t.Fatal(err)
			}
			chart := map[string]any{"id": "chart", "kind": "chartBlock", "title": "Category totals", "datasetRef": "primary", "chartModel": map[string]any{"type": "horizontal_bar", "xAxis": map[string]any{"dataKey": "label"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "label": "Value", "type": "horizontal_bar", "dataLabels": "always"}}}}}
			if tc.limit > 0 {
				chart["rowLimit"] = tc.limit
			}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"chart", "evidence"}}
			spec["blocks"] = []any{chart, map[string]any{"id": "evidence", "kind": "tableBlock", "title": "Complete evidence", "datasetRef": "primary", "columns": []any{map[string]any{"key": "label", "label": "Category"}, map[string]any{"key": "value", "label": "Value"}}}}
			raw, err = json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"label":"Alpha","value":5},{"label":"Alpha","value":7},{"label":"Beta","value":9}]}`)})
			if err != nil {
				t.Fatal(err)
			}
			var print struct {
				Pages []struct {
					Elements []struct {
						ID   string `json:"id"`
						Kind string `json:"kind"`
						SVG  string `json:"svg"`
						Text string `json:"text"`
					} `json:"elements"`
				} `json:"pages"`
			}
			if err = json.Unmarshal(artifacts.ReportPrint, &print); err != nil {
				t.Fatal(err)
			}
			var svg string
			cells := 0
			beta := false
			for _, p := range print.Pages {
				for _, e := range p.Elements {
					if e.Kind == "svg" && strings.HasPrefix(e.ID, "chart__") {
						svg += e.SVG
					}
					if e.Kind == "tableCellText" && strings.HasPrefix(e.ID, "evidence") {
						cells++
						if e.Text == "Beta" {
							beta = true
						}
					}
				}
			}
			if got := strings.Count(svg, "<path "); got != tc.marks {
				t.Fatalf("got %d chart marks, want %d", got, tc.marks)
			}
			if !strings.Contains(svg, "Alpha") || !strings.Contains(svg, ">12</text>") {
				t.Fatal("complete aggregated Alpha value was lost")
			}
			if tc.limit > 0 && strings.Contains(svg, "Beta") {
				t.Fatal("explicit limit did not exclude second category")
			}
			if cells != 6 || !beta {
				t.Fatalf("evidence was truncated: cells=%d beta=%v", cells, beta)
			}
		})
	}
}
