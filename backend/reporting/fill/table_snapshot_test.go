package reportfill_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/viant/forge/backend/reporting/export/csv"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportspec "github.com/viant/forge/backend/reporting/spec"
)

func TestBuildTableSnapshotProjectsDisplayedFieldsAndRendersCSV(t *testing.T) {
	limit, offset := 10, 0
	spec := &reportspec.ReportSpec{Version: 1, Kind: "reportSpec", Source: reportspec.Source{Kind: "test", ContainerID: "report", StateKey: "1", DataSourceRef: "query"}, Title: "Report",
		Parameters:   &reportspec.Parameters{ViewMode: "report", PageSize: 10, OrderDir: "asc"},
		LayoutIntent: &reportspec.LayoutIntent{Kind: "blocks", ResultPanePosition: "main", BlockOrder: []string{"detail"}},
		Refinements:  []map[string]any{}, CalculatedFields: []map[string]any{},
		Datasets: []reportspec.Dataset{{ID: "data", DataSourceRef: "query", Request: reportspec.RequestPayload{Kind: "query", Limit: &limit, Offset: &offset}}},
		Blocks:   []reportspec.Block{{ID: "detail", Kind: "tableBlock", DatasetRef: "data", Columns: []reportspec.TableColumn{{Key: "name", DisplayKey: "displayName", Label: "Name"}}}},
	}
	encoded, err := json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	fill, err := reportfill.BuildTableSnapshot(encoded, "detail", []map[string]any{{"name": "Raw", "displayName": "Visible", "secret": "Hidden"}}, 1, false)
	if err != nil {
		t.Fatal(err)
	}
	if fill.Datasets[0].Request.Limit == nil || *fill.Datasets[0].Request.Limit != 1 {
		t.Fatalf("fill provenance did not pin the enforced limit: %+v", fill.Datasets[0].Request)
	}
	fillJSON, err := json.Marshal(fill)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(fillJSON), "Hidden") {
		t.Fatalf("unselected column entered export fill: %s", fillJSON)
	}
	loaded, err := reportfill.DecodeJSON(fillJSON)
	if err != nil {
		t.Fatalf("Forge cannot reload table fill: %v", err)
	}
	csvBytes, err := csv.Render(loaded)
	if err != nil || string(csvBytes) != "Name\nVisible\n" {
		t.Fatalf("CSV = %q, %v", csvBytes, err)
	}
	if _, err := reportfill.BuildTableSnapshot(encoded, "missing", nil, 1, false); err == nil {
		t.Fatal("unknown table block was accepted")
	}
	if _, err := reportfill.BuildTableSnapshot(encoded, "detail", []map[string]any{{"secret": "Hidden"}}, 1, false); err == nil {
		t.Fatal("missing displayed field was accepted")
	}
	if _, err := reportfill.BuildTableSnapshot(encoded, "detail", []map[string]any{{"name": "Raw", "displayName": "Visible"}}, 11, false); err == nil {
		t.Fatal("snapshot exceeded authored request limit")
	}
	if _, err := reportfill.BuildTableSnapshot(encoded, "detail", []map[string]any{{"name": "Raw"}}, 1, false); err == nil {
		t.Fatal("missing explicit display column was accepted")
	}
}
