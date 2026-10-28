package pdf

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func richTextReport(element reportprint.Element) *reportprint.ReportPrint {
	return &reportprint.ReportPrint{Version: 1, Kind: "reportPrint", SpecVersion: 1, SpecHash: "spec", FillVersion: 1, FillHash: "fill", Source: reportprint.Source{Kind: "dataSource", ContainerID: "fixture", StateKey: "fixture", DataSourceRef: "fixture"}, Title: "Styled source text", PageGeometry: reportprint.PageGeometry{Width: 612, Height: 792}, Pages: []reportprint.Page{{Number: 1, Elements: []reportprint.Element{element}}}}
}
func TestRichTextPDFPreservesActualFontsAdvancesAndLinebreaks(t *testing.T) {
	element := reportprint.Element{ID: "source", Kind: "text", Box: reportprint.Box{X: 36, Y: 80, Width: 500, Height: 60}, FontSize: 12, FontWeight: "bold", Text: "Period: Version one\nBoth normal", TextRuns: []reportprint.TextRun{{Text: "Period: "}, {Text: "Version one\n", FontWeight: "italic"}, {Text: "Both", FontWeight: "bold italic"}, {Text: " normal", FontWeight: "normal"}}}
	result, err := Render(richTextReport(element), Options{})
	require.NoError(t, err)
	inspected := inspectRenderedPDF(t, result.Bytes)
	runs := inspected.pageRuns[1]
	find := func(text string) pdfTextRun {
		for _, run := range runs {
			if strings.Contains(run.Text, text) {
				return run
			}
		}
		t.Fatalf("missing %q in PDF runs: %+v", text, runs)
		return pdfTextRun{}
	}
	period, version, both, normal := find("Period:"), find("Version one"), find("Both"), find("normal")
	require.Equal(t, strings.ToLower(expectedFontName("bold")), strings.ToLower(period.Font))
	require.Equal(t, strings.ToLower(expectedFontName("italic")), strings.ToLower(version.Font))
	require.Equal(t, strings.ToLower(expectedFontName("bold italic")), strings.ToLower(both.Font))
	require.Equal(t, strings.ToLower(expectedFontName("normal")), strings.ToLower(normal.Font))
	require.InDelta(t, period.X+measureExpectedTextWidth("Period: ", 12, "bold"), version.X, 0.2)
	require.InDelta(t, 14.4, period.Y-both.Y, 0.2)
}
func TestRichTextPDFWrapUsesFontMetricsAndRejectsOverflow(t *testing.T) {
	element := reportprint.Element{ID: "source", Kind: "text", Box: reportprint.Box{X: 36, Y: 80, Width: 90, Height: 150}, FontSize: 12, Wrap: true, Text: "Wide WWWW then italic café\nNext line", TextRuns: []reportprint.TextRun{{Text: "Wide WWWW ", FontWeight: "bold"}, {Text: "then italic café\n", FontWeight: "italic"}, {Text: "Next line"}}}
	result, err := Render(richTextReport(element), Options{})
	require.NoError(t, err)
	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Contains(t, inspected.plainText, "Wide")
	require.Contains(t, inspected.plainText, "café")
	require.Contains(t, inspected.plainText, "Next line")
	for _, run := range inspected.pageRuns[1] {
		require.GreaterOrEqual(t, run.X, 35.9)
		require.LessOrEqual(t, run.X+measureExpectedTextWidth(run.Text, 12, func() string {
			if strings.Contains(strings.ToLower(run.Font), "sansb") {
				return "bold"
			}
			if strings.HasSuffix(strings.ToLower(run.Font), "i") {
				return "italic"
			}
			return "normal"
		}()), 126.2)
	}
	element.Box.Height = 10
	_, err = Render(richTextReport(element), Options{})
	require.ErrorContains(t, err, "allocated text box height")
}

func TestCanonicalStyledTextArtifactPDF(t *testing.T) {
	directory := os.Getenv("REPORT_TEXT_ARTIFACT_DIR")
	if directory == "" {
		t.Skip("optional neutral native screen/print fixture artifact")
	}
	raw, err := os.ReadFile(filepath.Join(directory, "reportPrint.json"))
	require.NoError(t, err)
	report, err := reportprint.DecodeJSON(raw)
	require.NoError(t, err)
	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(directory, "styled-text.pdf"), result.Bytes, 0600))
	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Contains(t, inspected.plainText, "Current view café")
	require.Contains(t, inspected.plainText, "1. Literal numbered prefix")
	require.Contains(t, inspected.plainText, "> Literal quotation marker")
	expected := map[string]string{"Period:": "bold", "Version one": "italic", "Leading-space subtitle": "italic", "Bold and italic together": "bold italic"}
	for text, weight := range expected {
		found := false
		for _, run := range inspected.pageRuns[1] {
			if strings.Contains(run.Text, text) {
				require.Equal(t, strings.ToLower(expectedFontName(weight)), strings.ToLower(run.Font))
				found = true
			}
		}
		require.True(t, found, text)
	}
}
