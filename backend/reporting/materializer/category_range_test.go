package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	pdfreader "github.com/ledongthuc/pdf"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"io"
	"os"
	"strings"
	"testing"
)

// Independently authored public synthetic values exercise canonical fill and PDF.
func TestCategoryRangeMaterialization(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/category-range.json")
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
	fields := []string{"measuredCelsius", "targetMin", "targetMax", "targetCelsius"}
	example.ChartSpec["xField"] = "room"
	example.ChartSpec["yFields"] = fields
	chart := map[string]any{"type": "category-range", "categoryRange": example.ChartSpec["categoryRange"], "xAxis": map[string]any{"dataKey": "room"}, "series": map[string]any{"values": []any{map[string]any{"value": "measuredCelsius", "label": "Measured", "type": "bar"}}}}
	spec["blocks"] = []any{map[string]any{"id": "ranges", "kind": "chartBlock", "datasetRef": "primary", "chartSpec": example.ChartSpec, "chartModel": chart}}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"ranges"}}
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
	if !bytes.Contains(artifacts.ReportFill, []byte(`"targetMax":24`)) {
		t.Fatal("raw endpoint omitted")
	}
	report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	if err != nil {
		t.Fatal(err)
	}
	rendered, err := reportpdf.Render(report, reportpdf.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rendered.Diagnostics) != 0 {
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
	for _, label := range []string{"Room A", "Room B", "Room C", "Measured", "Target range", "21", "25", "18"} {
		if !strings.Contains(string(content), label) {
			t.Fatalf("PDF lost %q: %s", label, content)
		}
	}
}

func TestCategoryRangePaginatedPDF(t *testing.T) {
	for _, orientation := range []string{"horizontal", "vertical"} {
		t.Run(orientation, func(t *testing.T) {
			raw, err := os.ReadFile("../../../doc/examples/category-range.json")
			if err != nil {
				t.Fatal(err)
			}
			var example struct {
				ChartSpec map[string]any `json:"chartSpec"`
			}
			if err = json.Unmarshal(raw, &example); err != nil {
				t.Fatal(err)
			}
			config := example.ChartSpec["categoryRange"].(map[string]any)
			config["orientation"] = orientation
			for _, value := range config["series"].([]any) {
				value.(map[string]any)["format"] = map[string]any{"suffix": " synthetic units"}
			}
			// Complete, independently authored long labels must fit without shrinking.
			config["series"].([]any)[1].(map[string]any)["label"] = "Target interval with a complete descriptive legend label"
			rows := []map[string]any{}
			for i := 0; i < 10; i++ {
				rows = append(rows, map[string]any{"room": fmt.Sprintf("Room%02d complete synthetic category label that wraps onto several lines", i), "measuredCelsius": 21, "targetMin": 19, "targetMax": 22, "targetCelsius": 23})
			}
			raw, err = os.ReadFile("testdata/presentation-report.json")
			if err != nil {
				t.Fatal(err)
			}
			var spec map[string]any
			if err = json.Unmarshal(raw, &spec); err != nil {
				t.Fatal(err)
			}
			example.ChartSpec["xField"] = "room"
			example.ChartSpec["yFields"] = []string{"measuredCelsius", "targetMin", "targetMax", "targetCelsius"}
			chart := map[string]any{"type": "category-range", "categoryRange": config, "series": map[string]any{"valueKey": "measuredCelsius", "values": []any{map[string]any{"value": "measuredCelsius", "label": "Measured", "type": "bar"}}}}
			spec["blocks"] = []any{map[string]any{"id": "ranges", "kind": "chartBlock", "title": "Category comparison", "datasetRef": "primary", "chartSpec": example.ChartSpec, "chartModel": chart}}
			spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"ranges"}}
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
			filled, err := reportfill.DecodeJSON(artifacts.ReportFill)
			if err != nil {
				t.Fatal(err)
			}
			if len(filled.Blocks[0].ChartContent.ResolvedChart.Rows) != 10 {
				t.Fatal("raw categories lost")
			}
			report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			if err != nil {
				t.Fatal(err)
			}
			if len(report.Pages) < 2 {
				t.Fatal("expected multiple print pages")
			}
			bottom := report.PageGeometry.Height - report.PageGeometry.MarginBottom - report.PageGeometry.FooterHeight - 8
			for _, page := range report.Pages {
				for _, element := range page.Elements {
					if element.Kind == "svg" {
						if element.Box.Y+element.Box.Height > bottom {
							t.Fatalf("SVG exceeds page content: %+v, bottom %v", element.Box, bottom)
						}
						var root struct {
							Width  float64 `xml:"width,attr"`
							Height float64 `xml:"height,attr"`
						}
						if err = xml.Unmarshal([]byte(element.SVG), &root); err != nil {
							t.Fatal(err)
						}
						if root.Width != element.Box.Width || root.Height != element.Box.Height {
							t.Fatalf("print must not shrink chart: svg %v x %v, box %+v", root.Width, root.Height, element.Box)
						}
					}
				}
			}
			rendered, err := reportpdf.Render(report, reportpdf.Options{})
			if err != nil {
				t.Fatal(err)
			}
			if len(rendered.Diagnostics) != 0 {
				t.Fatalf("PDF diagnostics: %+v", rendered.Diagnostics)
			}
			reader, err := pdfreader.NewReader(bytes.NewReader(rendered.Bytes), int64(len(rendered.Bytes)))
			if err != nil {
				t.Fatal(err)
			}
			if reader.NumPage() < 2 {
				t.Fatal("expected actual multi-page PDF")
			}
			plain, err := reader.GetPlainText()
			if err != nil {
				t.Fatal(err)
			}
			content, err := io.ReadAll(plain)
			if err != nil {
				t.Fatal(err)
			}
			for i := 0; i < 10; i++ {
				label := fmt.Sprintf("Room%02d", i)
				if strings.Count(string(content), label) != 1 {
					t.Fatalf("category missing or repeated: %s", label)
				}
			}
			if !strings.Contains(strings.Join(strings.Fields(string(content)), ""), "completedescriptivelegendlabel") {
				t.Fatalf("legend lost in PDF: %s", content)
			}
		})
	}
}
