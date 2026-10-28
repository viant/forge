package xlsx

import (
	"testing"

	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

func TestCanonicalPrintCombinedEmphasisRoundTrip(t *testing.T) {
	f := excelize.NewFile()
	defer f.Close()
	w := &visualDashboardWriter{dashboardWriter: dashboardWriter{file: f}}
	element := reportprint.Element{ID: "label", Kind: "text", Text: "=literal text", FontWeight: "bold italic", FontSize: 11, Box: reportprint.Box{Width: 180, Height: 24}}
	if err := w.printElement("Sheet1", element, 0); err != nil {
		t.Fatal(err)
	}
	buffer, err := f.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	reopened, err := excelize.OpenReader(buffer)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	id, err := reopened.GetCellStyle("Sheet1", "A1")
	if err != nil {
		t.Fatal(err)
	}
	style, err := reopened.GetStyle(id)
	if err != nil {
		t.Fatal(err)
	}
	if style.Font == nil || !style.Font.Bold || !style.Font.Italic {
		t.Fatalf("lost combined emphasis: %+v", style.Font)
	}
	value, err := reopened.GetCellValue("Sheet1", "A1")
	if err != nil || value != element.Text {
		t.Fatalf("text round-trip: %q, %v", value, err)
	}
	formula, err := reopened.GetCellFormula("Sheet1", "A1")
	if err != nil || formula != "" {
		t.Fatalf("literal became formula: %q, %v", formula, err)
	}
}

func TestCanonicalPrintMixedTextRunsRoundTrip(t *testing.T) {
	f := excelize.NewFile()
	defer f.Close()
	w := &visualDashboardWriter{dashboardWriter: dashboardWriter{file: f}}
	e := reportprint.Element{ID: "mixed", Kind: "text", Text: "=Lead plain\nitalic", FontWeight: "bold", FontSize: 11, Box: reportprint.Box{Width: 180, Height: 36}, TextRuns: []reportprint.TextRun{{Text: "=Lead "}, {Text: "plain\n", FontWeight: "normal"}, {Text: "italic", FontWeight: "italic"}}}
	if err := w.printElement("Sheet1", e, 0); err != nil {
		t.Fatal(err)
	}
	buffer, err := f.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	reopened, err := excelize.OpenReader(buffer)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	runs, err := reopened.GetCellRichText("Sheet1", "A1")
	if err != nil {
		t.Fatal(err)
	}
	if len(runs) != 3 || runs[0].Font == nil || !runs[0].Font.Bold || runs[1].Font == nil || runs[1].Font.Bold || runs[1].Font.Italic || runs[2].Font == nil || runs[2].Font.Bold || !runs[2].Font.Italic {
		t.Fatalf("lost run styles: %+v", runs)
	}
	value, err := reopened.GetCellValue("Sheet1", "A1")
	if err != nil || value != e.Text {
		t.Fatalf("text changed: %q %v", value, err)
	}
	formula, err := reopened.GetCellFormula("Sheet1", "A1")
	if err != nil || formula != "" {
		t.Fatalf("literal became formula: %q %v", formula, err)
	}
}
