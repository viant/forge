package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	pdfreader "github.com/ledongthuc/pdf"
	reporthtml "github.com/viant/forge/backend/reporting/export/html"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"io"
	"os"
	"strings"
	"testing"
)

// Independently authored public synthetic values exercise canonical fill and PDF.
func TestChartTooltipMaterialization(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/chart-tooltips.json")
	if err != nil {
		t.Fatal(err)
	}
	var example struct {
		ChartSpec map[string]any   `json:"chartSpec"`
		Rows      []map[string]any `json:"rows"`
	}
	if err = json.Unmarshal(raw, &example); err != nil {
		t.Fatal(err)
	}
	raw, err = os.ReadFile("testdata/presentation-report.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec map[string]any
	if err = json.Unmarshal(raw, &spec); err != nil {
		t.Fatal(err)
	}
	chart := map[string]any{"type": "bar", "tooltip": example.ChartSpec["tooltip"], "xAxis": map[string]any{"dataKey": "day"}, "series": map[string]any{"values": []any{map[string]any{"value": "passed", "label": "Passed", "type": "bar"}}}}
	spec["blocks"] = []any{map[string]any{"id": "checks", "kind": "chartBlock", "title": "Equipment checks by day", "datasetRef": "primary", "chartSpec": example.ChartSpec, "chartModel": chart}}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"checks"}}
	raw, err = json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	payload, err := json.Marshal(map[string]any{"rows": example.Rows})
	if err != nil {
		t.Fatal(err)
	}
	artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = reportfill.DecodeJSON(artifacts.ReportFill); err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(artifacts.ReportFill, []byte(`"medianMinutes":null`)) {
		t.Fatal("raw tooltip field omitted")
	}
	report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	if err != nil {
		t.Fatal(err)
	}
	html, err := reporthtml.Render(report)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(html, []byte("&lt;img")) || bytes.Contains(html, []byte("<img src=x")) {
		t.Fatal("tooltip text must be escaped in HTML")
	}
	rendered, err := reportpdf.Render(report, reportpdf.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rendered.Diagnostics) != 0 {
		t.Fatalf("PDF diagnostics: %+v", rendered.Diagnostics)
	}
	if path := os.Getenv("FORGE_TOOLTIP_PROOF_PDF"); path != "" {
		if err := os.WriteFile(path, rendered.Bytes, 0600); err != nil {
			t.Fatal(err)
		}
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
	for _, label := range []string{"Date", "Passed checks", "Failed checks", "Median duration", "Operator note", "No value", "Missing field", "Routine checks"} {
		if !strings.Contains(string(content), label) {
			t.Fatalf("PDF lost %q: %s", label, content)
		}
	}
	chart["tooltip"].(map[string]any)["print"] = "omit"
	raw, err = json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	omitted, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(omitted.ReportPrint, []byte("checks__tooltip_details")) {
		t.Fatal("explicit supplementary print omit policy ignored")
	}
	if !bytes.Contains(omitted.ReportFill, []byte("Routine checks")) {
		t.Fatal("omit policy removed raw or resolved source detail")
	}
}

func TestChartTooltipIdentityAndPlotParity(t *testing.T) {
	for _, kind := range []string{"bar", "pie", "line"} {
		t.Run(kind, func(t *testing.T) {
			raw, err := os.ReadFile("testdata/presentation-report.json")
			if err != nil {
				t.Fatal(err)
			}
			var spec map[string]any
			if err = json.Unmarshal(raw, &spec); err != nil {
				t.Fatal(err)
			}
			tooltip := map[string]any{"fields": []any{map[string]any{"field": "note", "label": "Note"}}}
			chart := map[string]any{"type": kind, "appearance": "document", "xAxis": map[string]any{"dataKey": "day"}, "series": map[string]any{"values": []any{map[string]any{"value": "passed", "label": "Passed"}}}, "tooltip": tooltip}
			chartSpec := map[string]any{"type": kind, "xField": "day", "yFields": []string{"passed"}, "tooltip": tooltip}
			rows := []map[string]any{{"day": 1, "passed": 1, "note": "Numeric category note"}, {"day": "1", "passed": 2, "note": "String category note"}}
			expected := []string{"Numeric category note", "String category note"}
			if kind == "pie" {
				chart["series"] = map[string]any{}
				chartSpec["xField"] = "name"
				chartSpec["yFields"] = []string{"value"}
				rows = []map[string]any{{"name": "Positive", "value": 1, "note": "Positive note"}, {"name": "Zero", "value": 0, "note": "Zero note"}, {"name": "Negative", "value": -1, "note": "Negative note"}}
				expected = []string{"Positive note", "Zero note", "Negative note", "Pie and donut charts require non-negative values."}
			}
			if kind == "line" {
				chart["layout"] = "small-multiples"
				chartSpec["layout"] = "small-multiples"
				chartSpec["appearance"] = "document"
				chartSpec["seriesField"] = "category"
				chart["series"] = map[string]any{"nameKey": "category", "valueKey": "passed", "values": []any{map[string]any{"value": "passed", "label": "Passed"}}}
				rows = []map[string]any{{"day": "2026-01-05", "category": "A", "passed": 1, "note": "A group note"}, {"day": "2026-01-05", "category": "B", "passed": 2, "note": "B group note"}}
				expected = []string{"A group note", "B group note"}
			}
			spec["blocks"] = []any{map[string]any{"id": "chart", "kind": "chartBlock", "datasetRef": "primary", "chartSpec": chartSpec, "chartModel": chart}}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"chart"}}
			raw, err = json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			payload, err := json.Marshal(map[string]any{"rows": rows})
			if err != nil {
				t.Fatal(err)
			}
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
			if err != nil {
				t.Fatal(err)
			}
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			if err != nil {
				t.Fatal(err)
			}
			resolved := fill.Blocks[0].ChartContent.ResolvedChart
			expectedEntries := len(rows)
			if len(resolved.TooltipEntries) != expectedEntries {
				t.Fatalf("unexpected tooltip coverage: %+v", resolved.TooltipEntries)
			}
			if kind == "pie" && len(resolved.Rows) != len(resolved.TooltipEntries) {
				t.Fatal("pie slice/tooltip coverage differs")
			}
			report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			if err != nil {
				t.Fatal(err)
			}
			rendered, err := reportpdf.Render(report, reportpdf.Options{})
			if err != nil {
				t.Fatal(err)
			}
			if kind == "pie" {
				if len(rendered.Diagnostics) != 1 || rendered.Diagnostics[0].Code != "invalidReportPrintCategoryValue" {
					t.Fatalf("expected explicit negative-category diagnostic: %+v", rendered.Diagnostics)
				}
			} else if len(rendered.Diagnostics) != 0 {
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
			for _, text := range expected {
				if !strings.Contains(string(content), text) {
					t.Fatalf("PDF lost %q", text)
				}
			}
			if kind == "pie" && !bytes.Contains(artifacts.ReportPrint, []byte("invalidReportPrintCategoryValue")) {
				t.Fatal("negative document category state must be explicit in print")
			}
		})
	}
}
