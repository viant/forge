package materializer

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// Independently authored categories and measures exercise the embedded lowerer.
func TestHorizontalMetricSelection(t *testing.T) {
	spec, err := os.ReadFile("testdata/horizontal-metrics.json")
	if err != nil {
		t.Fatal(err)
	}
	var model struct {
		Blocks []struct {
			ID   string `json:"id"`
			Kind string `json:"kind"`
		} `json:"blocks"`
	}
	if err := json.Unmarshal(spec, &model); err != nil {
		t.Fatal(err)
	}
	id := ""
	for _, block := range model.Blocks {
		if block.Kind == "chartBlock" {
			id = block.ID
		}
	}
	if id == "" {
		t.Fatal("missing chart")
	}
	for _, choice := range []struct{ field, label string }{{"amount", "$20"}, {"count", "2K"}, {"ratio", "2.00%"}} {
		selected, err := Present(context.Background(), spec, map[string]ChartMetricSelection{id: {PrimaryField: choice.field}})
		if err != nil {
			t.Fatal(err)
		}
		artifacts, err := Materialize(context.Background(), selected, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"category":"Alpha","amount":10,"count":1000,"ratio":0.01},{"category":"Beta","amount":20,"count":2000,"ratio":0.02}]}`)})
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(artifacts.ReportPrint), choice.label) {
			t.Fatalf("missing selected %s print label", choice.field)
		}
		if !strings.Contains(string(artifacts.ReportFill), `"type":"horizontal_bar"`) {
			t.Fatal("orientation lost")
		}
	}
	if _, err := Present(context.Background(), spec, map[string]ChartMetricSelection{id: {PrimaryField: "amount", SecondaryField: "ratio"}}); err == nil {
		t.Fatal("secondary horizontal metric accepted")
	}
}
