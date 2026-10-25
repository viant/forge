package materializer

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestKpiDateSelectionUsesChronologicalValueInFillAndPrint(t *testing.T) {
	for _, tc := range []struct {
		name, selector, rows, want string
	}{
		{"latest", "maxbyvalue", `[{"date":"2026-10-01T00:00:00Z"},{"date":"2026-10-02T00:00:00Z"}]`, "2026-10-02T00:00:00Z"},
		{"earliest", "minbyvalue", `[{"date":"2026-10-02T00:00:00Z"},{"date":"2026-10-01T00:00:00Z"}]`, "2026-10-01T00:00:00Z"},
		{"offset", "maxbyvalue", `[{"date":"2026-10-02T00:30:00+02:00"},{"date":"2026-10-01T23:00:00Z"}]`, "2026-10-01T23:00:00Z"},
		{"invalid", "maxbyvalue", `[{"date":null},{"date":"2026-02-30"},{"date":"2026-02-28"}]`, "2026-02-28"},
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
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"date"}}
			spec["blocks"] = []any{map[string]any{"id": "date", "kind": "kpiBlock", "title": "Selected exposure", "datasetRef": "primary", "valueField": "date", "rowSelector": tc.selector}}
			raw, err = json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":` + tc.rows + `}`)})
			if err != nil {
				t.Fatal(err)
			}
			var fill struct {
				Blocks []struct {
					Content struct {
						Value string `json:"value"`
					} `json:"content"`
				} `json:"blocks"`
			}
			if err = json.Unmarshal(artifacts.ReportFill, &fill); err != nil {
				t.Fatal(err)
			}
			if len(fill.Blocks) != 1 || fill.Blocks[0].Content.Value != tc.want {
				t.Fatalf("wrong selected date: %s", artifacts.ReportFill)
			}
			if !strings.Contains(string(artifacts.ReportPrint), tc.want) {
				t.Fatal("print lost the selected date")
			}
		})
	}
}
