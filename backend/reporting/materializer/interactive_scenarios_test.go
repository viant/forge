package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// Independently invented fixtures exercise the same embedded renderer as web
// print. Run with a reviewed rebuilt bundle, never a dirty-checkout bundle.
func TestInteractiveScenarioMaterialization(t *testing.T) {
	for _, name := range []string{"routing-impact", "stage-allocation", "stage-allocation-ratio"} {
		t.Run(name, func(t *testing.T) {
			chartType := strings.TrimSuffix(name, "-ratio")
			fixture, err := os.ReadFile("../../../doc/examples/" + chartType + ".json")
			if err != nil {
				t.Fatal(err)
			}
			var example struct {
				ChartSpec map[string]any   `json:"chartSpec"`
				Rows      []map[string]any `json:"rows"`
			}
			if err = json.Unmarshal(fixture, &example); err != nil {
				t.Fatal(err)
			}
			raw, err := os.ReadFile("testdata/presentation-report.json")
			if err != nil {
				t.Fatal(err)
			}
			var spec map[string]any
			if err = json.Unmarshal(raw, &spec); err != nil {
				t.Fatal(err)
			}
			key, x, y, label := "routingImpact", "id", "amount", "Projected delivery"
			filters := map[string]any{"share": 1, "categories": []string{"ambient", "chilled"}}
			if chartType == "stage-allocation" {
				key, x, y, label = "stageAllocation", "period", "energy", "Value"
				metric := "value"
				if strings.HasSuffix(name, "-ratio") {
					metric, label = "efficiency", "Efficiency"
				}
				filters = map[string]any{"period": "summer", "metric": metric, "activeCategories": []string{"hydro"}}
			}
			example.ChartSpec["xField"] = x
			example.ChartSpec["yFields"] = []string{y}
			chart := map[string]any{"type": chartType, key: example.ChartSpec[key], "series": map[string]any{"valueKey": y, "values": []any{map[string]any{"value": y, "label": y, "type": "bar"}}}}
			spec["blocks"] = []any{map[string]any{"id": "scenario", "kind": "chartBlock", "datasetRef": "primary", "chartSpec": example.ChartSpec, "chartModel": chart}}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"scenario"}}
			datasets := spec["datasets"].([]any)
			datasets[0].(map[string]any)["request"].(map[string]any)["filters"] = filters
			raw, err = json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			payload, _ := json.Marshal(map[string]any{"rows": example.Rows})
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(string(artifacts.ReportFill), `"scenarioState"`) {
				t.Fatal("scenario snapshot missing")
			}
			report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			if err != nil {
				t.Fatal(err)
			}
			rendered, err := reportpdf.Render(report, reportpdf.Options{})
			if err != nil {
				t.Fatal(err)
			}
			if len(rendered.Diagnostics) != 0 {
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
			if !strings.Contains(string(content), label) {
				t.Fatalf("PDF lost current scenario labels: %s", content)
			}
			if name == "stage-allocation-ratio" {
				for _, text := range []string{"Efficiency: 2.7", "Hydro: 4 credits/MWh", "pooled numerator / denominator"} {
					if !strings.Contains(string(content), text) {
						t.Fatalf("ratio PDF lost %q: %s", text, content)
					}
				}
			}
			if name == "stage-allocation" {
				var printData struct {
					Pages []struct {
						Elements []struct {
							SVG string `json:"svg"`
						} `json:"elements"`
					} `json:"pages"`
				}
				if err = json.Unmarshal(artifacts.ReportPrint, &printData); err != nil {
					t.Fatal(err)
				}
				for _, legend := range []string{"3. Hydro: 160 credits", "3. Hydro: 140 credits", "3. Hydro: 120 credits"} {
					found := false
					for _, page := range printData.Pages {
						for _, element := range page.Elements {
							if strings.Contains(element.SVG, `data-stage-legend="true">`+legend) {
								found = true
							}
						}
					}
					if !found {
						t.Fatalf("stage graphic lost same-page legend %q", legend)
					}
				}
			}
			if directory := os.Getenv("SCENARIO_ARTIFACT_DIR"); directory != "" {
				if err = os.MkdirAll(directory, 0755); err != nil {
					t.Fatal(err)
				}
				if err = os.WriteFile(directory+"/"+name+".pdf", rendered.Bytes, 0600); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}
