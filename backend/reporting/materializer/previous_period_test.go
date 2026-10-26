package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestBundledAuthoredPreviousPeriod(t *testing.T) {
	raw, err := os.ReadFile("testdata/authored-envelope.json")
	if err != nil {
		t.Fatal(err)
	}
	var envelope registry.ReportEnvelope
	if err = json.Unmarshal(raw, &envelope); err != nil {
		t.Fatal(err)
	}
	// This is a synthetic definition using the ordinary fingerprinted envelope.
	envelope.BuilderDefinition = json.RawMessage(`{"kind":"forge.reporting.builder","id":"sampleBuilder","reportBuilder":{"dataSourceRef":"sampleRows","measures":[{"key":"spend","id":"spend","label":"Spend","paramPath":"measures.spend","default":true}],"staticFilters":[{"id":"dateRange","type":"dateRange","startParamPath":"filters.from","endParamPath":"filters.to","default":{"start":"2026-09-21","end":"2026-10-20"}}],"dataSources":[{"id":"prior","dataSourceRef":"sampleRows","request":{"filters":{},"measures":{"spend":true}},"scope":{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}}}]}}`)
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Comparison","blocks":[{"id":"current","kind":"kpiBlock","datasetRef":"primary","valueField":"spend","secondaryDatasetRef":"prior","secondaryField":"spend","secondaryCalculation":"relativeChange","secondaryLabel":"Change vs prior period","secondaryFormat":"percentFraction","secondaryTrend":true}]}`)
	envelope.State = json.RawMessage(`{"selectedMeasures":["spend"],"scopeParams":{"dateRange":{"start":"2026-09-21","end":"2026-10-20"}}}`)
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
		"primary": json.RawMessage(`{"rows":[{"spend":80}]}`),
		"prior":   json.RawMessage(`{"rows":[{"spend":100}]}`),
	})
	if err != nil {
		t.Fatal(err)
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
