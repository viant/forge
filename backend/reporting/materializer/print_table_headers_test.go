package materializer

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// An independently invented inventory table puts seven ordinary headings in a
// full first band and one long, unbreakable label in a second band.
func TestPrintTableHeaderWordsPDF(t *testing.T) {
	identifier := strings.Repeat("AXZ", 30)
	spec := json.RawMessage(`{
		"version":1,"kind":"reportSpec","title":"Inventory summary",
		"source":{"kind":"report","containerId":"inventory","stateKey":"inventory","dataSourceRef":"rows"},
		"parameters":{"viewMode":"table","pageSize":100},
		"layoutIntent":{"kind":"stack","resultPanePosition":"bottom"},
		"refinements":[],"calculatedFields":[],
		"datasets":[{"id":"primary","dataSourceRef":"rows","request":{}}],
		"blocks":[{"id":"inventory","kind":"tableBlock","datasetRef":"primary","columns":[
			{"key":"site","label":"Distribution","rowIdentity":true},
			{"key":"specs","label":"Specifications","kind":"measure","format":"number"},
			{"key":"features","label":"Characteristics","kind":"measure","format":"number"},
			{"key":"measurements","label":"Measurements","kind":"measure","format":"number"},
			{"key":"availability","label":"Availability","kind":"measure","format":"number"},
			{"key":"verification","label":"Verification","kind":"measure","format":"number"},
			{"key":"requirements","label":"Requirements","kind":"measure","format":"number"},
			{"key":"unit","label":"` + identifier + `"}
		]}]
	}`)
	data := json.RawMessage(`{"rows":[
		{"site":"North","specs":0,"features":3,"measurements":9,"availability":7,"verification":4,"requirements":5,"unit":"Unit A"},
		{"site":"South","specs":12,"features":null,"measurements":8,"availability":6,"verification":2,"requirements":1,"unit":"Unit B"}
	]}`)
	artifacts, err := Materialize(t.Context(), spec, map[string]json.RawMessage{"primary": data})
	if err != nil {
		t.Fatal(err)
	}
	report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	if err != nil {
		t.Fatal(err)
	}
	pdf, err := reportpdf.Render(report, reportpdf.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(pdf.Diagnostics) != 0 {
		t.Fatalf("PDF diagnostics: %+v", pdf.Diagnostics)
	}
	reader, err := pdfreader.NewReader(bytes.NewReader(pdf.Bytes), int64(len(pdf.Bytes)))
	if err != nil {
		t.Fatal(err)
	}
	content, err := reader.GetPlainText()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := io.ReadAll(content)
	if err != nil {
		t.Fatal(err)
	}
	plain := string(raw)
	for _, word := range []string{"Distribution", "Specifications", "Characteristics", "Measurements", "Availability", "Verification", "Requirements"} {
		if !strings.Contains(plain, word) {
			t.Errorf("PDF split header word %q: %q", word, plain)
		}
	}
	if strings.Contains(plain, identifier) || !strings.Contains(strings.Join(strings.Fields(plain), ""), identifier) {
		t.Errorf("PDF should wrap the long label and retain all of its text: %q", plain)
	}

	headers := make(map[string]int)
	cells := make(map[string][]string)
	for _, page := range report.Pages {
		for _, element := range page.Elements {
			if band, _, isBackground := strings.Cut(element.ID, "__header_bg__"); isBackground {
				headers[band]++
			}
			band, _, isHeader := strings.Cut(element.ID, "__header__")
			if isHeader {
				wantBand := "inventory__columns_1"
				if element.Text == identifier {
					wantBand = "inventory__columns_2"
				}
				if element.Text != "Distribution" && band != wantBand {
					t.Errorf("header %q in band %q, want %q", element.Text, band, wantBand)
				}
			}
			if isHeader || element.Kind == "tableCellText" {
				box, geometry := element.Box, report.PageGeometry
				if box.X < geometry.MarginLeft || box.X+box.Width > geometry.Width-geometry.MarginRight+0.01 ||
					box.Y+box.Height > geometry.Height-geometry.MarginBottom-geometry.FooterHeight+0.01 {
					t.Errorf("table element exceeds page bounds: %+v", element)
				}
			}
			if element.Kind == "tableCellText" {
				cells[element.ColumnKey] = append(cells[element.ColumnKey], element.Text)
			}
		}
	}
	if len(headers) != 2 || headers["inventory__columns_1"] != 1 || headers["inventory__columns_2"] != 1 {
		t.Errorf("expected two bounded column bands, got %v", headers)
	}
	for key, want := range map[string]string{
		"site": "North|South|North|South", "specs": "0|12", "features": "3|—",
		"measurements": "9|8", "availability": "7|6", "verification": "4|2", "requirements": "5|1", "unit": "Unit A|Unit B",
	} {
		if got := strings.Join(cells[key], "|"); got != want {
			t.Errorf("column %q has cells %q, want %q", key, got, want)
		}
	}
}
