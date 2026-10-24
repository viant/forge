package materializer

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/dop251/goja"
	"github.com/viant/forge/backend/provider/contract/observe"
)

func syntheticFifteenTablePrintFixture(t *testing.T) (json.RawMessage, map[string]json.RawMessage) {
	t.Helper()
	columns := []map[string]any{
		{"key": "date", "label": "Date", "format": "date"}, {"key": "id", "label": "ID", "format": "id"},
		{"key": "state", "label": "State"}, {"key": "country", "label": "Country"},
		{"key": "impressions", "label": "Impressions", "format": "compactNumber"},
		{"key": "spend", "label": "Spend", "format": "currency2"},
		{"key": "clicks", "label": "Clicks", "format": "compactNumber"},
		{"key": "conversions", "label": "Conversions", "format": "compactNumber"},
	}
	spec := map[string]any{"version": 1, "kind": "reportSpec", "source": map[string]any{"kind": "report", "containerId": "synthetic-print", "stateKey": "synthetic-print", "dataSourceRef": "source"}, "title": "Synthetic print", "parameters": map[string]any{"viewMode": "table", "pageSize": 1000}, "layoutIntent": map[string]any{"kind": "stack", "resultPanePosition": "bottom"}, "refinements": []any{}, "calculatedFields": []any{}}
	datasets, blocks, payloads := make([]map[string]any, 0, 15), make([]map[string]any, 0, 15), make(map[string]json.RawMessage, 15)
	for index := 0; index < 15; index++ {
		id := "table_" + string(rune('a'+index))
		datasets = append(datasets, map[string]any{"id": id, "dataSourceRef": "source", "request": map[string]any{}})
		blocks = append(blocks, map[string]any{"id": id, "kind": "tableBlock", "datasetRef": id, "columns": columns})
		count := 95
		if index == 14 {
			count = 92
		}
		rows := make([]map[string]any, count)
		for row := range rows {
			rows[row] = map[string]any{"date": "2026-01-01T00:00:00Z", "id": index*1000 + row + 1,
				"state": "CA", "country": "United States", "impressions": row + 1,
				"spend": 12.34, "clicks": 2, "conversions": 1}
		}
		payload, err := json.Marshal(map[string]any{"rows": rows})
		if err != nil {
			t.Fatal(err)
		}
		payloads[id] = payload
	}
	spec["datasets"], spec["blocks"] = datasets, blocks
	raw, err := json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	return raw, payloads
}

func TestSyntheticFifteenTablePrintProfile(t *testing.T) {
	spec, datasets := syntheticFifteenTablePrintFixture(t)
	profile := os.Getenv("FORGE_SYNTHETIC_PRINT_PROFILE")
	if profile != "" {
		file, err := os.Create(profile)
		if err != nil {
			t.Fatal(err)
		}
		if err := goja.StartProfile(file); err != nil {
			_ = file.Close()
			t.Fatal(err)
		}
		defer func() { goja.StopProfile(); _ = file.Close() }()
	}
	var events []observe.Event
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) { events = append(events, event) }))
	started := time.Now()
	artifacts, err := Materialize(ctx, spec, datasets)
	t.Logf("synthetic rows=1422 tables=15 elapsed=%s error=%v", time.Since(started), err)
	for _, event := range events {
		t.Logf("phase=%s duration=%s outcome=%s", event.Phase, event.Duration, event.Outcome)
	}
	if err != nil {
		t.Fatal(err)
	}
	if artifacts == nil || len(artifacts.ReportPrint) == 0 {
		t.Fatal("missing complete print")
	}

	var print struct {
		Pages []struct {
			Elements []struct{ Kind, ColumnKey, Text string }
		}
	}
	if err := json.Unmarshal(artifacts.ReportPrint, &print); err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, page := range print.Pages {
		for _, e := range page.Elements {
			if e.Kind == "tableCellText" {
				counts[e.ColumnKey]++
			}
		}
	}
	for _, key := range []string{"date", "id", "state", "country", "impressions", "spend", "clicks", "conversions"} {
		if counts[key] != 1422 {
			t.Fatalf("incomplete %s: %d", key, counts[key])
		}
	}
	encoded, err := json.Marshal(artifacts)
	if err != nil {
		t.Fatal(err)
	}
	// Exact pre-optimization baseline bundle produced this complete fill/print
	// artifact digest for all fifteen tables. This guards layout and cell parity.
	const baseline = "4b68b95c031e34fe998fc8ce38f54f4d5e438247dd9c61eb1cb5dd365a9f451f"
	if got := fmt.Sprintf("%x", sha256.Sum256(encoded)); got != baseline {
		t.Fatalf("complete artifact changed: got %s, want %s", got, baseline)
	}
	t.Logf("all-artifact sha256=%s pages=%d", baseline, len(print.Pages))
	if path := os.Getenv("FORGE_SYNTHETIC_PRINT_OUTPUT"); path != "" {
		if err := os.WriteFile(path, encoded, 0600); err != nil {
			t.Fatal(err)
		}
	}
}
