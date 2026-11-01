package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/viant/forge/backend/reporting/export/pdf"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/xuri/excelize/v2"

	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestKPISecondaryTypedContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/authored-envelope.json")
	if err != nil {
		t.Fatal(err)
	}
	var envelope registry.ReportEnvelope
	if err = json.Unmarshal(raw, &envelope); err != nil {
		t.Fatal(err)
	}
	// This is a synthetic definition using the ordinary fingerprinted envelope.
	envelope.BuilderDefinition = json.RawMessage(`{"kind":"forge.reporting.builder","id":"sampleBuilder","reportBuilder":{"dataSourceRef":"sampleRows","measures":[{"key":"amount","id":"amount","label":"Amount","paramPath":"measures.amount","default":true}],"dataSources":[{"id":"prior","dataSourceRef":"sampleRows","request":{"filters":{},"measures":{"amount":true},"limit":25,"offset":0}}]}}`)
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Comparison","blocks":[{"id":"current","kind":"kpiBlock","datasetRef":"primary","valueField":"amount","secondaryDatasetRef":"prior","secondaryField":"amount","secondaryCalculation":"relativeChange","secondaryLabel":"Change vs prior period","secondaryFormat":"percentFraction","secondaryTrend":true}]}`)
	envelope.State = json.RawMessage(`{"selectedMeasures":["amount"]}`)
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
	typed, err := reportspec.DecodeJSON(spec)
	if err != nil {
		t.Fatalf("strict lowered spec: %v", err)
	}
	for _, block := range typed.Blocks {
		if block.ID == "current" && (block.SecondaryDatasetRef != "prior" || block.SecondaryCalculation != "relativeChange") {
			t.Fatalf("typed spec lost comparison: %+v", block)
		}
	}
	spec, err = json.Marshal(typed)
	if err != nil {
		t.Fatal(err)
	}
	validateKPISecondaryReferenceResolution(t, spec)
	artifacts, err := Materialize(context.Background(), spec, map[string]json.RawMessage{
		"primary": json.RawMessage(`{"rows":[{"amount":80}]}`),
		"prior":   json.RawMessage(`{"rows":[{"amount":100}]}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	typedFill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	if err != nil {
		t.Fatalf("strict fill: %v", err)
	}
	for _, block := range typedFill.Blocks {
		if block.ID == "current" && (block.SecondaryDatasetRef != "prior" || block.SecondaryCalculation != "relativeChange") {
			t.Fatalf("typed fill lost comparison: %+v", block)
		}
	}
	validateKPISecondaryPayloads(t, spec, artifacts.ReportFill)
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	if err != nil {
		t.Fatal(err)
	}
	text := ""
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			text += element.Text + "\n"
		}
	}
	if !strings.Contains(text, "-20.0%") {
		t.Fatalf("comparison missing in print: %s", text)
	}
	rendered, err := pdf.Render(printed, pdf.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(rendered.Bytes, []byte("%PDF-")) || len(rendered.Diagnostics) > 0 {
		t.Fatalf("PDF render: %+v", rendered.Diagnostics)
	}
	workbook, err := reportxlsx.RenderDashboard(typedFill)
	if err != nil {
		t.Fatal(err)
	}
	book, err := excelize.OpenReader(bytes.NewReader(workbook))
	if err != nil {
		t.Fatal(err)
	}
	defer book.Close()
	sheetText := ""
	for _, sheet := range book.GetSheetList() {
		rows, err := book.GetRows(sheet)
		if err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			sheetText += strings.Join(row, " ") + "\n"
		}
	}
	if !strings.Contains(sheetText, "-20.0%") {
		t.Fatalf("comparison missing in XLSX: %s", sheetText)
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
}

// Mutations are independently authored against the canonical lower/materialize output.
func validateKPISecondaryPayloads(t *testing.T, spec, fill []byte) {
	t.Helper()
	for _, boundary := range []struct {
		name   string
		raw    []byte
		decode func([]byte) error
	}{
		{"spec", spec, func(raw []byte) error { _, err := reportspec.DecodeJSON(raw); return err }},
		{"fill", fill, func(raw []byte) error { _, err := reportfill.DecodeJSON(raw); return err }},
	} {
		for _, tc := range []struct {
			name   string
			key    string
			value  any
			remove bool
			want   string
		}{
			{name: "unknown field", key: "secondaryFormula", value: "arbitrary", want: "unknown field"},
			{name: "null calculation", key: "secondaryCalculation", value: nil, want: "secondaryCalculation"},
			{name: "null dataset", key: "secondaryDatasetRef", value: nil, want: "secondaryDatasetRef"},
			{name: "empty calculation", key: "secondaryCalculation", value: "", want: "secondaryCalculation"},
			{name: "empty dataset", key: "secondaryDatasetRef", value: "", want: "secondaryDatasetRef"},
			{name: "invalid calculation", key: "secondaryCalculation", value: "eval", want: "secondaryCalculation"},
			{name: "unresolved dataset retained", key: "secondaryDatasetRef", value: "unavailable"},
			{name: "case insensitive alias", key: "secondaryDatasetRef", value: "PRIOR"},
			{name: "blank dataset", key: "secondaryDatasetRef", value: " ", want: "secondaryDatasetRef"},
			{name: "value", key: "secondaryCalculation", value: "value"},
			{name: "difference", key: "secondaryCalculation", value: "difference"},
			{name: "implicit calculation", key: "secondaryCalculation", remove: true},
			{name: "same dataset", key: "secondaryDatasetRef", remove: true},
		} {
			t.Run(boundary.name+"/"+tc.name, func(t *testing.T) {
				var payload map[string]any
				if err := json.Unmarshal(boundary.raw, &payload); err != nil {
					t.Fatal(err)
				}
				for _, item := range payload["blocks"].([]any) {
					block := item.(map[string]any)
					if block["id"] == "current" {
						if tc.remove {
							delete(block, tc.key)
						} else {
							block[tc.key] = tc.value
						}
					}
				}
				raw, err := json.Marshal(payload)
				if err != nil {
					t.Fatal(err)
				}
				err = boundary.decode(raw)
				if tc.want == "" {
					if err != nil {
						t.Fatal(err)
					}
				} else if err == nil || !strings.Contains(err.Error(), tc.want) {
					t.Fatalf("want %q error, got %v", tc.want, err)
				}
			})
		}
	}
}

// Alias lookup and unresolved-reference errors belong to the existing materializer.
func validateKPISecondaryReferenceResolution(t *testing.T, spec []byte) {
	t.Helper()
	for _, ref := range []string{"PRIOR", "prior.samples", "PriorSamples", "unavailable"} {
		t.Run("materialize reference/"+ref, func(t *testing.T) {
			typed, err := reportspec.DecodeJSON(spec)
			if err != nil {
				t.Fatal(err)
			}
			for i := range typed.Datasets {
				if typed.Datasets[i].ID == "prior" {
					typed.Datasets[i].DataSourceRef = "prior.samples"
				}
			}
			for i := range typed.Blocks {
				if typed.Blocks[i].ID == "current" {
					typed.Blocks[i].SecondaryDatasetRef = ref
				}
			}
			raw, err := json.Marshal(typed)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = reportspec.DecodeJSON(raw); err != nil {
				t.Fatalf("strict spec rejected reference: %v", err)
			}
			artifacts, err := Materialize(t.Context(), raw, map[string]json.RawMessage{
				"primary": json.RawMessage(`{"rows":[{"amount":80}]}`),
				"prior":   json.RawMessage(`{"rows":[{"amount":100}]}`),
			})
			if ref == "unavailable" {
				if err == nil || !strings.Contains(err.Error(), "KPI secondary dataset 'unavailable' is unavailable") {
					t.Fatalf("expected materializer reference error, got %v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			if err != nil {
				t.Fatalf("strict fill rejected alias: %v", err)
			}
			found := false
			for _, block := range fill.Blocks {
				if block.ID == "current" {
					found = true
					if block.SecondaryDatasetRef != ref || block.KPIContent == nil || block.KPIContent.SecondaryValue != float64(-.2) {
						t.Fatalf("alias comparison lost: %+v", block)
					}
				}
			}
			if !found {
				t.Fatal("comparison missing")
			}
		})
	}
}
