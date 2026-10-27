package materializer

import (
	"context"
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestCalculatedFieldPipelineConformance(t *testing.T) {
	raw, err := os.ReadFile("../../../src/reporting/fixtures/table-calculation-conformance-fixtures.v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var corpus struct {
		RuntimeCases []struct {
			ID           string           `json:"id"`
			Definitions  []map[string]any `json:"definitions"`
			Rows         []map[string]any `json:"rows"`
			ExpectedRows []map[string]any `json:"expectedRows"`
		} `json:"runtimeCases"`
	}
	if err = json.Unmarshal(raw, &corpus); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range corpus.RuntimeCases {
		t.Run(fixture.ID, func(t *testing.T) {
			fields := fixture.Definitions
			for _, field := range fields {
				field["datasetRef"] = "primary"
			}
			key, _ := fields[0]["key"].(string)
			if key == "" {
				key, _ = fields[0]["id"].(string)
			}
			spec := map[string]any{"version": 1, "kind": "reportSpec", "source": map[string]any{"kind": "report", "containerId": "synthetic", "stateKey": "synthetic", "dataSourceRef": "rows"}, "title": "Calculation pipeline", "parameters": map[string]any{"viewMode": "table", "pageSize": 100}, "layoutIntent": map[string]any{"kind": "stack", "resultPanePosition": "bottom", "blockOrder": []string{"evidence"}}, "refinements": []any{}, "calculatedFields": fields, "datasets": []any{map[string]any{"id": "primary", "dataSourceRef": "rows", "request": map[string]any{}}}, "blocks": []any{map[string]any{"id": "evidence", "kind": "tableBlock", "datasetRef": "primary", "title": "Evidence", "columns": []any{map[string]any{"key": key, "label": "Computed value"}}}}}
			encoded, _ := json.Marshal(spec)
			payload, _ := json.Marshal(map[string]any{"rows": fixture.Rows})
			out, err := MaterializeFill(context.Background(), encoded, map[string]json.RawMessage{"primary": payload})
			if err != nil {
				t.Fatal(err)
			}
			var fill struct {
				Datasets []struct {
					Rows []map[string]any `json:"rows"`
				} `json:"datasets"`
			}
			if err = json.Unmarshal(out.ReportFill, &fill); err != nil {
				t.Fatal(err)
			}
			if len(fill.Datasets) != 1 || !reflect.DeepEqual(fill.Datasets[0].Rows, fixture.ExpectedRows) {
				t.Fatalf("trusted rows differ: %#v", fill.Datasets)
			}
		})
	}
}

func TestCalculatedFieldCycleRejectedDuringLowering(t *testing.T) {
	raw, err := os.ReadFile("testdata/authored-envelope.json")
	if err != nil {
		t.Fatal(err)
	}
	var envelope map[string]any
	if err = json.Unmarshal(raw, &envelope); err != nil {
		t.Fatal(err)
	}
	builder := envelope["builderDefinition"].(map[string]any)["reportBuilder"].(map[string]any)
	builder["calculatedFields"] = []any{map[string]any{"id": "a", "expr": "b + 1"}, map[string]any{"id": "b", "compute": map[string]any{"type": "lag", "sourceField": "a", "orderBy": []any{map[string]any{"field": "spend", "direction": "asc"}}}}}
	envelope["state"].(map[string]any)["selectedMeasures"] = []string{"a"}
	encoded, _ := json.Marshal(envelope)
	// This test authors a fresh synthetic envelope and its matching builder pin.
	// Runtime validation must never repair a mismatched existing pin.
	var pinned registry.ReportEnvelope
	if err = json.Unmarshal(encoded, &pinned); err != nil {
		t.Fatal(err)
	}
	for i := range pinned.Dependencies {
		dependency := &pinned.Dependencies[i]
		switch dependency.Kind {
		case "builder":
			dependency.ContentFingerprint = identity.ContentFingerprint(pinned.BuilderDefinition)
		case "report":
			dependency.ContentFingerprint = identity.ContentFingerprint(pinned.ReportDocument)
		case "datasource":
			dependency.ContentFingerprint = identity.ContentFingerprint(pinned.DataSources[dependency.ID])
		}
	}
	pinned.Dependencies = append(pinned.Dependencies, registry.ReportDependency{Kind: "report", ID: "report://example/pipeline", ContentFingerprint: identity.ContentFingerprint(pinned.ReportDocument)})
	if err = validateEnvelope(pinned); err != nil {
		t.Fatalf("invalid synthetic envelope: %v", err)
	}
	encoded, _ = json.Marshal(pinned)
	if _, err = Lower(context.Background(), encoded); err == nil || !strings.Contains(err.Error(), "cycle: a, b") {
		t.Fatalf("expected authoring cycle IDs, got %v", err)
	}
}
