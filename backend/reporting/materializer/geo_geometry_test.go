package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	pdfreader "github.com/ledongthuc/pdf"
	reporthtml "github.com/viant/forge/backend/reporting/export/html"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"io"
	"os"
	"sort"
	"strings"
	"testing"
)

// Independently authored public synthetic values exercise canonical fill and PDF.
func TestGeoGeometryMaterialization(t *testing.T) {
	raw, err := os.ReadFile("../../../doc/examples/campus-zone-geometry.json")
	if err != nil {
		t.Fatal(err)
	}
	var example struct {
		Block map[string]any   `json:"block"`
		Rows  []map[string]any `json:"rows"`
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
	spec["blocks"] = []any{example.Block}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"campus"}}
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
	if !bytes.Contains(artifacts.ReportFill, []byte(`"utilization":null`)) {
		t.Fatal("raw null row omitted")
	}
	report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reporthtml.Render(report); err != nil {
		t.Fatal(err)
	}
	rendered, err := reportpdf.Render(report, reportpdf.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rendered.Diagnostics) != 0 {
		t.Fatalf("PDF diagnostics: %+v", rendered.Diagnostics)
	}
	if path := os.Getenv("FORGE_GEO_PROOF_PDF"); path != "" {
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
	for _, label := range []string{"North", "East", "South", "West", "No value", "No row"} {
		if !strings.Contains(string(content), label) {
			t.Fatalf("PDF lost %q: %s", label, content)
		}
	}
	badRows := json.RawMessage(`{"rows":[{"zoneId":"unknown","utilization":1}]}`)
	if _, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": badRows}); err == nil || !strings.Contains(err.Error(), "unknown feature key") {
		t.Fatalf("unknown join key should fail actionably: %v", err)
	}
	extremeRows := json.RawMessage(`{"rows":[{"zoneId":"North","utilization":-1e308},{"zoneId":"East","utilization":1e308}]}`)
	extreme, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": extremeRows})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reportfill.DecodeJSON(extreme.ReportFill); err != nil {
		t.Fatal(err)
	}
	for _, color := range []string{"#d9f0ea", "#0c4d52"} {
		if !bytes.Contains(extreme.ReportFill, []byte(color)) || !bytes.Contains(extreme.ReportPrint, []byte(color)) {
			t.Fatalf("extreme range lost palette endpoint %s", color)
		}
	}
	extremePrint, err := reportprint.DecodeJSON(extreme.ReportPrint)
	if err != nil {
		t.Fatal(err)
	}
	extremePDF, err := reportpdf.Render(extremePrint, reportpdf.Options{})
	if err != nil || len(extremePDF.Diagnostics) != 0 {
		t.Fatalf("extreme range PDF: %v, %+v", err, extremePDF.Diagnostics)
	}
	example.Block["geo"].(map[string]any)["geometry"] = "https://example.invalid/geometry.json"
	badSpec, err := json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Materialize(context.Background(), badSpec, map[string]json.RawMessage{"primary": payload}); err == nil {
		t.Fatal("external geometry reference must not be fetched or accepted")
	}
}

func TestGeoGeometryMultiPageExport(t *testing.T) {
	raw, err := os.ReadFile("testdata/presentation-report.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec map[string]any
	if err = json.Unmarshal(raw, &spec); err != nil {
		t.Fatal(err)
	}
	features, rows := []any{}, []any{}
	labels := []string{}
	for i := 0; i < 48; i++ {
		key := fmt.Sprintf("Region-%02d", i)
		label := key + " " + strings.Repeat("wide campus words WWW detail ", 5) + fmt.Sprintf("End-%02d", i)
		labels = append(labels, label)
		x, y := float64(i%8)*2, float64(i/8)*2
		ring := [][]float64{{x, y}, {x + 1, y}, {x + 1, y + 1}, {x, y + 1}, {x, y}}
		features = append(features, map[string]any{"type": "Feature", "id": key, "properties": map[string]any{"label": label}, "geometry": map[string]any{"type": "Polygon", "coordinates": []any{ring}}})
		rows = append(rows, map[string]any{"zoneId": key, "value": i})
	}
	geo := map[string]any{"shape": "geojson", "projection": "planar", "key": "zoneId", "metric": map[string]any{"key": "value", "format": "number"}, "geometry": map[string]any{"type": "FeatureCollection", "features": features}}
	spec["blocks"] = []any{map[string]any{"id": "many-regions", "kind": "geoMapBlock", "title": "Invented campus regions", "datasetRef": "primary", "geo": geo}}
	spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"many-regions"}}
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
	if len(report.Pages) < 3 {
		t.Fatalf("expected paginated descriptions, got %d pages", len(report.Pages))
	}
	if _, err = reporthtml.Render(report); err != nil {
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
	var labelLines []string
	for _, page := range report.Pages {
		fragments := reader.Page(page.Number).Content().Text
		for _, element := range page.Elements {
			box := element.Box
			if box.X < report.PageGeometry.MarginLeft || box.X+box.Width > report.PageGeometry.Width-report.PageGeometry.MarginRight+.01 || box.Y+box.Height > report.PageGeometry.Height-report.PageGeometry.MarginBottom-report.PageGeometry.FooterHeight+.01 {
				t.Fatalf("element outside printable bounds on page %d: %+v", page.Number, box)
			}
			if strings.HasPrefix(element.ID, "many-regions__labels") {
				var line []pdfreader.Text
				for _, fragment := range fragments {
					baseline := report.PageGeometry.Height - fragment.Y
					if baseline >= box.Y && baseline < box.Y+box.Height {
						line = append(line, fragment)
					}
				}
				sort.Slice(line, func(i, j int) bool { return line[i].X < line[j].X })
				var extracted strings.Builder
				for _, fragment := range line {
					extracted.WriteString(fragment.S)
				}
				actual := strings.Join(strings.Fields(extracted.String()), " ")
				if actual != strings.Join(strings.Fields(element.Text), " ") {
					t.Fatalf("PDF label box mismatch page %d: expected %q, extracted %q", page.Number, element.Text, actual)
				}
				labelLines = append(labelLines, actual)
			}
		}
		for _, fragment := range reader.Page(page.Number).Content().Text {
			if fragment.X < 0 || fragment.X+fragment.W > report.PageGeometry.Width+.1 || fragment.Y < 0 || fragment.Y > report.PageGeometry.Height {
				t.Fatalf("PDF text outside page %d: %+v", page.Number, fragment)
			}
		}
	}
	// Rejoin verified label lines without intervening page headers/footers.
	normalized := strings.Join(strings.Fields(strings.Join(labelLines, " ")), " ")
	for _, label := range labels {
		if !strings.Contains(normalized, label) {
			t.Fatalf("PDF lost full label %q", label)
		}
	}
}
