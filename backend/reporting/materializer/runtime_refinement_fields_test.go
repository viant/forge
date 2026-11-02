package materializer

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/viant/forge/backend/reporting/registry"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	identity "github.com/viant/forge/backend/resource"
)

// Independently authored neutral source. Several logical datasets share a
// producer and a field name; the portable block catalog must retain identity.
func refinementFieldsEnvelope(t *testing.T) registry.ReportEnvelope {
	t.Helper()
	builder := json.RawMessage(`{"kind":"forge.reporting.builder","id":"regionalBuilder","reportBuilder":{"title":"Regional evidence","dataSourceRef":"rows","dimensions":[{"id":"region","key":"region","label":"Global region","paramPath":"dimensions.region","runtimeFilter":{"includeParamPath":"filters.values.globalRegions"}}],"measures":[{"id":"count","key":"count","label":"Count","paramPath":"measures.count","default":true}],"dataSources":[{"id":"regional","dataSourceRef":"rows","columnOptions":[{"key":"region","label":"Region","kind":"dimension","runtimeFilter":{"includeParamPath":"filters.values.regions"}},{"key":"category","label":"Category","kind":"dimension"},{"key":"count","label":"Count","kind":"measure"}],"request":{"limit":25,"offset":0,"filters":{},"dimensions":{"region":true,"category":true},"measures":{"count":true}}},{"id":"comparison","dataSourceRef":"rows","columnOptions":[{"key":"region","label":"Comparison region","kind":"dimension","runtimeFilter":{"includeParamPath":"filters.values.comparisonRegions"}},{"key":"count","label":"Count","kind":"measure"}],"request":{"limit":25,"offset":0,"filters":{},"dimensions":{"region":true},"measures":{"count":true}}}],"result":{"defaultMode":"table","pageSize":10}}}`)
	document := json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Regional evidence","blocks":[{"id":"regionalChart","kind":"chartBlock","datasetRef":"regional","chartSpec":{"type":"bar","xField":"region","yFields":["count"]}},{"id":"regionalTable","kind":"tableBlock","datasetRef":"regional","columns":[{"key":"region","label":"Region"},{"key":"count","label":"Count"}]},{"id":"comparisonChart","kind":"chartBlock","datasetRef":"comparison","chartSpec":{"type":"bar","xField":"region","yFields":["count"]}}]}`)
	source := json.RawMessage(`{"id":"rows","cardinality":"collection","backend":{"kind":"inline","rows":[]}}`)
	return registry.ReportEnvelope{SchemaVersion: 1, Format: registry.AuthoredReportFormat, BuilderRef: "regionalBuilder", BuilderDefinition: builder, ReportDocument: document, State: json.RawMessage(`{"selectedDimensions":["region"],"selectedMeasures":["count"],"viewMode":"table"}`), DataSources: map[string]json.RawMessage{"rows": source}, Dependencies: []registry.ReportDependency{
		{Kind: "builder", ID: "regionalBuilder", ContentFingerprint: identity.ContentFingerprint(builder)},
		{Kind: "datasource", ID: "rows", ContentFingerprint: identity.ContentFingerprint(source)},
		{Kind: "report", ID: "report://example/regional", ContentFingerprint: identity.ContentFingerprint(document)},
	}}
}

func TestRuntimeRefinementFieldsNativeLoweringRoundTrip(t *testing.T) {
	envelope := refinementFieldsEnvelope(t)
	raw, err := json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	lowered, err := Lower(t.Context(), raw)
	if err != nil {
		t.Fatal(err)
	}
	typed, err := reportspec.DecodeJSON(lowered)
	if err != nil {
		t.Fatal(err)
	}
	roundtrip, err := json.Marshal(typed)
	if err != nil {
		t.Fatal(err)
	}
	var portable struct {
		Blocks []struct {
			ID, Kind, DatasetRef string
			Runtime              map[string]any `json:"runtime"`
		}
	}
	if err = json.Unmarshal(roundtrip, &portable); err != nil {
		t.Fatal(err)
	}
	found := map[string]bool{}
	for _, block := range portable.Blocks {
		want := ""
		switch block.ID {
		case "regionalChart", "regionalTable":
			want = "filters.values.regions"
		case "comparisonChart":
			want = "filters.values.comparisonRegions"
		default:
			continue
		}
		found[block.ID] = true
		fields, ok := block.Runtime["refinementFields"].([]any)
		if !ok || len(fields) != 1 {
			t.Fatalf("%s lost admitted field metadata: %#v", block.ID, block.Runtime)
		}
		field := fields[0].(map[string]any)
		if field["runtimeFilter"].(map[string]any)["includeParamPath"] != want {
			t.Fatalf("%s borrowed another dataset binding: %#v", block.ID, field)
		}
	}
	if len(found) != 3 {
		t.Fatalf("missing compiled blocks: %#v", found)
	}
	var before, after map[string]any
	if err = json.Unmarshal(lowered, &before); err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(roundtrip, &after); err != nil {
		t.Fatal(err)
	}
	beforeBlocks := before["blocks"].([]any)
	afterBlocks := after["blocks"].([]any)
	for index, block := range beforeBlocks {
		if !reflect.DeepEqual(block.(map[string]any)["runtime"], afterBlocks[index].(map[string]any)["runtime"]) {
			t.Fatalf("native roundtrip lost runtime metadata for block %d", index)
		}
	}
}

func TestRuntimeRefinementFieldsNativeAuthoredOptOutAndInjection(t *testing.T) {
	for _, mode := range []string{"empty", "declared", "injected"} {
		t.Run(mode, func(t *testing.T) {
			envelope := refinementFieldsEnvelope(t)
			var document map[string]any
			if err := json.Unmarshal(envelope.ReportDocument, &document); err != nil {
				t.Fatal(err)
			}
			for _, value := range document["blocks"].([]any) {
				block := value.(map[string]any)
				if block["id"] != "regionalChart" && block["id"] != "regionalTable" {
					continue
				}
				fields := []any{}
				if mode != "empty" {
					path := "filters.values.regions"
					if mode == "injected" {
						path = "filters.values.globalRegions"
					}
					fields = append(fields, map[string]any{"key": "region", "runtimeFilter": map[string]any{"includeParamPath": path}})
				}
				block["runtime"] = map[string]any{"refinementFields": fields}
			}
			var err error
			envelope.ReportDocument, err = json.Marshal(document)
			if err != nil {
				t.Fatal(err)
			}
			for index, dependency := range envelope.Dependencies {
				if dependency.Kind == "report" {
					envelope.Dependencies[index].ContentFingerprint = identity.ContentFingerprint(envelope.ReportDocument)
				}
			}
			raw, err := json.Marshal(envelope)
			if err != nil {
				t.Fatal(err)
			}
			lowered, err := Lower(t.Context(), raw)
			if mode == "injected" {
				if err == nil {
					t.Fatal("undeclared explicit binding was accepted")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			typed, err := reportspec.DecodeJSON(lowered)
			if err != nil {
				t.Fatal(err)
			}
			for _, block := range typed.Blocks {
				if block.ID != "regionalChart" && block.ID != "regionalTable" {
					continue
				}
				fields, ok := block.Runtime["refinementFields"].([]any)
				want := 0
				if mode == "declared" {
					want = 1
				}
				if !ok || len(fields) != want {
					t.Fatalf("%s.%s changed authored catalog: %#v", mode, block.ID, block.Runtime)
				}
			}
		})
	}
}
