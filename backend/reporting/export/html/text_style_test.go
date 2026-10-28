package html

import (
	reportprint "github.com/viant/forge/backend/reporting/print"
	"strings"
	"testing"
)

func TestPrintTextCombinedEmphasis(t *testing.T) {
	for _, kind := range []string{"text", "tableCellText"} {
		t.Run(kind, func(t *testing.T) {
			r := sampleReport()
			e := element("styled", kind)
			e.Text, e.FontWeight = "Mixed emphasis", "700 italic"
			if kind == "tableCellText" {
				e.RowKey, e.ColumnKey = "row", "column"
			}
			r.Pages[0].Elements = append(r.Pages[0].Elements, e)
			data, err := Render(r)
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(string(data), `font-weight="700" font-style="italic"`) {
				t.Fatalf("combined emphasis missing from rendered text: %s", data)
			}
		})
	}
}

func TestPrintMixedTextRuns(t *testing.T) {
	r := sampleReport()
	e := element("runs", "text")
	e.FontWeight = "bold"
	e.Text = "Lead <plain>\nitalic"
	e.TextRuns = []reportprint.TextRun{{Text: "Lead "}, {Text: "<plain>\n", FontWeight: "normal"}, {Text: "italic", FontWeight: "italic"}}
	r.Pages[0].Elements = append(r.Pages[0].Elements, e)
	data, err := Render(r)
	if err != nil {
		t.Fatal(err)
	}
	for _, fragment := range []string{`font-weight="700" font-style="normal">Lead </tspan>`, `font-weight="400" font-style="normal">&lt;plain&gt;</tspan>`, `font-weight="400" font-style="italic">italic</tspan>`, `xml:space="preserve"`} {
		if !strings.Contains(string(data), fragment) {
			t.Fatalf("missing %s in %s", fragment, data)
		}
	}
	if strings.Count(string(data), "<text ") != 2 {
		t.Fatalf("embedded newline did not split lines: %s", data)
	}
}
