package materializer

import (
	"encoding/json"
	"testing"

	identity "github.com/viant/forge/backend/resource"
)

func TestCalculationDatasetScopesThroughNativeBundle(t *testing.T) {
	t.Run("sharedOutputKey", func(t *testing.T) { testCalculationDatasetScope(t, false) })
	t.Run("delimiterSafeTuple", func(t *testing.T) { testCalculationDatasetScope(t, true) })
}

func testCalculationDatasetScope(t *testing.T, colonIdentity bool) {
	// Independent synthetic authoring: same transport and output key, distinct logical scopes.
	envelope := fingerprintEnvelope()
	envelope.BuilderDefinition = json.RawMessage(`{"id":"builder","reportBuilder":{"dataSourceRef":"rows","measures":[{"id":"input","key":"input","label":"Input"}],"calculatedFields":[{"id":"forecastAdjusted","key":"adjusted","datasetRef":"forecast","expr":"input * 2"},{"id":"observedAdjusted","key":"adjusted","datasetRef":"observed","expr":"input * 3"}],"dataSources":[{"id":"forecast","dataSourceRef":"rows","request":{"measures":{"input":true}}},{"id":"observed","dataSourceRef":"rows","request":{"measures":{"input":true}}}]}}`)
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","id":"scoped","title":"Scoped calculations","blocks":[{"id":"forecastTable","kind":"tableBlock","datasetRef":"forecast","columns":[{"key":"input","label":"Input"},{"key":"adjusted","label":"Adjusted"}]},{"id":"observedTable","kind":"tableBlock","datasetRef":"observed","columns":[{"key":"input","label":"Input"},{"key":"adjusted","label":"Adjusted"}]}]}`)
	envelope.State = json.RawMessage(`{"selectedMeasures":["input"]}`)
	firstScope, secondScope, firstKey, secondKey := "forecast", "observed", "adjusted", "adjusted"
	if colonIdentity {
		firstScope, secondScope, firstKey, secondKey = "a:b", "a", "first", "second"
		var builder, document map[string]any
		if err := json.Unmarshal(envelope.BuilderDefinition, &builder); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(envelope.ReportDocument, &document); err != nil {
			t.Fatal(err)
		}
		config := builder["reportBuilder"].(map[string]any)
		for index, field := range config["calculatedFields"].([]any) {
			calculation := field.(map[string]any)
			calculation["datasetRef"] = []string{firstScope, secondScope}[index]
			calculation["id"] = []string{"x", "b:x"}[index]
			calculation["key"] = []string{firstKey, secondKey}[index]
		}
		for index, source := range config["dataSources"].([]any) {
			source.(map[string]any)["id"] = []string{firstScope, secondScope}[index]
		}
		for index, entry := range document["blocks"].([]any) {
			block := entry.(map[string]any)
			block["datasetRef"] = []string{firstScope, secondScope}[index]
			block["columns"].([]any)[1].(map[string]any)["key"] = []string{firstKey, secondKey}[index]
		}
		envelope.BuilderDefinition, _ = json.Marshal(builder)
		envelope.ReportDocument, _ = json.Marshal(document)
		envelope.State = json.RawMessage(`{"selectedMeasures":["x","b:x"]}`)
	}
	for i := range envelope.Dependencies {
		dep := &envelope.Dependencies[i]
		switch dep.Kind {
		case "builder":
			dep.ContentFingerprint = identity.ContentFingerprint(envelope.BuilderDefinition)
		case "report":
			dep.ContentFingerprint = identity.ContentFingerprint(envelope.ReportDocument)
		}
	}
	encoded, err := json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	spec, err := Lower(t.Context(), encoded)
	if err != nil {
		t.Fatal(err)
	}
	result, err := Materialize(t.Context(), spec, map[string]json.RawMessage{firstScope: json.RawMessage(`{"rows":[{"input":10}]}`), secondScope: json.RawMessage(`{"rows":[{"input":10}]}`)})
	if err != nil {
		t.Fatal(err)
	}
	var fill struct {
		Datasets []struct {
			ID   string               `json:"id"`
			Rows []map[string]float64 `json:"rows"`
		} `json:"datasets"`
	}
	if err = json.Unmarshal(result.ReportFill, &fill); err != nil {
		t.Fatal(err)
	}
	found := 0
	for _, dataset := range fill.Datasets {
		expected, ok := map[string]float64{firstScope: 20, secondScope: 30}[dataset.ID]
		if !ok {
			continue
		}
		found++
		if len(dataset.Rows) != 1 || dataset.Rows[0][map[string]string{firstScope: firstKey, secondScope: secondKey}[dataset.ID]] != expected {
			t.Fatalf("wrong scoped rows for %s: %+v", dataset.ID, dataset.Rows)
		}
	}
	if found != 2 {
		t.Fatalf("missing logical datasets: %s", result.ReportFill)
	}
	var print struct {
		Pages []struct {
			Elements []struct {
				Text string `json:"text"`
			} `json:"elements"`
		} `json:"pages"`
	}
	if err = json.Unmarshal(result.ReportPrint, &print); err != nil {
		t.Fatal(err)
	}
	texts := map[string]bool{}
	for _, page := range print.Pages {
		for _, element := range page.Elements {
			texts[element.Text] = true
		}
	}
	if !texts["20"] || !texts["30"] {
		t.Fatalf("scoped values absent from native print: %v", texts)
	}
}
