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
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"progress"}}
	spec["blocks"] = []any{map[string]any{"id": "progress", "kind": "kpiBlock", "title": "Items", "datasetRef": "primary", "valueField": "value", "valueLabel": "Items", "secondaryField": "previous", "secondaryCalculation": "relativeChange", "secondaryLabel": "Comparable change", "secondaryFormat": "percentFraction", "secondaryTrend": true, "secondaryVisibleWhen": map[string]any{"source": "filters", "field": "periodMode", "equals": "completed"}}}
	for _, mode := range []string{"custom", "completed"} {
		t.Run(mode, func(t *testing.T) {
			spec["scope"] = map[string]any{"dataSourceRef": "approved", "params": []any{map[string]any{"id": "periodMode", "label": "Period mode", "required": false, "kind": "select", "value": mode, "options": []any{map[string]any{"value": "custom", "label": "Custom"}, map[string]any{"value": "completed", "label": "Completed"}}}}}
			encoded, _ := json.Marshal(spec)
			artifacts, err := Materialize(context.Background(), encoded, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"value":80,"previous":100}],"hasMore":false}`)})
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
