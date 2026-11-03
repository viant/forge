package materializer_test

import (
	"bytes"
	"context"
	"encoding/json"
	reporting "github.com/viant/forge/backend/reporting/engine"
	"github.com/viant/forge/backend/reporting/materializer"
	"os"
	"strings"
	"testing"

	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func comparisonValidationEnvelope(t *testing.T, scope, state string, paths ...string) json.RawMessage {
	t.Helper()
	raw, err := os.ReadFile("testdata/authored-envelope.json")
	if err != nil {
		t.Fatal(err)
	}
	var envelope registry.ReportEnvelope
	if err = json.Unmarshal(raw, &envelope); err != nil {
		t.Fatal(err)
	}
	envelope.BuilderDefinition = json.RawMessage(`{"kind":"forge.reporting.builder","id":"sampleBuilder","reportBuilder":{"dataSourceRef":"sampleRows","measures":[{"key":"spend","id":"spend","label":"Spend","paramPath":"measures.spend","default":true}],"predicates":[{"id":"dates","kind":"dateRange","startParamPath":"filters.from","endParamPath":"filters.to"}],"dataSources":[{"id":"prior","dataSourceRef":"sampleRows","request":{"filters":{},"measures":{"spend":true}},"scope":` + scope + `}]}}`)
	if len(paths) == 2 {
		envelope.BuilderDefinition = json.RawMessage(strings.ReplaceAll(strings.ReplaceAll(string(envelope.BuilderDefinition), "filters.from", paths[0]), "filters.to", paths[1]))
	}
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Comparison","blocks":[{"id":"current","kind":"kpiBlock","datasetRef":"primary","valueField":"spend","secondaryDatasetRef":"prior","secondaryField":"spend","secondaryCalculation":"relativeChange"}]}`)
	envelope.State = json.RawMessage(state)
	for id, descriptor := range envelope.DataSources {
		var compact bytes.Buffer
		if err := json.Compact(&compact, descriptor); err != nil {
			t.Fatal(err)
		}
		envelope.DataSources[id] = compact.Bytes()
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
	return raw
}

func TestSourceValidationPreviousPeriod(t *testing.T) {
	scope := `{"mode":"override","local":{"filters":{"region":"north"}},"relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}}`
	raw := comparisonValidationEnvelope(t, scope, `{"selectedMeasures":["spend"]}`)
	before := append([]byte(nil), raw...)
	spec, err := materializer.LowerForValidation(context.Background(), raw)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(raw, before) {
		t.Fatal("validation mutated fingerprinted input")
	}
	var out struct {
		Datasets []struct {
			ID      string `json:"id"`
			Request struct {
				Filters map[string]any `json:"filters"`
			} `json:"request"`
		} `json:"datasets"`
	}
	if err := json.Unmarshal(spec, &out); err != nil {
		t.Fatal(err)
	}
	foundPrior := false
	for _, ds := range out.Datasets {
		if ds.ID == "prior" {
			foundPrior = true
		}
		if ds.ID == "prior" && (ds.Request.Filters["region"] != "north" || ds.Request.Filters["from"] != nil || ds.Request.Filters["to"] != nil) {
			t.Fatalf("validation lost scope or invented dates: %s", spec)
		}
	}
	if !foundPrior {
		t.Fatal("prior dataset missing from validation spec")
	}
	if _, err := reporting.NewReportSpecCompiler(nil).Compile(context.Background(), &reporting.CompileRequest{SourceKind: reporting.SourceKindReportSpec, Document: spec}); err != nil {
		t.Fatal(err)
	}
	if _, err := materializer.Lower(context.Background(), raw); err == nil {
		t.Fatal("runtime accepted unbounded previous period")
	}
	bound, err := materializer.LowerWithRequestBase(context.Background(), raw, map[string]interface{}{"filters": map[string]interface{}{"from": "2026-08-01", "to": "2026-08-30"}})
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(bound, &out); err != nil {
		t.Fatal(err)
	}
	foundPrior = false
	for _, ds := range out.Datasets {
		if ds.ID == "prior" {
			foundPrior = true
			if ds.Request.Filters["from"] != "2026-07-02" || ds.Request.Filters["to"] != "2026-07-31" {
				t.Fatalf("wrong bounded previous period: %s", bound)
			}
		}
	}
	if !foundPrior {
		t.Fatal("prior dataset missing from runtime spec")
	}
	if _, err := materializer.LowerWithRequestBase(context.Background(), raw, map[string]interface{}{"filters": map[string]interface{}{"from": "2026-02-30", "to": "2026-03-01"}}); err == nil {
		t.Fatal("runtime accepted invalid dates")
	}
}

func TestSourceValidationRejectsInvalidRelativeScope(t *testing.T) {
	for name, scope := range map[string]string{
		"mode":           `{"mode":"inherit","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}}`,
		"missing-path":   `{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from"}}`,
		"unknown-preset": `{"mode":"override","relativeDateRange":{"preset":"unsupported","startParamPath":"filters.from","endParamPath":"filters.to"}}`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := materializer.LowerForValidation(context.Background(), comparisonValidationEnvelope(t, scope, `{"selectedMeasures":["spend"]}`)); err == nil {
				t.Fatal("invalid source scope accepted")
			}
		})
	}
	scope := `{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}}`
	for name, state := range map[string]string{
		"partial":  `{"scopeParams":{"dates":{"start":"2026-08-01"}}}`,
		"invalid":  `{"scopeParams":{"dates":{"start":"2026-02-30","end":"2026-03-01"}}}`,
		"reversed": `{"scopeParams":{"dates":{"start":"2026-08-30","end":"2026-08-01"}}}`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := materializer.LowerForValidation(context.Background(), comparisonValidationEnvelope(t, scope, state)); err == nil {
				t.Fatal("supplied invalid dates accepted")
			}
		})
	}
}

func TestSourceValidationAlternateDatePathsAndProvenance(t *testing.T) {
	scope := `{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}}`
	raw := comparisonValidationEnvelope(t, scope, `{"selectedMeasures":["spend"]}`, "filters.begin", "filters.finish")
	if _, err := materializer.LowerForValidation(context.Background(), raw); err != nil {
		t.Fatal(err)
	}
	bound, err := materializer.LowerWithRequestBase(context.Background(), raw, map[string]interface{}{"filters": map[string]interface{}{"begin": "2026-08-01", "finish": "2026-08-30"}})
	if err != nil {
		t.Fatal(err)
	}
	var spec struct {
		Datasets []struct {
			ID      string `json:"id"`
			Request struct {
				Filters map[string]any `json:"filters"`
			} `json:"request"`
		} `json:"datasets"`
	}
	if err := json.Unmarshal(bound, &spec); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, ds := range spec.Datasets {
		if ds.ID == "prior" {
			found = true
			if ds.Request.Filters["begin"] != "2026-07-02" || ds.Request.Filters["finish"] != "2026-07-31" {
				t.Fatalf("alternate binding failed: %s", bound)
			}
		}
	}
	if !found {
		t.Fatal("alternate prior dataset missing")
	}
	var envelope registry.ReportEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		t.Fatal(err)
	}
	envelope.BuilderDefinition = bytes.Replace(envelope.BuilderDefinition, []byte(`"label":"Spend"`), []byte(`"label":"Changed"`), 1)
	corrupted, err := json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := materializer.LowerForValidation(context.Background(), corrupted); err == nil {
		t.Fatal("source validation bypassed provenance")
	}
}
