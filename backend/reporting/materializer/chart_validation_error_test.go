package materializer

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/dop251/goja"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestAuthoredChartValidationErrorStructuredOnly(t *testing.T) {
	valid := ChartValidationDiagnostic{BlockID: "chart", DatasetRef: "detail", Field: "yFields.0", FieldRef: "observations", ValidationCode: "missingField"}
	for _, test := range []struct {
		name  string
		code  string
		typed bool
	}{
		{"text is not a diagnostic", `throw Error("AuthoredReportChartValidationError missingField private-token");`, false},
		{"unstructured named error", `var e=Error("private-token");e.name="AuthoredReportChartValidationError";throw e;`, false},
		{"unsafe locations", `var e=Error("private-token");e.name="AuthoredReportChartValidationError";e.authoredChartValidation=[{blockId:"/private/source",datasetRef:"detail",field:"xField",fieldRef:"region",validationCode:"missingField"}];throw e;`, false},
		{"structured locations", chartValidationThrow([]ChartValidationDiagnostic{valid}), true},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, original := goja.New().RunString(test.code)
			if original == nil {
				t.Fatal("expected exception")
			}
			err := loweringError(context.Background(), original)
			var typed *AuthoredChartValidationError
			if errors.As(err, &typed) != test.typed {
				t.Fatalf("unexpected error category: %T", err)
			}
			if !test.typed {
				return
			}
			if !errors.Is(err, original) {
				t.Fatal("exception cause was lost")
			}
			if strings.Contains(err.Error(), "private-token") {
				t.Fatal("error text leaked")
			}
			diagnostics := typed.AuthoredChartValidationDiagnostics()
			if len(diagnostics) != 1 || diagnostics[0] != valid {
				t.Fatalf("locations: %+v", diagnostics)
			}
			diagnostics[0].FieldRef = "changed"
			if typed.AuthoredChartValidationDiagnostics()[0] != valid {
				t.Fatal("diagnostic slice is mutable")
			}
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			if !errors.Is(loweringError(ctx, original), context.Canceled) {
				t.Fatal("cancellation reclassified")
			}
		})
	}
}

func chartValidationThrow(diagnostics []ChartValidationDiagnostic) string {
	raw, _ := json.Marshal(diagnostics)
	return `var e=Error("private-token");e.name="AuthoredReportChartValidationError";e.authoredChartValidation=` + string(raw) + `;throw e;`
}

func TestAuthoredChartValidationActualLoweringAndValidEmpty(t *testing.T) {
	for _, test := range []struct {
		name, schema string
		valid        bool
	}{
		{"isolated missing catalog", "", false},
		{"explicit inheritance", `,"capabilities":{"inheritRuntimeFieldCatalog":true}`, true},
		{"explicit fields", `,"columnOptions":[{"key":"region","kind":"dimension"},{"key":"observations","kind":"measure"}]`, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			envelope := chartValidationEnvelope(test.schema)
			raw, _ := json.Marshal(envelope)
			spec, err := Lower(context.Background(), raw)
			if !test.valid {
				var invalid *AuthoredChartValidationError
				if !errors.As(err, &invalid) {
					t.Fatalf("expected typed source failure, got %v", err)
				}
				locations := invalid.AuthoredChartValidationDiagnostics()
				if len(locations) != 2 || locations[0].DatasetRef != "detail" || locations[0].Field != "xField" || locations[1].Field != "yFields.0" {
					t.Fatalf("locations: %+v", locations)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			for _, rows := range []string{`[]`, `[{"region":"Invented region","observations":7}]`} {
				_, err := MaterializeFill(context.Background(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":` + rows + `}`), "detail": json.RawMessage(`{"rows":` + rows + `}`)})
				if err != nil {
					t.Fatalf("valid chart rows %s: %v", rows, err)
				}
			}
		})
	}
}

func chartValidationEnvelope(schema string) registry.ReportEnvelope {
	// Synthetic source uses the ordinary complete dependency closure. Updating
	// its authored bytes requires their matching fingerprints, just as publishing.
	envelope := fingerprintEnvelope()
	envelope.BuilderDefinition = json.RawMessage(`{"id":"builder","reportBuilder":{"dataSourceRef":"rows","dimensions":[{"id":"region","key":"region","paramPath":"dimensions.region","default":true}],"measures":[{"id":"observations","key":"observations","paramPath":"measures.observations","default":true}],"result":{"defaultMode":"table"},"dataSources":[{"id":"detail","dataSourceRef":"rows","request":{"dimensions":{"region":true},"measures":{"observations":true}}` + schema + `}]}}`)
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","id":"example","title":"Synthetic chart","blocks":[{"id":"chart","kind":"chartBlock","datasetRef":"detail","chartSpec":{"type":"bar","xField":"region","yFields":["observations"]}}]}`)
	envelope.State = json.RawMessage(`{"viewMode":"table","selectedDimensions":["region"],"selectedMeasures":["observations"]}`)
	envelope.Dependencies = []registry.ReportDependency{
		{Kind: "report", ID: "report://example/report", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)},
		{Kind: "builder", ID: "builder", ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)},
		{Kind: "datasource", ID: "rows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["rows"])},
	}
	return envelope
}
