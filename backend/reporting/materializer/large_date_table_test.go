package materializer

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

func TestLargeDatedEvidenceCompletesWithinMaterializerBudget(t *testing.T) {
	spec := json.RawMessage(`{"version":1,"kind":"reportSpec","source":{"kind":"report","containerId":"synthetic","stateKey":"synthetic","dataSourceRef":"rows"},"title":"Synthetic date table","parameters":{"viewMode":"table","pageSize":1000},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["evidence"]},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"rows","request":{}}],"blocks":[{"id":"evidence","kind":"tableBlock","datasetRef":"primary","columns":[{"key":"date","label":"Date","format":"date"},{"key":"id","label":"ID","format":"id"},{"key":"state","label":"State"},{"key":"country","label":"Country"},{"key":"impressions","label":"Impressions","format":"compactNumber"},{"key":"spend","label":"Spend","format":"currency2"},{"key":"clicks","label":"Clicks","format":"compactNumber"},{"key":"conversions","label":"Conversions","format":"compactNumber"}]}]}`)
	rows := make([]map[string]any, 600)
	for i := range rows {
		rows[i] = map[string]any{"date": "2026-01-01T00:00:00Z", "id": 12345679, "state": "CA", "country": "United States", "impressions": i + 1, "spend": .11, "clicks": 1, "conversions": nil}
	}
	payload, err := json.Marshal(map[string]any{"rows": rows})
	if err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	out, err := Materialize(context.Background(), spec, map[string]json.RawMessage{"primary": payload})
	if err != nil {
		t.Fatal(err)
	}
	var print struct {
		Pages []struct {
			Elements []struct {
				Kind      string `json:"kind"`
				ColumnKey string `json:"columnKey"`
				Text      string `json:"text"`
			} `json:"elements"`
		} `json:"pages"`
	}
	if err := json.Unmarshal(out.ReportPrint, &print); err != nil {
		t.Fatal(err)
	}
	ids, dates := 0, 0
	for _, page := range print.Pages {
		for _, e := range page.Elements {
			if e.Kind != "tableCellText" {
				continue
			}
			switch e.ColumnKey {
			case "id":
				if e.Text != "12345679" {
					t.Fatalf("changed ID: %q", e.Text)
				}
				ids++
			case "date":
				if e.Text != "Jan 1, 2026" {
					t.Fatalf("changed civil date: %q", e.Text)
				}
				dates++
			}
		}
	}
	if ids != 600 || dates != 600 {
		t.Fatalf("incomplete table: ids=%d dates=%d", ids, dates)
	}
	if len(print.Pages) > 26 {
		t.Fatalf("compact evidence should fit in one horizontal pane: pages=%d", len(print.Pages))
	}
	t.Logf("600 synthetic dated rows completed in %s, pages=%d", time.Since(started), len(print.Pages))
}
