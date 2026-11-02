package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	"os"
	"reflect"
	"testing"

	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestBoundedAuthoredDatasetScopeTypedContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/authored-envelope.json")
	if err != nil {
		t.Fatal(err)
	}
	var envelope registry.ReportEnvelope
	if err = json.Unmarshal(raw, &envelope); err != nil {
		t.Fatal(err)
	}
	// This is a synthetic definition using the ordinary fingerprinted envelope.
	envelope.BuilderDefinition = json.RawMessage(`{"kind":"forge.reporting.builder","id":"sampleBuilder","reportBuilder":{"dataSourceRef":"sampleRows","measures":[{"key":"amount","id":"amount","label":"Amount","paramPath":"measures.amount","default":true}],"staticFilters":[{"id":"dateRange","type":"dateRange","startParamPath":"filters.from","endParamPath":"filters.to","default":{"start":"2026-09-21","end":"2026-10-20"}}],"dataSources":[{"id":"prior","dataSourceRef":"sampleRows","request":{"filters":{},"measures":{"amount":true},"limit":25,"offset":0},"scope":{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}}}]}}`)
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Comparison","blocks":[{"id":"current","kind":"kpiBlock","datasetRef":"primary","valueField":"amount","secondaryDatasetRef":"prior","secondaryField":"amount","secondaryCalculation":"relativeChange","secondaryLabel":"Change vs prior period","secondaryFormat":"percentFraction","secondaryTrend":true}]}`)
	envelope.State = json.RawMessage(`{"selectedMeasures":["amount"],"scopeParams":{"dateRange":{"start":"2026-09-21","end":"2026-10-20"}}}`)
	for id, descriptor := range envelope.DataSources {
		var compact bytes.Buffer
		if err := json.Compact(&compact, descriptor); err != nil {
			t.Fatal(err)
		}
		envelope.DataSources[id] = json.RawMessage(compact.Bytes())
	}
	envelope.Dependencies = []registry.ReportDependency{
		{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)},
		{Kind: "datasource", ID: "sampleRows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["sampleRows"])},
		{Kind: "report", ID: "report://example/comparison", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)},
	}
	raw, err = json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	spec, err := Lower(context.Background(), raw)
	if err != nil {
		t.Fatal(err)
	}
	validateScopeMetadataBoundaries(t, spec)
	typed, err := reportspec.DecodeJSON(spec)
	if err != nil {
		t.Fatalf("strict bounded spec: %v", err)
	}
	roundtrip, err := json.Marshal(typed)
	if err != nil {
		t.Fatal(err)
	}
	var before, after map[string]any
	if err = json.Unmarshal(spec, &before); err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(roundtrip, &after); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before["datasets"], after["datasets"]) {
		t.Fatalf("typed spec changed dataset metadata or requests: before %s after %s", spec, roundtrip)
	}
	spec = roundtrip
	var out struct {
		Datasets []struct {
			ID      string `json:"id"`
			Request struct {
				Filters map[string]interface{} `json:"filters"`
			} `json:"request"`
		} `json:"datasets"`
	}
	if err = json.Unmarshal(spec, &out); err != nil {
		t.Fatal(err)
	}
	artifacts, err := Materialize(context.Background(), spec, map[string]json.RawMessage{
		"primary": json.RawMessage(`{"rows":[{"amount":80}]}`),
		"prior":   json.RawMessage(`{"rows":[{"amount":100}]}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	typedFill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	if err != nil {
		t.Fatalf("strict bounded fill: %v", err)
	}
	for _, dataset := range typedFill.Datasets {
		if dataset.ID == "prior" {
			scope, err := json.Marshal(dataset.Scope)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Contains(scope, []byte(`"preset":"previousperiod"`)) {
				t.Fatalf("prior scope lost: %s", scope)
			}
		}
	}
	var fill struct {
		Blocks []struct {
			ID      string `json:"id"`
			Content struct {
				Value          float64  `json:"value"`
				SecondaryValue *float64 `json:"secondaryValue"`
			} `json:"content"`
		} `json:"blocks"`
	}
	if err = json.Unmarshal(artifacts.ReportFill, &fill); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, block := range fill.Blocks {
		if block.ID == "current" {
			found = true
			if block.Content.Value != 80 || block.Content.SecondaryValue == nil || *block.Content.SecondaryValue != -.2 {
				t.Fatalf("comparison not materialized: %s", artifacts.ReportFill)
			}
		}
	}
	if !found {
		t.Fatal("comparison KPI missing")
	}
	seen := map[string]map[string]interface{}{}
	for _, ds := range out.Datasets {
		seen[ds.ID] = ds.Request.Filters
	}
	if seen["primary"]["from"] != "2026-09-21" || seen["primary"]["to"] != "2026-10-20" || seen["prior"]["from"] != "2026-08-22" || seen["prior"]["to"] != "2026-09-20" {
		t.Fatalf("wrong bounded comparison: %s", spec)
	}
}

func validateScopeMetadataBoundaries(t *testing.T, spec []byte) {
	t.Helper()
	for _, scope := range []string{
		``, `{"mode":"inherit"}`, `{"mode":"append","local":{"grain":"day"}}`,
		`{"mode":"override","local":{"grain":"week"}}`, `{"mode":"exclude","exclude":["window"]}`,
		`{"inheritContext":false,"grain":"day","producerMetadata":{"version":1}}`,
		`{"mode":"override","relativeDateRange":{"startExpression":"today-6d","endExpression":"today","format":"yyyy-MM-dd","startParamPath":"filters.from","endParamPath":"filters.to"}}`,
	} {
		t.Run("scope boundary/"+scope, func(t *testing.T) {
			var raw map[string]any
			if err := json.Unmarshal(spec, &raw); err != nil {
				t.Fatal(err)
			}
			for _, item := range raw["datasets"].([]any) {
				dataset := item.(map[string]any)
				if dataset["id"] == "prior" {
					if scope == "" {
						delete(dataset, "scope")
					} else {
						var value any
						if err := json.Unmarshal([]byte(scope), &value); err != nil {
							t.Fatal(err)
						}
						dataset["scope"] = value
					}
				}
			}
			encoded, err := json.Marshal(raw)
			if err != nil {
				t.Fatal(err)
			}
			typed, err := reportspec.DecodeJSON(encoded)
			if err != nil {
				t.Fatal(err)
			}
			roundtrip, err := json.Marshal(typed)
			if err != nil {
				t.Fatal(err)
			}
			var decoded map[string]any
			if err = json.Unmarshal(roundtrip, &decoded); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(raw["datasets"], decoded["datasets"]) {
				t.Fatalf("scope roundtrip changed datasets: %s", roundtrip)
			}
			artifacts, err := Materialize(t.Context(), roundtrip, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"amount":80}]}`), "prior": json.RawMessage(`{"rows":[{"amount":100}]}`)})
			if err != nil {
				t.Fatal(err)
			}
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			if err != nil {
				t.Fatal(err)
			}
			var rawFill struct {
				Datasets []struct {
					ID    string          `json:"id"`
					Scope json.RawMessage `json:"scope"`
				} `json:"datasets"`
			}
			if err = json.Unmarshal(artifacts.ReportFill, &rawFill); err != nil {
				t.Fatal(err)
			}
			for _, dataset := range fill.Datasets {
				if dataset.ID == "prior" {
					var expected json.RawMessage
					for _, rawDataset := range rawFill.Datasets {
						if rawDataset.ID == dataset.ID {
							expected = rawDataset.Scope
						}
					}
					if len(expected) == 0 {
						if dataset.Scope != nil {
							t.Fatalf("omitted scope became %+v", dataset.Scope)
						}
						continue
					}
					output, err := json.Marshal(dataset.Scope)
					if err != nil {
						t.Fatal(err)
					}
					var want, got any
					if err = json.Unmarshal(expected, &want); err != nil {
						t.Fatal(err)
					}
					if err = json.Unmarshal(output, &got); err != nil {
						t.Fatal(err)
					}
					if !reflect.DeepEqual(want, got) {
						t.Fatalf("strict fill lost scope metadata: got %s want %s", output, expected)
					}
				}
			}
			// Only the scope object is open; dataset properties remain strict.
			for _, item := range raw["datasets"].([]any) {
				item.(map[string]any)["unknownDatasetProperty"] = true
			}
			invalid, err := json.Marshal(raw)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = reportspec.DecodeJSON(invalid); err == nil {
				t.Fatal("accepted unknown dataset property")
			}
		})
	}
}
