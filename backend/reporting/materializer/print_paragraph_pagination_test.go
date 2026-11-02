package materializer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// Independently authored help text reproduces both single-line paragraph
// fragments through the embedded canonical lowerer and native PDF renderer.
func TestPrintParagraphPaginationPDF(t *testing.T) {
	for _, kind := range []string{"markdownBlock", "infoPanelBlock"} {
		for _, count := range []int{24, 25} {
			t.Run(fmt.Sprintf("%s/%d", kind, count), func(t *testing.T) {
				paragraphs := make([]string, count)
				for i := range paragraphs {
					paragraphs[i] = fmt.Sprintf("Paragraph %d explains the neutral specimen.", i+1)
				}
				final := strings.Repeat("This final paragraph contains a slightly longer neutral explanation. ", 3)
				markdown := strings.Join(paragraphs, "\n\n") + "\n\n" + final
				spec := map[string]any{"version": 1, "kind": "reportSpec", "title": "Guide", "source": map[string]any{"kind": "reportBuilder", "containerId": "specimen", "stateKey": "specimen", "dataSourceRef": "primary"}, "scope": map[string]any{"params": []any{}}, "datasets": []any{}, "blocks": []any{map[string]any{"id": "help", "kind": kind, "title": "Help", "markdown": markdown, "body": markdown, "bodyFormat": "markdown"}}, "layoutIntent": map[string]any{"blockOrder": []string{"help"}}}
				raw, err := json.Marshal(spec)
				if err != nil {
					t.Fatal(err)
				}
				artifacts, err := Materialize(t.Context(), raw, map[string]json.RawMessage{})
				if err != nil {
					t.Fatal(err)
				}
				report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
				if err != nil {
					t.Fatal(err)
				}
				if len(report.Pages) != 2 {
					t.Fatalf("got %d pages", len(report.Pages))
				}
				var printed []string
				for _, page := range report.Pages {
					fragments := 0
					for _, element := range page.Elements {
						if !strings.HasPrefix(element.ID, "help__line") && !strings.HasPrefix(element.ID, "help__info") {
							continue
						}
						printed = append(printed, element.Text)
						if !strings.HasPrefix(element.Text, "Paragraph ") {
							fragments++
						}
						if element.Box.Y+element.Box.Height > 724.01 {
							t.Fatalf("body exceeds page: %+v", element.Box)
						}
					}
					if fragments != 0 && fragments != 3 {
						t.Fatalf("single-line paragraph fragment remains: %d lines", fragments)
					}
				}
				compact := func(s string) string { return strings.Join(strings.Fields(s), "") }
				if compact(strings.Join(printed, "")) != compact(markdown) {
					t.Fatal("body content was lost, duplicated or reordered")
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
				text, err := reader.GetPlainText()
				if err != nil {
					t.Fatal(err)
				}
				plain, err := io.ReadAll(text)
				if err != nil {
					t.Fatal(err)
				}
				for _, line := range printed {
					if !strings.Contains(compact(string(plain)), compact(line)) {
						t.Fatalf("PDF lost line %q", line)
					}
				}
				if output := os.Getenv("FORGE_PARAGRAPH_PDF_DIR"); output != "" {
					if err = os.MkdirAll(output, 0700); err != nil {
						t.Fatal(err)
					}
					if err = os.WriteFile(filepath.Join(output, fmt.Sprintf("paragraph-%s-%d.pdf", kind, count)), rendered.Bytes, 0600); err != nil {
						t.Fatal(err)
					}
					if err = os.WriteFile(filepath.Join(output, fmt.Sprintf("paragraph-%s-%d.print.json", kind, count)), artifacts.ReportPrint, 0600); err != nil {
						t.Fatal(err)
					}
				}
			})
		}
	}
}
