package materializer

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
)

// Independently invented cells exercise distinct numeric values rather than
// gaining an unrealistic benefit from the invocation-local text cache.
func TestWideNumericTableCompletesWithinMaterializerBudget(t *testing.T) {
	columns := make([]map[string]any, 49)
	for c := range columns {
		columns[c] = map[string]any{"key": fmt.Sprintf("value%d", c), "label": fmt.Sprintf("Measure %d", c), "format": "number"}
	}
	rows := make([]map[string]any, 490)
	for r := range rows {
		rows[r] = map[string]any{}
		for c := range columns {
			rows[r][fmt.Sprintf("value%d", c)] = r*len(columns) + c
		}
	}
	spec, err := json.Marshal(map[string]any{"version": 1, "kind": "reportSpec", "source": map[string]any{"kind": "report", "containerId": "synthetic", "stateKey": "synthetic", "dataSourceRef": "rows"}, "title": "Synthetic wide table", "parameters": map[string]any{"viewMode": "table", "pageSize": 1000}, "layoutIntent": map[string]any{"kind": "stack", "resultPanePosition": "bottom"}, "refinements": []any{}, "calculatedFields": []any{}, "datasets": []any{map[string]any{"id": "primary", "dataSourceRef": "rows", "request": map[string]any{}}}, "blocks": []any{map[string]any{"id": "evidence", "kind": "tableBlock", "datasetRef": "primary", "columns": columns}}})
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(map[string]any{"rows": rows})
	if err != nil {
		t.Fatal(err)
	}
	artifacts, err := Materialize(context.Background(), spec, map[string]json.RawMessage{"primary": data})
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		Pages []struct {
			Elements []struct{ Kind, ColumnKey, Text string }
		}
	}
	if err = json.Unmarshal(artifacts.ReportPrint, &document); err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, page := range document.Pages {
		for _, cell := range page.Elements {
			if cell.Kind == "tableCellText" {
				counts[cell.ColumnKey]++
			}
		}
	}
	// The first column is an identity anchor repeated across horizontal bands.
	for c := 1; c < len(columns); c++ {
		key := fmt.Sprintf("value%d", c)
		if counts[key] != len(rows) {
			t.Fatalf("incomplete %s: got %d rows, want %d", key, counts[key], len(rows))
		}
	}
}
