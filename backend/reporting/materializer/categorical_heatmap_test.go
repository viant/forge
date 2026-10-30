package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"os"
	"strconv"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	reporthtml "github.com/viant/forge/backend/reporting/export/html"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// The fixture is independently invented public data; it exercises the embedded
// canonical renderer rather than a second Go implementation of matrix semantics.
func TestCategoricalHeatmapMaterialization(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/categorical-heatmap.json")
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
	chart := map[string]any{"type": "heatmap", "heatmap": example.ChartSpec["heatmap"], "series": map[string]any{"valueKey": "occupiedSeats", "values": []any{map[string]any{"value": "occupiedSeats", "label": "Occupied seats", "type": "heatmap"}}}}
	example.ChartSpec["xField"] = "weekday"
	example.ChartSpec["yFields"] = []string{"occupiedSeats"}
	spec["blocks"] = []any{map[string]any{"id": "occupancy", "kind": "chartBlock", "datasetRef": "primary", "chartSpec": example.ChartSpec, "chartModel": chart}}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"occupancy"}}
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
	var printed struct {
		Pages []struct {
			Elements []struct {
				SVG string `json:"svg"`
			} `json:"elements"`
		} `json:"pages"`
	}
	if err = json.Unmarshal(artifacts.ReportPrint, &printed); err != nil {
		t.Fatal(err)
	}
	svg := ""
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			svg += element.SVG
		}
	}
	if strings.Count(svg, `stroke="#ffffff"`) != 9 {
		t.Fatalf("expected 9 matrix cells across print tiles: %s", svg)
	}
	for _, label := range []string{">Monday</text>", ">Evening</text>", ">0</text>", ">No data</text>"} {
		if !strings.Contains(svg, label) {
			t.Fatalf("missing cell description %q", label)
		}
	}
	report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	if err != nil {
		t.Fatal(err)
	}
	htmlBytes, htmlErr := reporthtml.Render(report)
	if htmlErr != nil {
		t.Fatal(htmlErr)
	}
	if !strings.Contains(string(htmlBytes), "data:image/svg+xml;base64,") {
		t.Fatal("HTML export lost embedded heatmap SVG")
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
	for _, label := range []string{"Monday", "Tuesday", "Wednesday", "Morning", "Afternoon", "Evening", "No data"} {
		if !strings.Contains(string(content), label) {
			t.Fatalf("PDF lost label %q: %s", label, content)
		}
	}
	// Duplicates fail in the server's actual embedded renderer too.
	example.Rows = append(example.Rows, example.Rows[0])
	payload, _ = json.Marshal(map[string]any{"rows": example.Rows})
	if _, err = Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload}); err == nil {
		t.Fatal("duplicate matrix pair was accepted")
	}
}

func TestCategoricalHeatmapMultiPagePDFBounds(t *testing.T) {
	testCategoricalHeatmapPDFBounds(t, 20, 6, 0)
}

func TestCategoricalHeatmapCompactPDFBounds(t *testing.T) {
	testCategoricalHeatmapPDFBounds(t, 4, 7, 123456)
}

func testCategoricalHeatmapPDFBounds(t *testing.T, rowCount, columnCount, offset int) {
	t.Helper()
	raw, err := os.ReadFile("testdata/presentation-report.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec map[string]any
	if err = json.Unmarshal(raw, &spec); err != nil {
		t.Fatal(err)
	}
	rowCategories := make([]string, rowCount)
	columnCategories := make([]string, columnCount)
	for i := range rowCategories {
		rowCategories[i] = fmt.Sprintf("Row %d", i)
	}
	for i := range columnCategories {
		columnCategories[i] = fmt.Sprintf("Column %d", i)
	}
	rows := make([]map[string]any, 0, rowCount*columnCount)
	for r, row := range rowCategories {
		for c, column := range columnCategories {
			rows = append(rows, map[string]any{"row": row, "column": column, "value": offset + r*columnCount + c})
		}
	}
	matrix := map[string]any{"rowField": "row", "columnField": "column", "valueField": "value", "rowCategories": rowCategories, "columnCategories": columnCategories, "colorScale": map[string]any{"type": "sequential", "domain": []int{0, offset + rowCount*columnCount - 1}, "colors": []string{"#eff3ff", "#08519c"}}}
	chart := map[string]any{"type": "heatmap", "heatmap": matrix, "series": map[string]any{"valueKey": "value", "values": []any{map[string]any{"value": "value", "label": "Value", "type": "heatmap"}}}}
	spec["blocks"] = []any{map[string]any{"id": "matrix", "kind": "chartBlock", "title": "Synthetic matrix", "datasetRef": "primary", "chartSpec": map[string]any{"type": "heatmap", "xField": "row", "yFields": []string{"value"}, "heatmap": matrix}, "chartModel": chart}}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"matrix"}}
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
	report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	if err != nil {
		t.Fatal(err)
	}
	if rowCount > 4 && len(report.Pages) < 2 {
		t.Fatalf("expected multiple row/column tile pages, got %d", len(report.Pages))
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
	for _, row := range rows {
		for _, key := range []string{"row", "column", "value"} {
			if !strings.Contains(string(content), fmt.Sprint(row[key])) {
				t.Fatalf("PDF lost exact %s: %v", key, row[key])
			}
		}
	}
	cellCount, textCount := 0, 0
	for _, page := range report.Pages {
		for _, element := range page.Elements {
			if element.Kind != "svg" {
				continue
			}
			box := element.Box
			if box.X < report.PageGeometry.MarginLeft || box.X+box.Width > report.PageGeometry.Width-report.PageGeometry.MarginRight+.01 || box.Y+box.Height > report.PageGeometry.Height-report.PageGeometry.MarginBottom-report.PageGeometry.FooterHeight+.01 {
				t.Fatalf("tile outside printable bounds: %+v", box)
			}
			var svg struct {
				Width  string `xml:"width,attr"`
				Height string `xml:"height,attr"`
			}
			if err = xml.Unmarshal([]byte(element.SVG), &svg); err != nil {
				t.Fatal(err)
			}
			width, _ := strconv.ParseFloat(svg.Width, 64)
			height, _ := strconv.ParseFloat(svg.Height, 64)
			if math.Abs(width-box.Width) > .01 || math.Abs(height-box.Height) > .01 {
				t.Fatalf("nonuniform or shrinking SVG: intrinsic=%vx%v box=%+v", width, height, box)
			}
			cellCount += strings.Count(element.SVG, `stroke="#ffffff"`)
			for _, fragment := range reader.Page(page.Number).Content().Text {
				baseline := report.PageGeometry.Height - fragment.Y
				if baseline < box.Y || baseline > box.Y+box.Height || fragment.X < box.X {
					continue
				}
				textCount++
				if math.Abs(fragment.FontSize-12) > .01 {
					t.Fatalf("matrix text shrank to %vpt", fragment.FontSize)
				}
				if fragment.X+fragment.W > box.X+box.Width+.1 {
					t.Fatalf("PDF text outside tile: %+v box=%+v", fragment, box)
				}
			}
		}
	}
	if cellCount != rowCount*columnCount || textCount == 0 {
		t.Fatalf("lost matrix coverage/text: cells=%d text=%d", cellCount, textCount)
	}
	var evidence struct {
		Datasets []struct {
			Rows []map[string]any `json:"rows"`
		} `json:"datasets"`
	}
	if err = json.Unmarshal(artifacts.ReportFill, &evidence); err != nil {
		t.Fatal(err)
	}
	if len(evidence.Datasets) == 0 || len(evidence.Datasets[0].Rows) != rowCount*columnCount {
		t.Fatal("pagination altered raw evidence")
	}
}
