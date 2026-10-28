package materializer

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestNativeDonutRejectsUntranslatedHiddenAngleGeometry(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/donut-conversion-preview.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		ReportSpec map[string]any             `json:"reportSpec"`
		Datasets   map[string]json.RawMessage `json:"datasets"`
	}
	if err = json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, entry := range fixture.ReportSpec["blocks"].([]any) {
		block := entry.(map[string]any)
		if block["kind"] != "chartBlock" {
			continue
		}
		block["runtime"] = map[string]any{"rowVisibility": map[string]any{"exclude": []any{map[string]any{"field": "category", "values": []any{"Unclassified"}}}}}
		found = true
	}
	if !found {
		t.Fatal("fixture has no chart")
	}
	spec, err := json.Marshal(fixture.ReportSpec)
	if err != nil {
		t.Fatal(err)
	}
	_, err = MaterializeFill(context.Background(), spec, fixture.Datasets)
	if err == nil || !strings.Contains(err.Error(), "hidden-angle") {
		t.Fatalf("native bundle must reject unsupported hidden angles: %v", err)
	}
}
