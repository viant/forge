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
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/viant/forge/backend/reporting/registry"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	identity "github.com/viant/forge/backend/resource"
	"github.com/xuri/excelize/v2"
)

// Independent generic values travel through the embedded canonical materializer,
// strict Go fill decoder, actual PDF renderer and complete XLSX metrics sheet.
func TestKPIComparisonVisibilityCanonicalArtifacts(t *testing.T) {
	raw, err := os.ReadFile("testdata/presentation-report.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec map[string]any
	if err = json.Unmarshal(raw, &spec); err != nil {
		t.Fatal(err)
	}
	spec["title"] = "Collection progress"
	spec["layoutIntent"] = map[string]any{"kind": "single", "resultPanePosition": "main", "blockOrder": []string{"progress"}}
	spec["blocks"] = []any{map[string]any{"id": "progress", "kind": "kpiBlock", "title": "Items", "datasetRef": "primary", "valueField": "amount", "valueLabel": "Items", "secondaryField": "count", "secondaryCalculation": "relativeChange", "secondaryLabel": "Comparable change", "secondaryFormat": "percentFraction", "secondaryTrend": true, "secondaryVisibleWhen": map[string]any{"source": "filters", "field": "periodMode", "equals": "completed"}}}
	for _, mode := range []string{"custom", "completed"} {
		t.Run(mode, func(t *testing.T) {
			spec["scope"] = map[string]any{"dataSourceRef": "sampleRows", "params": []any{map[string]any{"id": "periodMode", "label": "Period mode", "required": false, "kind": "select", "value": mode, "options": []any{map[string]any{"value": "custom", "label": "Custom"}, map[string]any{"value": "completed", "label": "Completed"}}}}}
			params := spec["scope"].(map[string]any)["params"].([]any)
			params[0].(map[string]any)["filterBindings"] = []any{map[string]any{"datasetRef": "primary", "path": "periodMode"}}
			params = append(params, map[string]any{
				"id": "period", "kind": "dateRange", "label": "Period", "required": true,
				"value":          map[string]any{"start": "2026-01-01", "end": "2026-01-07"},
				"filterBindings": []any{map[string]any{"datasetRef": "primary", "path": "from", "valuePath": "start"}, map[string]any{"datasetRef": "primary", "path": "to", "valuePath": "end"}},
				"datePresets": map[string]any{
					"calendar": map[string]any{"dataSourceRef": "calendar", "input": map[string]any{"name": "ids", "parameter": "identity", "array": true}, "identityField": "id", "timeZoneField": "zone"},
					"default":  "completed", "valueParameter": "periodMode",
					"options": []any{map[string]any{"value": "completed", "label": "Completed", "range": map[string]any{"kind": "relativeDays", "startOffset": -7, "endOffset": -1}}, map[string]any{"value": "custom", "label": "Custom"}},
				},
			})
			spec["scope"].(map[string]any)["params"] = params
			// Exercise the tracked embedded authored lowerer before strict native
			// admission and actual print/workbook rendering. This is an applied
			// absolute snapshot; output never performs a calendar lookup.
			envelopeBytes, err := os.ReadFile("testdata/synthetic/filtered.json")
			if err != nil {
				t.Fatal(err)
			}
			var envelope registry.ReportEnvelope
			if err = json.Unmarshal(envelopeBytes, &envelope); err != nil {
				t.Fatal(err)
			}
			document := map[string]any{"version": 1, "kind": "reportDocument", "id": "calendar-output", "title": spec["title"], "scope": spec["scope"], "blocks": spec["blocks"], "layoutIntent": spec["layoutIntent"]}
			envelope.ReportDocument, err = json.Marshal(document)
			if err != nil {
				t.Fatal(err)
			}
			for i := range envelope.Dependencies {
				if envelope.Dependencies[i].Kind == "report" {
					envelope.Dependencies[i].ContentFingerprint = identity.ContentFingerprint(envelope.ReportDocument)
				}
			}
			envelopeBytes, err = json.Marshal(envelope)
			if err != nil {
				t.Fatal(err)
			}
			encoded, err := Lower(context.Background(), envelopeBytes)
			if err != nil {
				t.Fatal(err)
			}
			admitted, err := reportspec.DecodeJSON(encoded)
			if err != nil {
				t.Fatal(err)
			}
			if admitted.Scope.Params[1].DatePresets == nil || admitted.Scope.Params[1].DatePresets.ValueParameter != "periodMode" {
				t.Fatal("strict native spec decoder lost date-preset declaration")
			}
			if err := admitted.Validate(); err != nil {
				t.Fatal(err)
			}
			conditionFound := false
			for _, block := range admitted.Blocks {
				if block.ID == "progress" && block.SecondaryVisibleWhen["field"] == "periodMode" {
					conditionFound = true
				}
			}
			if !conditionFound {
				t.Fatal("strict native spec decoder lost comparison condition")
			}
			encoded, err = json.Marshal(admitted)
			if err != nil {
				t.Fatal(err)
			}
			artifacts, err := Materialize(context.Background(), encoded, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"amount":80,"count":100}],"hasMore":false}`)})
			if err != nil {
				t.Fatal(err)
			}
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			if err != nil {
				t.Fatal(err)
			}
			var block *reportfill.Block
			for i := range fill.Blocks {
				if fill.Blocks[i].ID == "progress" {
					block = &fill.Blocks[i]
				}
			}
			if block == nil || block.KPIContent == nil {
				t.Fatalf("No KPI: %s", artifacts.ReportFill)
			}
			visible := mode == "completed"
			if strings.Contains(string(artifacts.ReportFill), `"secondaryValue"`) != visible {
				t.Fatalf("comparison mismatch: %s", artifacts.ReportFill)
			}
			printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			if err != nil {
				t.Fatal(err)
			}
			result, err := reportpdf.Render(printed, reportpdf.Options{})
			if err != nil {
				t.Fatal(err)
			}
			reader, err := pdfreader.NewReader(bytes.NewReader(result.Bytes), int64(len(result.Bytes)))
			if err != nil {
				t.Fatal(err)
			}
			plain, err := reader.GetPlainText()
			if err != nil {
				t.Fatal(err)
			}
			text, err := io.ReadAll(plain)
			if err != nil {
				t.Fatal(err)
			}
			if strings.Contains(string(text), "Comparable change") != visible {
				t.Fatalf("PDF label mismatch: %s", text)
			}
			if !strings.Contains(string(text), "80") || strings.Contains(string(text), "-20") != visible {
				t.Fatalf("PDF numeric values mismatch: %s", text)
			}
			bookBytes, err := reportxlsx.RenderDashboard(fill)
			if err != nil {
				t.Fatal(err)
			}
			book, err := excelize.OpenReader(bytes.NewReader(bookBytes))
			if err != nil {
				t.Fatal(err)
			}
			defer book.Close()
			found := false
			for _, name := range book.GetSheetList() {
				rows, err := book.GetRows(name, excelize.Options{RawCellValue: true})
				if err != nil {
					t.Fatal(err)
				}
				for _, row := range rows {
					if len(row) > 3 && row[0] == "progress" {
						found = true
						for len(row) < 8 {
							row = append(row, "")
						}
						if row[3] != "80" {
							t.Fatalf("primary altered: %v", row)
						}
						if (row[5] == "Comparable change") != visible {
							t.Fatalf("XLSX label mismatch: %v", row)
						}
						if visible && row[6] != "-0.2" {
							t.Fatalf("XLSX comparison mismatch: %v", row)
						}
						if !visible && row[6] != "" {
							t.Fatalf("XLSX comparison leaked: %v", row)
						}
					}
				}
			}
			if !found {
				t.Fatal("missing complete metric row")
			}
		})
	}
}
