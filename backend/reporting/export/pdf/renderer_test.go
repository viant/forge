package pdf

import (
	"bytes"
	"encoding/json"
	"io"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"testing"

	"codeberg.org/go-pdf/fpdf"
	pdfreader "github.com/ledongthuc/pdf"
	"github.com/stretchr/testify/require"
	reportexport "github.com/viant/forge/backend/reporting/export"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

type pdfTextRun struct {
	PageNumber int
	Font       string
	FontSize   float64
	X          float64
	Y          float64
	Text       string
}

type inspectedPDF struct {
	pageCount  int
	plainText  string
	styledText []pdfreader.Text
	pageRuns   map[int][]pdfTextRun
	pageRects  map[int][]pdfreader.Rect
	pageStream map[int]string
}

type groupedTextRun struct {
	run  pdfTextRun
	endX float64
}

type pdfPathBlock struct {
	minX    float64
	minY    float64
	maxX    float64
	maxY    float64
	command string
}

func TestRender_SupportedSubsetIsDeterministic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "capacityBuilder",
			StateKey:      "capacityBuilder",
			DataSourceRef: "capacity_cube_report",
		},
		Title: "Supported Subset",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				HeaderElements: []reportprint.Element{
					{
						ID:         "headerTitle",
						Kind:       "text",
						Box:        reportprint.Box{X: 36, Y: 18, Width: 540, Height: 16},
						Text:       "Supported Subset",
						FontSize:   12,
						FontWeight: "600",
						Color:      "#101828",
					},
				},
				Elements: []reportprint.Element{
					{
						ID:         "sectionTitle",
						Kind:       "text",
						Box:        reportprint.Box{X: 36, Y: 84, Width: 540, Height: 18},
						Text:       "Table",
						FontSize:   14,
						FontWeight: "600",
						Color:      "#101828",
					},
					{
						ID:          "headerBackground",
						Kind:        "rect",
						Box:         reportprint.Box{X: 36, Y: 108, Width: 540, Height: 24},
						FillColor:   "#f8fafc",
						StrokeColor: "#d0d5dd",
						StrokeWidth: 1,
					},
					{
						ID:          "headerRule",
						Kind:        "line",
						Box:         reportprint.Box{X: 36, Y: 132, Width: 540, Height: 0},
						StrokeColor: "#d0d5dd",
						StrokeWidth: 1,
					},
					{
						ID:        "cellLabel",
						Kind:      "tableCellText",
						Box:       reportprint.Box{X: 42, Y: 136, Width: 120, Height: 16},
						RowKey:    "row_1",
						ColumnKey: "channel",
						Text:      "Display",
						Align:     "left",
					},
					{
						ID:              "cellBar",
						Kind:            "tableCellDataBar",
						Box:             reportprint.Box{X: 182, Y: 142, Width: 64, Height: 4},
						RowKey:          "row_1",
						ColumnKey:       "spend",
						Value:           40400,
						Min:             0,
						Max:             50000,
						FillColor:       "#2563eb",
						BackgroundColor: "#dbeafe",
					},
					{
						ID:              "cellBadge",
						Kind:            "tableCellBadge",
						Box:             reportprint.Box{X: 402, Y: 136, Width: 76, Height: 16},
						RowKey:          "row_1",
						ColumnKey:       "status",
						Label:           "Healthy",
						Tone:            "success",
						BackgroundColor: "#ecfdf3",
						TextColor:       "#027a48",
					},
				},
				FooterElements: []reportprint.Element{
					{
						ID:       "footerPage",
						Kind:     "text",
						Box:      reportprint.Box{X: 500, Y: 756, Width: 76, Height: 12},
						Text:     "Page 1",
						FontSize: 10,
						Color:    "#667085",
						Align:    "right",
					},
				},
			},
		},
		Bookmarks: []reportprint.Bookmark{
			{
				ID:         "bookmark.sectionTable",
				Title:      "Table",
				PageNumber: 1,
				Level:      1,
				ElementID:  "sectionTitle",
				Y:          84,
			},
		},
		Diagnostics: []reportprint.Diagnostic{},
	}

	first, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, first.Diagnostics)
	require.True(t, bytes.HasPrefix(first.Bytes, []byte("%PDF")))
	require.Contains(t, string(first.Bytes), "Supported Subset")
	require.Contains(t, string(first.Bytes), "Healthy")

	second, err := Render(report, Options{})
	require.NoError(t, err)
	require.Equal(t, first.Bytes, second.Bytes)
}

func TestRender_TableCellTextPreservesFontStyle(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "styledBuilder",
			StateKey:      "styledBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Styled Cell",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:         "styled_text",
						Kind:       "tableCellText",
						Box:        reportprint.Box{X: 42, Y: 136, Width: 160, Height: 16},
						RowKey:     "row_1",
						ColumnKey:  "status",
						Text:       "Styled Value",
						Align:      "left",
						FontSize:   13,
						FontWeight: "600",
						FontFamily: "Helvetica",
						Color:      "#1d4ed8",
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)

	styledTexts := extractPDFStyledTexts(t, result.Bytes)
	var matched pdfreader.Text
	found := false
	for _, entry := range styledTexts {
		if strings.TrimSpace(entry.S) == "Styled Value" {
			matched = entry
			found = true
			break
		}
	}
	require.True(t, found)
	require.Equal(t, 13.0, matched.FontSize)
	require.Contains(t, strings.ToLower(matched.Font), "bold")
}

func TestRender_TableCellLabelPillsPreserveConfiguredTextStyle(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "pillStyleBuilder",
			StateKey:      "pillStyleBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Pill Styles",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:              "tone_text",
						Kind:            "tableCellTone",
						Box:             reportprint.Box{X: 42, Y: 136, Width: 90, Height: 18},
						RowKey:          "row_1",
						ColumnKey:       "status",
						Tone:            "neutral",
						Label:           "Tone Neutral",
						BackgroundColor: "#eff6ff",
						BorderColor:     "#bfdbfe",
						TextColor:       "#1d4ed8",
						FontSize:        12,
						FontWeight:      "400",
					},
					{
						ID:              "badge_text",
						Kind:            "tableCellBadge",
						Box:             reportprint.Box{X: 152, Y: 136, Width: 90, Height: 18},
						RowKey:          "row_1",
						ColumnKey:       "health",
						Label:           "Badge Neutral",
						BackgroundColor: "#ecfdf3",
						BorderColor:     "#abefc6",
						TextColor:       "#027a48",
						FontSize:        13,
						FontWeight:      "400",
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)

	styledTexts := extractPDFStyledTexts(t, result.Bytes)
	findText := func(label string) pdfreader.Text {
		for _, entry := range styledTexts {
			if strings.TrimSpace(entry.S) == label {
				return entry
			}
		}
		t.Fatalf("missing text %q", label)
		return pdfreader.Text{}
	}

	toneText := findText("Tone Neutral")
	require.Equal(t, 12.0, toneText.FontSize)
	require.NotContains(t, strings.ToLower(toneText.Font), "bold")

	badgeText := findText("Badge Neutral")
	require.Equal(t, 13.0, badgeText.FontSize)
	require.NotContains(t, strings.ToLower(badgeText.Font), "bold")
}

func TestRender_ReturnsErrorForNilReport(t *testing.T) {
	result, err := Render(nil, Options{})
	require.Nil(t, result)
	require.EqualError(t, err, "reportPrint is required")
}

func TestRenderDocumentProgram_ReturnsErrorForNilProgram(t *testing.T) {
	result, err := renderDocumentProgram(nil, Options{})
	require.Nil(t, result)
	require.EqualError(t, err, "documentProgram is required")
}

func TestResolveDocumentOrientationAndSize_LandscapePreservesWidePage(t *testing.T) {
	orientation, size := resolveDocumentOrientationAndSize(reportprint.PageGeometry{
		Width:  792,
		Height: 612,
	})
	require.Equal(t, fpdf.OrientationLandscape, orientation)
	require.Equal(t, 612.0, size.Wd)
	require.Equal(t, 792.0, size.Ht)

	pdf := fpdf.NewCustom(&fpdf.InitType{
		OrientationStr: orientation,
		UnitStr:        fpdf.UnitPoint,
		Size:           size,
	})
	width, height := pdf.GetPageSize()
	require.Equal(t, 792.0, width)
	require.Equal(t, 612.0, height)
}

func TestNormalizeSeverity_UnknownDefaultsToWarning(t *testing.T) {
	require.Equal(t, "warning", normalizeSeverity(""))
	require.Equal(t, "warning", normalizeSeverity("debug"))
	require.Equal(t, "info", normalizeSeverity("INFO"))
}

func TestParseHexColor_ExpandsThreeDigitHex(t *testing.T) {
	red, green, blue := parseHexColor("#3af", 0, 0, 0)
	require.Equal(t, 0x33, red)
	require.Equal(t, 0xaa, green)
	require.Equal(t, 0xff, blue)

	red, green, blue = parseHexColor("#3afc", 0, 0, 0)
	require.Equal(t, 0x33, red)
	require.Equal(t, 0xaa, green)
	require.Equal(t, 0xff, blue)

	red, green, blue = parseHexColor("#3366ccaa", 0, 0, 0)
	require.Equal(t, 0x33, red)
	require.Equal(t, 0x66, green)
	require.Equal(t, 0xcc, blue)
}

func TestParseSVGLength_NormalizesExplicitUnits(t *testing.T) {
	require.Equal(t, 10.0, parseSVGLength("10"))
	require.Equal(t, 10.0, parseSVGLength("10px"))
	require.InDelta(t, 96.0, parseSVGLength("72pt"), 0.0001)
	require.InDelta(t, 96.0, parseSVGLength("1in"), 0.0001)
	require.InDelta(t, 96.0, parseSVGLength("25.4mm"), 0.0001)
	require.InDelta(t, 96.0, parseSVGLength("2.54cm"), 0.0001)
	require.InDelta(t, 96.0, parseSVGLength("6pc"), 0.0001)
}

func TestRender_TextWrapRespectsBoxHeight(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "wrappedTextBuilder",
			StateKey:      "wrappedTextBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Wrapped Text",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:       "wrapped_text",
						Kind:     "text",
						Box:      reportprint.Box{X: 42, Y: 136, Width: 160, Height: 24},
						Text:     "Line 1\nLine 2\nLine 3",
						FontSize: 10,
						Wrap:     true,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)

	pageCount, plainText := extractPDFPlainText(t, result.Bytes)
	require.Equal(t, 1, pageCount)
	require.Contains(t, plainText, "Line 1")
	require.Contains(t, plainText, "Line 2")
	require.NotContains(t, plainText, "Line 3")
}

func TestRender_LineDashStylesEmitDashPattern(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "dashBuilder",
			StateKey:      "dashBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Dash Styles",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:          "dashed_line",
						Kind:        "line",
						Box:         reportprint.Box{X: 36, Y: 84, Width: 180, Height: 0},
						StrokeColor: "#d0d5dd",
						StrokeWidth: 2,
						StrokeStyle: "dashed",
					},
					{
						ID:          "dotted_line",
						Kind:        "line",
						Box:         reportprint.Box{X: 36, Y: 108, Width: 180, Height: 0},
						StrokeColor: "#344054",
						StrokeWidth: 1,
						StrokeStyle: "dotted",
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.Regexp(t, regexp.MustCompile(`\[[0-9.]+\s+[0-9.]+\]\s+0(?:\.0+)?\s+d`), contentStream)
	require.True(t, hasMatchingMoveLine(contentStream, 36, 708, 216, 708))
	require.True(t, hasMatchingMoveLine(contentStream, 36, 684, 216, 684))
}

func TestRender_RoundedRectPlaybackEmitsCurvedPath(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "roundedRectBuilder",
			StateKey:      "roundedRectBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Rounded Rect",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:        "rounded_rect",
						Kind:      "rect",
						Box:       reportprint.Box{X: 36, Y: 84, Width: 80, Height: 40},
						FillColor: "#f8fafc",
						Radius:    8,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.True(t, hasMatchingPathBounds(contentStream, 36, 708, 116, 668, "f"))
}

func TestRender_RawFixtureRendersCanonicalSVGContent(t *testing.T) {
	report := loadRawFixtureReportPrint(t)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))

	require.Contains(t, string(result.Bytes), "Performance Report")
	require.Contains(t, string(result.Bytes), "Manual Spend Trend")
	require.Contains(t, string(result.Bytes), "Display")
	require.Contains(t, string(result.Bytes), "CTV")
}

func TestRender_UnsupportedImageProducesDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "imageBuilder",
			StateKey:      "imageBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Image Placeholder",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "image_1",
						Kind: "image",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 120, Height: 90},
						Image: &reportprint.Image{
							MimeType: "image/png",
							Payload:  tinyPNGBase64,
						},
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintImageMimeType"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "invalidReportPrintImagePayload"))
}

func TestRender_InvalidImagePayloadProducesDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "invalidImageBuilder",
			StateKey:      "invalidImageBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Invalid Image",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "invalid_image",
						Kind: "image",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 120, Height: 90},
						Image: &reportprint.Image{
							MimeType: "image/png",
							Payload:  "aGVsbG8=",
						},
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Len(t, findDiagnosticsByCode(result.Diagnostics, "invalidReportPrintImagePayload"), 1)
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
}

func TestRender_ImageWithMimeParametersProducesPDF(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "parameterizedImageBuilder",
			StateKey:      "parameterizedImageBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Parameterized Image",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "image_with_params",
						Kind: "image",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 120, Height: 90},
						Image: &reportprint.Image{
							MimeType: "image/png;base64",
							Payload:  tinyPNGBase64,
						},
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintImageMimeType"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "invalidReportPrintImagePayload"))
}

func TestRender_WebPImagesAreAccepted(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "webpImageBuilder",
			StateKey:      "webpImageBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "WebP Image",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "webp_image",
						Kind: "image",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 120, Height: 90},
						Image: &reportprint.Image{
							MimeType: "image/webp",
							Payload:  tinyWEBPBase64,
						},
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintImageMimeType"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "invalidReportPrintImagePayload"))
}

func TestRender_GeoFixtureMatchesPreviewVisibleLabels(t *testing.T) {
	report := loadFixtureReportPrint(t, "geo")

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
	inspected := inspectRenderedPDF(t, result.Bytes)

	// Preview and PDF both consume the same canonical ReportPrint svg payload, so
	// these labels are a lightweight parity signal for the current visual subset.
	require.Contains(t, inspected.plainText, "2 Regions")
	require.Contains(t, inspected.plainText, "Total Spend: $220")
	require.Contains(t, inspected.plainText, "Top: CA")
	require.Contains(t, inspected.plainText, "CA")
	require.Contains(t, inspected.plainText, "WA")
}

func TestRender_GeoFixtureShapeParity(t *testing.T) {
	report := loadFixtureReportPrint(t, "geo")
	require.GreaterOrEqual(t, len(report.Pages), 2)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
	inspected := inspectRenderedPDF(t, result.Bytes)
	pageContent := inspected.pageStream[2]
	pageRuns := inspected.pageRuns[2]

	// Selected-area pill from the canonical geo preview svg.
	require.True(t, hasGraphicsStateUsage(pageContent))
	require.True(t, hasMatchingPathBounds(pageContent, 340, 598, 396, 580, "f"))
	require.True(t, hasMatchingPDFTextRun(pageRuns, pdfTextRun{
		PageNumber: 2,
		Text:       "Critical",
		FontSize:   10,
		X:          350,
		Y:          585,
	}))

	// Top-region bars from the same canonical geo preview svg.
	require.True(t, hasMatchingPathBounds(pageContent, 386, 522, 514, 514, "f"))
	require.True(t, hasMatchingPathBounds(pageContent, 386, 504, 459.14286, 496, "f"))
	require.True(t, hasMatchingPDFTextRun(pageRuns, pdfTextRun{
		PageNumber: 2,
		Text:       "CA",
		FontSize:   10,
		X:          340,
		Y:          513,
	}))
	require.True(t, hasMatchingPDFTextRun(pageRuns, pdfTextRun{
		PageNumber: 2,
		Text:       "WA",
		FontSize:   10,
		X:          340,
		Y:          495,
	}))
}

func TestRender_AuthoredFixtureShapeParity(t *testing.T) {
	report := loadFixtureReportPrint(t, "authored")
	require.GreaterOrEqual(t, len(report.Pages), 4)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
	inspected := inspectRenderedPDF(t, result.Bytes)
	page3 := inspected.pageStream[3]
	page4 := inspected.pageStream[4]
	page3Runs := inspected.pageRuns[3]
	page4Runs := inspected.pageRuns[4]
	page3Rects := inspected.pageRects[3]
	page4Rects := inspected.pageRects[4]

	// Page 3 keeps the smaller table data bars and alternating status badges
	// from the authored comparison table preview.
	require.True(t, hasMatchingPDFRect(page3Rects, 222, 680, 250.8, 664))
	require.True(t, hasMatchingPDFRect(page3Rects, 222, 656, 255.6, 640))
	require.True(t, hasMatchingPathBounds(page3, 402, 680, 471, 664, "B"))
	require.True(t, hasMatchingPDFTextRun(page3Runs, pdfTextRun{
		PageNumber: 3,
		Text:       "Healthy",
		FontSize:   10,
		X:          418.44,
		Y:          669,
	}))
	require.True(t, hasMatchingPDFTextRun(page3Runs, pdfTextRun{
		PageNumber: 3,
		Text:       "Critical",
		FontSize:   10,
		X:          423.05,
		Y:          645,
	}))

	// Page 4 preserves the larger later-row bar widths and badge geometry.
	require.True(t, hasMatchingPDFRect(page4Rects, 222, 680, 370.8, 664))
	require.True(t, hasMatchingPDFRect(page4Rects, 222, 656, 375.6, 640))
	require.True(t, hasMatchingPathBounds(page4, 402, 680, 478, 664, "B"))
	require.True(t, hasMatchingPDFTextRun(page4Runs, pdfTextRun{
		PageNumber: 4,
		Text:       "Critical",
		FontSize:   10,
		X:          423.05,
		Y:          669,
	}))
	require.True(t, hasMatchingPDFTextRun(page4Runs, pdfTextRun{
		PageNumber: 4,
		Text:       "Healthy",
		FontSize:   10,
		X:          418.44,
		Y:          621,
	}))
}

func TestRender_FixturePreviewParityTextAndPages(t *testing.T) {
	for _, variant := range []string{"raw", "semantic", "geo", "authored"} {
		t.Run(variant, func(t *testing.T) {
			report := loadFixtureReportPrint(t, variant)

			result, err := Render(report, Options{})
			require.NoError(t, err)
			require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
			require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
			inspected := inspectRenderedPDF(t, result.Bytes)
			require.Equal(t, len(report.Pages), inspected.pageCount)

			expectedPreviewLabels := collectPreviewVisibleSVGLabels(report)
			require.NotEmpty(t, expectedPreviewLabels)
			for _, label := range expectedPreviewLabels {
				require.Contains(t, inspected.plainText, label)
			}
		})
	}
}

func TestRender_FixturePreviewParitySVGTextGeometry(t *testing.T) {
	for _, variant := range []string{"raw", "semantic", "geo", "authored"} {
		t.Run(variant, func(t *testing.T) {
			report := loadFixtureReportPrint(t, variant)

			result, err := Render(report, Options{})
			require.NoError(t, err)
			require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
			require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
			inspected := inspectRenderedPDF(t, result.Bytes)
			expectedRuns := collectExpectedSVGTextRuns(report)
			require.NotEmpty(t, expectedRuns)

			for _, expected := range expectedRuns {
				require.Truef(
					t,
					hasMatchingPDFTextRun(inspected.pageRuns[expected.PageNumber], expected),
					"missing geometry-parity match for page=%d text=%q x=%.2f y=%.2f size=%.2f",
					expected.PageNumber,
					expected.Text,
					expected.X,
					expected.Y,
					expected.FontSize,
				)
			}
		})
	}
}

func TestRender_AuthoredLandscapeFixturePreservesPageSizeAndRightEdgeContent(t *testing.T) {
	report := loadStandaloneFixtureReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "authored-landscape-report-print-fixture.v1.json",
		),
	)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)
	require.Contains(t, string(result.Bytes), "/MediaBox [0 0 792.00 612.00]")

	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Equal(t, 1, inspected.pageCount)
	require.Contains(t, inspected.plainText, "Impressions")
	require.Contains(t, inspected.plainText, "Channel Trend")
	require.Contains(t, inspected.plainText, "2026-05-04")
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[1], "Impressions", 640))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[1], "2026-05-04", 650))
}

func TestRender_AuthoredLandscapeFixtureChartSVGTextGeometry(t *testing.T) {
	report := loadStandaloneFixtureReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "authored-landscape-report-print-fixture.v1.json",
		),
	)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))

	inspected := inspectRenderedPDF(t, result.Bytes)
	expectedRuns := collectExpectedSVGTextRuns(report)
	targets := map[string]bool{
		"55.2K":      true,
		"2026-05-04": true,
		"Display":    true,
		"CTV":        true,
	}
	matched := 0
	for _, expected := range expectedRuns {
		if !targets[strings.TrimSpace(expected.Text)] {
			continue
		}
		require.Truef(
			t,
			hasMatchingPDFTextRun(inspected.pageRuns[expected.PageNumber], expected),
			"missing landscape chart text geometry for page=%d text=%q x=%.2f y=%.2f size=%.2f",
			expected.PageNumber,
			expected.Text,
			expected.X,
			expected.Y,
			expected.FontSize,
		)
		matched++
	}
	require.Equal(t, len(targets), matched)
}

func TestRender_AuthoredLandscapeExportRequestFixturePreservesPDFParity(t *testing.T) {
	report := loadStandaloneExportRequestReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "authored-landscape-export-request-fixture.v1.json",
		),
	)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)
	require.Contains(t, string(result.Bytes), "/MediaBox [0 0 792.00 612.00]")

	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Equal(t, 1, inspected.pageCount)
	require.Contains(t, inspected.plainText, "Impressions")
	require.Contains(t, inspected.plainText, "Channel Trend")
	require.Contains(t, inspected.plainText, "2026-05-04")
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[1], "Impressions", 640))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[1], "2026-05-04", 650))

	expectedRuns := collectExpectedSVGTextRuns(report)
	targets := map[string]bool{
		"55.2K":      true,
		"2026-05-04": true,
		"Display":    true,
		"CTV":        true,
	}
	matched := 0
	for _, expected := range expectedRuns {
		if !targets[strings.TrimSpace(expected.Text)] {
			continue
		}
		require.Truef(
			t,
			hasMatchingPDFTextRun(inspected.pageRuns[expected.PageNumber], expected),
			"missing export-request chart text geometry for page=%d text=%q x=%.2f y=%.2f size=%.2f",
			expected.PageNumber,
			expected.Text,
			expected.X,
			expected.Y,
			expected.FontSize,
		)
		matched++
	}
	require.Equal(t, len(targets), matched)
}

func TestRender_AuthoredLandscapeExportRequestFixtureTranslatedPathGroupMovesChartPath(t *testing.T) {
	report := loadStandaloneExportRequestReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "authored-landscape-export-request-fixture.v1.json",
		),
	)

	mutateFirstSVGPathIntoTranslatedGroup(t, report, "channelTrend__svg_page_1", "translate(10,0)")

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.True(t, hasMatchingMoveLine(contentStream, 98, 279.7391304347826, 532.6666666666667, 328))
	require.False(t, hasMatchingMoveLine(contentStream, 88, 279.7391304347826, 522.6666666666667, 328))
}

func TestRender_AuthoredLandscapeFixtureTranslatedPathGroupMovesChartPath(t *testing.T) {
	report := loadStandaloneFixtureReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "authored-landscape-report-print-fixture.v1.json",
		),
	)

	mutateFirstSVGPathIntoTranslatedGroup(t, report, "channelTrend__svg_page_1", "translate(10,0)")

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.True(t, hasMatchingMoveLine(contentStream, 98, 279.7391304347826, 532.6666666666667, 328))
	require.False(t, hasMatchingMoveLine(contentStream, 88, 279.7391304347826, 522.6666666666667, 328))
}

func TestRender_AuthoredLandscapeGeoFixturePreservesPageSizeAndGeoSVGTextGeometry(t *testing.T) {
	report := loadStandaloneFixtureReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "authored-landscape-geo-report-print-fixture.v1.json",
		),
	)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)
	require.Contains(t, string(result.Bytes), "/MediaBox [0 0 792.00 612.00]")

	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Equal(t, 1, inspected.pageCount)
	require.Contains(t, inspected.plainText, "State Performance")
	require.Contains(t, inspected.plainText, "California (CA)")
	require.Contains(t, inspected.plainText, "Top Regions")
	require.Contains(t, inspected.plainText, "$1,200,000")

	expectedRuns := collectExpectedSVGTextRuns(report)
	targets := map[string]bool{
		"Total Spend: $2,180,000": true,
		"California (CA)":         true,
		"Top Regions":             true,
		"$1,200,000":              true,
		"$980,000":                true,
	}
	matched := 0
	for _, expected := range expectedRuns {
		if !targets[strings.TrimSpace(expected.Text)] {
			continue
		}
		require.Truef(
			t,
			hasMatchingPDFTextRun(inspected.pageRuns[expected.PageNumber], expected),
			"missing landscape geo text geometry for page=%d text=%q x=%.2f y=%.2f size=%.2f",
			expected.PageNumber,
			expected.Text,
			expected.X,
			expected.Y,
			expected.FontSize,
		)
		matched++
	}
	require.Equal(t, len(targets), matched)
}

func TestRender_CapacityDirectSeriesExportRequestFixturePreservesPDFParity(t *testing.T) {
	report := loadStandaloneExportRequestReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "capacity-direct-series-export-request-fixture.v1.json",
		),
	)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)
	require.Contains(t, string(result.Bytes), "/MediaBox [0 0 792.00 612.00]")

	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Equal(t, 3, inspected.pageCount)
	require.Contains(t, inspected.plainText, "Capacity KPI Blend Q3")
	require.Contains(t, inspected.plainText, "Avails + HH Uniques by Date")
	require.Contains(t, inspected.plainText, "Headline KPI")
	require.Contains(t, inspected.plainText, "Delivery Comparison")
	require.Contains(t, inspected.plainText, "2026-05-04")
	require.NotContains(t, inspected.plainText, "Chart output is not available for this ReportPrint block.")
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[2], "Avails + HH Uniques by Date", 30))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[2], "Headline KPI", 30))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[2], "Delivery Comparison", 30))

	expectedRuns := collectExpectedSVGTextRuns(report)
	targets := map[string]bool{
		"78.4K":      true,
		"52.3K":      true,
		"2026-05-01": true,
		"2026-05-04": true,
	}
	matchedTargets := map[string]bool{}
	for _, expected := range expectedRuns {
		targetText := strings.TrimSpace(expected.Text)
		if !targets[targetText] || matchedTargets[targetText] {
			continue
		}
		require.Truef(
			t,
			hasMatchingPDFTextRun(inspected.pageRuns[expected.PageNumber], expected),
			"missing direct-series export-request chart text geometry for page=%d text=%q x=%.2f y=%.2f size=%.2f",
			expected.PageNumber,
			expected.Text,
			expected.X,
			expected.Y,
			expected.FontSize,
		)
		matchedTargets[targetText] = true
	}
	require.Equal(t, len(targets), len(matchedTargets))
}

func TestRender_CapacityDirectSeriesExportRequestFixtureTranslatedPathGroupMovesChartPath(t *testing.T) {
	report := loadStandaloneExportRequestReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "capacity-direct-series-export-request-fixture.v1.json",
		),
	)

	mutateFirstSVGPathIntoTranslatedGroup(t, report, "primaryChart__svg_page_2", "translate(10,0)")

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.True(t, hasMatchingMoveLine(contentStream, 98, 379.63265306122446, 315.33333333333337, 382.84693877551024))
	require.False(t, hasMatchingMoveLine(contentStream, 88, 379.63265306122446, 305.33333333333337, 382.84693877551024))
}

func TestRender_AuthoredLandscapeMixedFixturePreservesLandscapeParityAcrossPages(t *testing.T) {
	report := loadStandaloneFixtureReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "authored-landscape-mixed-report-print-fixture.v1.json",
		),
	)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
	require.Contains(t, string(result.Bytes), "/MediaBox [0 0 792.00 612.00]")

	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Equal(t, 2, inspected.pageCount)
	require.Contains(t, inspected.plainText, "Channel Trend")
	require.Contains(t, inspected.plainText, "State Performance")
	require.Contains(t, inspected.plainText, "Top Regions")
	require.Contains(t, inspected.plainText, "$2,400,000")

	expectedRuns := collectExpectedSVGTextRuns(report)
	targets := map[string]bool{
		"55.2K":                   true,
		"2026-05-04":              true,
		"Display":                 true,
		"Total Spend: $4,360,000": true,
		"California (CA)":         true,
		"$2,400,000":              true,
	}
	matched := 0
	for _, expected := range expectedRuns {
		if !targets[strings.TrimSpace(expected.Text)] {
			continue
		}
		require.Truef(
			t,
			hasMatchingPDFTextRun(inspected.pageRuns[expected.PageNumber], expected),
			"missing mixed landscape text geometry for page=%d text=%q x=%.2f y=%.2f size=%.2f",
			expected.PageNumber,
			expected.Text,
			expected.X,
			expected.Y,
			expected.FontSize,
		)
		matched++
	}
	require.Equal(t, len(targets), matched)
}

func TestRender_AuthoredLandscapeMixedBuilderFixturePreservesLandscapeParityAcrossPages(t *testing.T) {
	report := loadStandaloneFixtureReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "authored-landscape-mixed-builder-report-print-fixture.v1.json",
		),
	)

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintElement"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
	require.Contains(t, string(result.Bytes), "/MediaBox [0 0 792.00 612.00]")

	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Equal(t, 2, inspected.pageCount)
	require.Contains(t, inspected.plainText, "Channel Trend")
	require.Contains(t, inspected.plainText, "State Performance")
	require.Contains(t, inspected.plainText, "Executive Summary")
	require.Contains(t, inspected.plainText, "Headline KPI")
	require.NotContains(t, inspected.plainText, "Chart output is not available for this ReportPrint block.")
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[2], "Executive Summary", 30))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[2], "Headline KPI", 400))

	expectedRuns := collectExpectedSVGTextRuns(report)
	targets := map[string]bool{
		"55.2K":                         true,
		"Display":                       true,
		"Total State Spend: $4,360,000": true,
		"California (CA)":               true,
		"$2,400,000":                    true,
	}
	matchedTargets := map[string]bool{}
	for _, expected := range expectedRuns {
		targetText := strings.TrimSpace(expected.Text)
		if !targets[targetText] || matchedTargets[targetText] {
			continue
		}
		require.Truef(
			t,
			hasMatchingPDFTextRun(inspected.pageRuns[expected.PageNumber], expected),
			"missing mixed builder landscape text geometry for page=%d text=%q x=%.2f y=%.2f size=%.2f",
			expected.PageNumber,
			expected.Text,
			expected.X,
			expected.Y,
			expected.FontSize,
		)
		matchedTargets[targetText] = true
	}
	require.Equal(t, len(targets), len(matchedTargets))
}

func TestRender_CapacityInventoryLandscapeFixturePreservesLandscapeParityAcrossPages(t *testing.T) {
	report := loadStandaloneFixtureReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "capacity-inventory-landscape-report-print-fixture.v1.json",
		),
	)

	assertCapacityInventoryLandscapeParityAcrossPages(t, report)
}

func TestRender_CapacityInventoryExportRequestFixturePreservesLandscapeParityAcrossPages(t *testing.T) {
	report := loadStandaloneExportRequestReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "capacity-inventory-export-request-fixture.v1.json",
		),
	)

	assertCapacityInventoryLandscapeParityAcrossPages(t, report)
}

func TestRender_CapacityLocationLandscapeFixturePreservesLandscapeParityAcrossPages(t *testing.T) {
	report := loadStandaloneFixtureReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "capacity-location-landscape-report-print-fixture.v1.json",
		),
	)

	assertCapacityLocationLandscapeParityAcrossPages(t, report)
}

func TestRender_CapacityLocationExportRequestFixturePreservesLandscapeParityAcrossPages(t *testing.T) {
	report := loadStandaloneExportRequestReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "capacity-location-export-request-fixture.v1.json",
		),
	)

	assertCapacityLocationLandscapeParityAcrossPages(t, report)
}

func TestRender_CapacityAudiencePDFExportFixturePreservesLandscapeParityAcrossPages(t *testing.T) {
	assertCapacityAudienceLandscapeParityAcrossPages(t, loadAudienceFixtureReportPrint(t))
}

func TestRender_CapacityAudienceExportRequestFixturePreservesLandscapeParityAcrossPages(t *testing.T) {
	report := loadStandaloneExportRequestReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "capacity-audience-export-request-fixture.v1.json",
		),
	)

	assertCapacityAudienceLandscapeParityAcrossPages(t, report)
}

func TestRender_InvalidSVGReportsStructuredDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "invalidSvgBuilder",
			StateKey:      "invalidSvgBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Invalid SVG",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "invalid_svg_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 200, Height: 120},
						SVG:  `<svg viewBox="0 0 200 120" width="200" height="120"><text x="10" y="20">unterminated`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Len(t, result.Diagnostics, 1)
	require.Equal(t, "invalidReportPrintSVG", result.Diagnostics[0].Code)
	require.Contains(t, result.Diagnostics[0].Message, "could not parse svg content")
	require.Contains(t, result.Diagnostics[0].Message, "EOF")
}

func TestResolveRectStyleTreatsNoneAsTransparent(t *testing.T) {
	require.Equal(t, "D", resolveRectStyle("none", "#d0d5dd", 1))
	require.Equal(t, "F", resolveRectStyle("#f8fafc", "none", 1))
	require.Equal(t, "", resolveRectStyle("none", "none", 1))
	require.Equal(t, false, hasPaintValue("none"))
	require.Equal(t, false, hasPaintValue(" NONE "))
	require.Equal(t, true, hasPaintValue("#ffffff"))
}

func TestRender_SVGPathSmoke(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgPathBuilder",
			StateKey:      "svgPathBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Path",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_path_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG: `<svg viewBox="0 0 220 80" width="220" height="80">
						  <path d="M20,20 L200,20" fill="none" stroke="#ff0000" stroke-width="2" />
						  <circle cx="20" cy="20" r="2.5" fill="#ff0000" />
						  <circle cx="200" cy="20" r="2.5" fill="#ff0000" />
						  <text x="110" y="56" text-anchor="middle" font-size="11" fill="#344054">Path Legend</text>
						</svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "invalidReportPrintSVG"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "invalidReportPrintSVGPath"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))

	pageCount, plainText := extractPDFPlainText(t, result.Bytes)
	require.Equal(t, 1, pageCount)
	require.Contains(t, plainText, "Path Legend")

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.Contains(t, contentStream, "1.000 0.000 0.000 RG")
	require.True(t, hasMatchingMoveLine(contentStream, 56, 688, 236, 688))
}

func TestRender_SVGRectHonorsViewBoxOrigin(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgRectBuilder",
			StateKey:      "svgRectBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Rect",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_rect_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 100, Height: 100},
						SVG:  `<svg viewBox="10 10 100 100" width="100" height="100"><rect x="10" y="10" width="20" height="20" fill="#ff0000" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	rects := extractPDFRects(t, result.Bytes)
	require.NotEmpty(t, rects)
	require.True(t, hasMatchingPDFRect(rects, 36, 708, 56, 688))
}

func TestRender_SVGPathHonorsViewBoxOrigin(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgOffsetPathBuilder",
			StateKey:      "svgOffsetPathBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Offset Path",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_offset_path_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="10 10 220 80" width="220" height="80"><path d="M20,20 L200,20" fill="none" stroke="#ff0000" stroke-width="2" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.Contains(t, contentStream, "1.000 0.000 0.000 RG")
	require.True(t, hasMatchingMoveLine(contentStream, 46, 698, 226, 698))
}

func TestRender_SVGPathDefaultsStrokeWidthWhenStrokeIsPresent(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgDefaultStrokeBuilder",
			StateKey:      "svgDefaultStrokeBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Default Stroke",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_default_stroke_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><path d="M20,20 L200,20" fill="none" stroke="#ff0000" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.Contains(t, contentStream, "1.00 w")
	require.True(t, hasMatchingMoveLine(contentStream, 56, 688, 236, 688))
}

func TestRender_SVGLineWithNoStrokeDoesNotRender(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgNoStrokeBuilder",
			StateKey:      "svgNoStrokeBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG No Stroke",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_no_stroke_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><line x1="20" y1="20" x2="200" y2="20" stroke="none" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.False(t, hasMatchingMoveLine(contentStream, 56, 688, 236, 688))
}

func TestRender_SVGRectOpacityEmitsAlphaGraphicsState(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgOpacityBuilder",
			StateKey:      "svgOpacityBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Opacity",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_opacity_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><rect x="20" y="20" width="60" height="20" rx="10" fill="#db3737" opacity="0.18" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.Contains(t, contentStream, "gs")
	require.True(t, hasMatchingAlphaDefinition(string(result.Bytes), 0.18))
}

func TestRender_SVGRectOpacityComposesWithFillOpacity(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgOpacityComposeBuilder",
			StateKey:      "svgOpacityComposeBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Opacity Compose",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_opacity_compose_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><rect x="20" y="20" width="60" height="20" rx="10" fill="#db3737" opacity="0.5" fill-opacity="0.5" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)
	require.True(t, hasMatchingAlphaDefinition(string(result.Bytes), 0.25))
}

func TestRender_SVGLineOpacityUsesStrokeChannel(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgLineOpacityBuilder",
			StateKey:      "svgLineOpacityBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Line Opacity",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_line_opacity_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><line x1="20" y1="20" x2="200" y2="20" stroke="#344054" opacity="0.5" stroke-opacity="0.5" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)
	require.True(t, hasMatchingAlphaDefinition(string(result.Bytes), 0.25))
}

func TestRender_ZeroSizedSVGBoxReportsViewportDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "zeroSvgBuilder",
			StateKey:      "zeroSvgBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Zero SVG",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "zero_svg_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 200, Height: 0},
						SVG:  `<svg viewBox="0 0 200 120" width="200" height="120"><text x="10" y="20">Hello</text></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Len(t, result.Diagnostics, 1)
	require.Equal(t, "invalidReportPrintSVGViewport", result.Diagnostics[0].Code)
	require.Contains(t, result.Diagnostics[0].Message, "positive width and height")
}

func TestRender_SVGTextWithTspanStillRendersText(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgTspanBuilder",
			StateKey:      "svgTspanBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Tspan",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_tspan_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><text x="110" y="40" text-anchor="middle" font-size="11" fill="#344054"><tspan>Nested Label</tspan></text></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "invalidReportPrintSVG"))

	pageCount, plainText := extractPDFPlainText(t, result.Bytes)
	require.Equal(t, 1, pageCount)
	require.Contains(t, plainText, "Nested Label")
}

func TestRender_SVGGroupProducesExplicitDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgGroupStyleBuilder",
			StateKey:      "svgGroupStyleBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Group Style",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_group_style_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><g transform="scale(2)"><rect x="10" y="10" width="20" height="20" /></g></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Len(t, result.Diagnostics, 1)
	require.Equal(t, "unsupportedReportPrintSVGGroup", result.Diagnostics[0].Code)
}

func TestRender_SVGTranslateGroupProducesPDF(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgTranslateGroupBuilder",
			StateKey:      "svgTranslateGroupBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Translate Group",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "translated_svg",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><g transform="translate(10,10)"><rect x="10" y="10" width="20" height="20" /></g></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGGroup"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
}

func TestRender_SVGTranslatePathGroupProducesPDF(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgTranslatePathGroupBuilder",
			StateKey:      "svgTranslatePathGroupBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Translate Path Group",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "translated_svg_path",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><g transform="translate(10,10)"><path d="M10,10 L30,10" fill="none" stroke="#ff0000" stroke-width="2" /></g></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "invalidReportPrintSVGPath"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGGroup"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.Contains(t, contentStream, "1.000 0.000 0.000 RG")
	require.True(t, hasMatchingMoveLine(contentStream, 56, 688, 76, 688))
}

func TestRender_SupportedSVGStyleAttributeProducesPDF(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgStyleAttrBuilder",
			StateKey:      "svgStyleAttrBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Style Attribute",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_style_attr_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><rect x="40" y="10" width="20" height="20" style="fill:#00ff00" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGStyleAttribute"))
}

func TestRender_ReportsUnsupportedSVGStyleAttributeDiagnostic(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgStyleAttributeBuilder",
			StateKey:      "svgStyleAttributeBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "Unsupported SVG Style",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_style_attr_unsupported",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><rect x="40" y="10" width="20" height="20" style="transform:scale(2)" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Len(t, result.Diagnostics, 1)
	require.Equal(t, "unsupportedReportPrintSVGStyleAttribute", result.Diagnostics[0].Code)
}

func TestRender_SVGStyleTranslateProducesPDF(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgStyleTranslateBuilder",
			StateKey:      "svgStyleTranslateBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Style Translate",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_style_translate",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><rect x="40" y="10" width="20" height="20" style="transform:translate(10px, 0);fill:#00ff00" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGStyleAttribute"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
}

func TestRender_SVGDashPatternProducesPDF(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgDashBuilder",
			StateKey:      "svgDashBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Dash",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_dash_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><line x1="10" y1="10" x2="200" y2="10" stroke="#ff0000" stroke-width="2" stroke-dasharray="4 2" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(result.Bytes, []byte("%PDF")))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGStyleAttribute"))
	require.Empty(t, findDiagnosticsByCode(result.Diagnostics, "unsupportedReportPrintSVGChild"))
}

func TestRender_SVGDefaultFillStillRendersTextAndRect(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgDefaultFillBuilder",
			StateKey:      "svgDefaultFillBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Default Fill",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_default_fill_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><rect x="10" y="10" width="40" height="20" /><text x="60" y="30">Default Text</text></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	pageCount, plainText := extractPDFPlainText(t, result.Bytes)
	require.Equal(t, 1, pageCount)
	require.Contains(t, plainText, "Default Text")

	rects := extractPDFRects(t, result.Bytes)
	require.True(t, hasMatchingPDFRect(rects, 46, 698, 86, 678))
}

func TestRender_SVGDefaultFillStillRendersPathAndCircle(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgDefaultPaintBuilder",
			StateKey:      "svgDefaultPaintBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Default Paint",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_default_path_circle_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 220, Height: 80},
						SVG:  `<svg viewBox="0 0 220 80" width="220" height="80"><path d="M10,10 L50,10 L50,30 L10,30 Z" /><circle cx="90" cy="20" r="10" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	contentStream := extractPDFContentStreams(t, result.Bytes)
	require.Contains(t, contentStream, "0.000 g")
	require.True(t, hasMatchingMoveLine(contentStream, 46, 698, 86, 698))
	require.True(t, hasMatchingPathBounds(contentStream, 116, 698, 136, 678, "f"))
}

func TestRender_SVGExplicitLengthUnitsNormalizeIntoViewportSpace(t *testing.T) {
	report := &reportprint.ReportPrint{
		Version:     1,
		Kind:        "reportPrint",
		SpecVersion: 1,
		SpecHash:    "fnv1a:test-spec",
		FillVersion: 1,
		FillHash:    "fnv1a:test-fill",
		Source: reportprint.Source{
			Kind:          "dashboard.reportBuilder",
			ContainerID:   "svgUnitBuilder",
			StateKey:      "svgUnitBuilder",
			DataSourceRef: "demoReportSource",
		},
		Title: "SVG Units",
		PageGeometry: reportprint.PageGeometry{
			Width:        612,
			Height:       792,
			MarginTop:    36,
			MarginRight:  36,
			MarginBottom: 36,
			MarginLeft:   36,
			HeaderHeight: 36,
			FooterHeight: 24,
		},
		Pages: []reportprint.Page{
			{
				Number: 1,
				Elements: []reportprint.Element{
					{
						ID:   "svg_units_1",
						Kind: "svg",
						Box:  reportprint.Box{X: 36, Y: 84, Width: 200, Height: 100},
						SVG:  `<svg viewBox="0 0 200 100" width="200" height="100"><rect x="72pt" y="72pt" width="72pt" height="72pt" fill="#ff0000" /></svg>`,
					},
				},
			},
		},
	}

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)

	rects := extractPDFRects(t, result.Bytes)
	require.True(t, hasMatchingPDFRect(rects, 132, 612, 228, 516))
}

func loadRawFixtureReportPrint(t *testing.T) *reportprint.ReportPrint {
	return loadFixtureReportPrint(t, "raw")
}

func loadStandaloneFixtureReportPrint(t *testing.T, relativePath string) *reportprint.ReportPrint {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok)
	fixturePath := filepath.Join(filepath.Dir(filename), relativePath)
	data, err := os.ReadFile(fixturePath)
	require.NoError(t, err)
	report, err := reportprint.DecodeJSON(data)
	require.NoError(t, err)
	return report
}

func loadStandaloneExportRequestReportPrint(t *testing.T, relativePath string) *reportprint.ReportPrint {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok)
	fixturePath := filepath.Join(filepath.Dir(filename), relativePath)
	data, err := os.ReadFile(fixturePath)
	require.NoError(t, err)
	request, err := reportexport.DecodeJSON(data)
	require.NoError(t, err)
	require.NotNil(t, request.ReportPrintModel())
	return request.ReportPrintModel()
}

func mutateFirstSVGPathIntoTranslatedGroup(t *testing.T, report *reportprint.ReportPrint, elementID string, transform string) {
	t.Helper()
	require.NotNil(t, report)
	mutated := false
	for pageIndex := range report.Pages {
		for elementIndex := range report.Pages[pageIndex].Elements {
			element := &report.Pages[pageIndex].Elements[elementIndex]
			if element.ID != elementID || element.Kind != "svg" {
				continue
			}
			pathStart := strings.Index(element.SVG, "<path ")
			require.NotEqual(t, -1, pathStart)
			pathEnd := strings.Index(element.SVG[pathStart:], "/>")
			require.NotEqual(t, -1, pathEnd)
			pathMarkup := element.SVG[pathStart : pathStart+pathEnd+2]
			replacement := `<g transform="` + transform + `">` + pathMarkup + `</g>`
			element.SVG = strings.Replace(element.SVG, pathMarkup, replacement, 1)
			mutated = true
			break
		}
		if mutated {
			break
		}
	}
	require.True(t, mutated)
}

func loadAudienceFixtureReportPrint(t *testing.T) *reportprint.ReportPrint {
	t.Helper()
	return loadStandaloneFixtureReportPrint(
		t,
		filepath.Join(
			"..", "..", "..", "..",
			"src", "reporting", "fixtures", "capacity-audience-landscape-report-print-fixture.v1.json",
		),
	)
}

func loadFixtureReportPrint(t *testing.T, variant string) *reportprint.ReportPrint {
	t.Helper()

	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok)

	fixturePath := filepath.Join(
		filepath.Dir(filename),
		"..", "..", "..", "..",
		"src", "reporting", "fixtures", "performance-report-print-fixtures.v1.json",
	)
	data, err := os.ReadFile(fixturePath)
	require.NoError(t, err)

	var fixture struct {
		Raw struct {
			ReportPrint json.RawMessage `json:"reportPrint"`
		} `json:"raw"`
		Semantic struct {
			ReportPrint json.RawMessage `json:"reportPrint"`
		} `json:"semantic"`
		Geo struct {
			ReportPrint json.RawMessage `json:"reportPrint"`
		} `json:"geo"`
		Authored struct {
			ReportPrint json.RawMessage `json:"reportPrint"`
		} `json:"authored"`
	}
	require.NoError(t, json.Unmarshal(data, &fixture))

	var payload json.RawMessage
	switch variant {
	case "raw":
		payload = fixture.Raw.ReportPrint
	case "semantic":
		payload = fixture.Semantic.ReportPrint
	case "geo":
		payload = fixture.Geo.ReportPrint
	case "authored":
		payload = fixture.Authored.ReportPrint
	default:
		t.Fatalf("unsupported fixture variant %q", variant)
	}

	report, err := reportprint.DecodeJSON(payload)
	require.NoError(t, err)
	return report
}

func findDiagnosticsByCode(diagnostics []RenderDiagnostic, code string) []RenderDiagnostic {
	result := make([]RenderDiagnostic, 0)
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			result = append(result, diagnostic)
		}
	}
	return result
}

func assertCapacityAudienceLandscapeParityAcrossPages(t *testing.T, report *reportprint.ReportPrint) {
	t.Helper()

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)
	require.Contains(t, string(result.Bytes), "/MediaBox [0 0 792.00 612.00]")

	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Equal(t, 2, inspected.pageCount)
	require.Contains(t, inspected.plainText, "Capacity Audience Segment Index Q3")
	require.Contains(t, inspected.plainText, "Audience Index")
	require.Contains(t, inspected.plainText, "Young Adults")
	require.Contains(t, inspected.plainText, "Delivery Comparison")
	require.Contains(t, inspected.plainText, "Headline KPI")
	require.NotContains(t, inspected.plainText, "Chart output is not available for this ReportPrint block.")
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[1], "Report Scope", 30))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[1], "Headline KPI", 30))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[1], "Delivery Comparison", 30))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[1], "Page 1", 700))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[2], "Page 2", 700))

	page2 := inspected.pageStream[2]
	page2Runs := inspected.pageRuns[2]
	page2Rects := inspected.pageRects[2]

	// Page 2 preserves the canonical comparison-table badges and data bars
	// from the audience export artifact.
	require.True(t, hasMatchingPDFRect(page2Rects, 402, 500, 535.77778, 484))
	require.True(t, hasMatchingPDFRect(page2Rects, 582, 500, 718, 484))
	require.True(t, hasMatchingPathBounds(page2, 222, 500, 291, 484, "B"))
	require.True(t, hasMatchingPathBounds(page2, 222, 476, 263, 460, "B"))
	require.True(t, hasPDFTextRunWithMinX(inspected.pageRuns[1], "audienceSegmentFilter: Young Adults", 36))
	require.True(t, hasPDFTextRunWithMinX(page2Runs, "Display", 230))
	require.True(t, hasPDFTextRunWithMinX(page2Runs, "CTV", 230))
	require.True(t, hasPDFTextRunWithMinX(page2Runs, "18000", 400))
	require.True(t, hasPDFTextRunWithMinX(page2Runs, "7400", 580))
}

func assertCapacityInventoryLandscapeParityAcrossPages(t *testing.T, report *reportprint.ReportPrint) {
	t.Helper()

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)
	require.Contains(t, string(result.Bytes), "/MediaBox [0 0 792.00 612.00]")

	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Equal(t, 2, inspected.pageCount)
	require.Contains(t, inspected.plainText, "Capacity Inventory Top Channels Q3")
	require.Contains(t, inspected.plainText, "Available Impressions")
	require.Contains(t, inspected.plainText, "Top Channel KPI")
	require.NotContains(t, inspected.plainText, "Chart output is not available for this ReportPrint block.")
	page1 := inspected.pageStream[1]
	require.True(t, hasMatchingPathBounds(page1, 152, 304, 736, 276, "f"))
	require.True(t, hasMatchingPathBounds(page1, 152, 266, 661.52525, 238, "f"))

	expectedRuns := collectExpectedSVGTextRuns(report)
	targets := map[string]bool{
		"158.4K":                true,
		"138.2K":                true,
		"Display":               true,
		"CTV":                   true,
		"Available Impressions": true,
	}
	matchedTargets := map[string]bool{}
	for _, expected := range expectedRuns {
		targetText := strings.TrimSpace(expected.Text)
		if !targets[targetText] || matchedTargets[targetText] {
			continue
		}
		require.Truef(
			t,
			hasMatchingPDFTextRun(inspected.pageRuns[expected.PageNumber], expected),
			"missing capacity inventory landscape text geometry for page=%d text=%q x=%.2f y=%.2f size=%.2f",
			expected.PageNumber,
			expected.Text,
			expected.X,
			expected.Y,
			expected.FontSize,
		)
		matchedTargets[targetText] = true
	}
	require.Equal(t, len(targets), len(matchedTargets))
}

func assertCapacityLocationLandscapeParityAcrossPages(t *testing.T, report *reportprint.ReportPrint) {
	t.Helper()

	result, err := Render(report, Options{})
	require.NoError(t, err)
	require.Empty(t, result.Diagnostics)
	require.Contains(t, string(result.Bytes), "/MediaBox [0 0 792.00 612.00]")

	inspected := inspectRenderedPDF(t, result.Bytes)
	require.Equal(t, 2, inspected.pageCount)
	require.Contains(t, inspected.plainText, "Capacity Locations Top Markets Q3")
	require.Contains(t, inspected.plainText, "Available Impressions")
	require.Contains(t, inspected.plainText, "Top Market KPI")
	require.NotContains(t, inspected.plainText, "Chart output is not available for this ReportPrint block.")
	page1 := inspected.pageStream[1]
	require.True(t, hasMatchingPathBounds(page1, 152, 320, 736, 292, "f"))
	require.True(t, hasMatchingPathBounds(page1, 152, 282, 699.3808, 254, "f"))

	expectedRuns := collectExpectedSVGTextRuns(report)
	targets := map[string]bool{
		"153.1K":                true,
		"143.5K":                true,
		"US":                    true,
		"CA":                    true,
		"Available Impressions": true,
	}
	matchedTargets := map[string]bool{}
	for _, expected := range expectedRuns {
		targetText := strings.TrimSpace(expected.Text)
		if !targets[targetText] || matchedTargets[targetText] {
			continue
		}
		require.Truef(
			t,
			hasMatchingPDFTextRun(inspected.pageRuns[expected.PageNumber], expected),
			"missing capacity location landscape text geometry for page=%d text=%q x=%.2f y=%.2f size=%.2f",
			expected.PageNumber,
			expected.Text,
			expected.X,
			expected.Y,
			expected.FontSize,
		)
		matchedTargets[targetText] = true
	}
	require.Equal(t, len(targets), len(matchedTargets))
}

func extractPDFPlainText(t *testing.T, data []byte) (int, string) {
	t.Helper()

	tempDir := t.TempDir()
	pdfPath := filepath.Join(tempDir, "report.pdf")
	require.NoError(t, os.WriteFile(pdfPath, data, 0o600))

	file, reader, err := pdfreader.Open(pdfPath)
	require.NoError(t, err)
	defer file.Close()

	stream, err := reader.GetPlainText()
	require.NoError(t, err)
	text, err := io.ReadAll(stream)
	require.NoError(t, err)

	return reader.NumPage(), string(text)
}

func extractPDFStyledTexts(t *testing.T, data []byte) []pdfreader.Text {
	return inspectRenderedPDF(t, data).styledText
}

func extractPDFRects(t *testing.T, data []byte) []pdfreader.Rect {
	result := make([]pdfreader.Rect, 0)
	for _, rects := range inspectRenderedPDF(t, data).pageRects {
		result = append(result, rects...)
	}
	return result
}

func extractPDFContentStreams(t *testing.T, data []byte) string {
	var chunks []string
	inspected := inspectRenderedPDF(t, data)
	for pageNumber := 1; pageNumber <= inspected.pageCount; pageNumber++ {
		chunks = append(chunks, inspected.pageStream[pageNumber])
	}
	require.NotEmpty(t, chunks)
	return strings.Join(chunks, "\n---PAGE---\n")
}

func inspectRenderedPDF(t *testing.T, data []byte) inspectedPDF {
	t.Helper()

	tempDir := t.TempDir()
	pdfPath := filepath.Join(tempDir, "report.pdf")
	require.NoError(t, os.WriteFile(pdfPath, data, 0o600))

	file, reader, err := pdfreader.Open(pdfPath)
	require.NoError(t, err)
	defer file.Close()

	plainStream, err := reader.GetPlainText()
	require.NoError(t, err)
	plainBytes, err := io.ReadAll(plainStream)
	require.NoError(t, err)

	styledText, err := reader.GetStyledTexts()
	require.NoError(t, err)

	pageRuns := map[int][]pdfTextRun{}
	pageRects := map[int][]pdfreader.Rect{}
	pageStream := map[int]string{}
	for pageNumber := 1; pageNumber <= reader.NumPage(); pageNumber++ {
		page := reader.Page(pageNumber)
		pageRuns[pageNumber] = buildPDFTextRunsForPage(pageNumber, page.Content().Text)
		pageRects[pageNumber] = append([]pdfreader.Rect(nil), page.Content().Rect...)
		pageStream[pageNumber] = extractPageContentFromReader(t, page)
	}

	return inspectedPDF{
		pageCount:  reader.NumPage(),
		plainText:  string(plainBytes),
		styledText: styledText,
		pageRuns:   pageRuns,
		pageRects:  pageRects,
		pageStream: pageStream,
	}
}

func buildPDFTextRunsForPage(pageNumber int, fragments []pdfreader.Text) []pdfTextRun {
	if len(fragments) == 0 {
		return nil
	}
	result := make([]pdfTextRun, 0)
	current := groupedTextRun{
		run: pdfTextRun{
			PageNumber: pageNumber,
			Font:       fragments[0].Font,
			FontSize:   fragments[0].FontSize,
			X:          fragments[0].X,
			Y:          fragments[0].Y,
			Text:       fragments[0].S,
		},
		endX: fragments[0].X + fragments[0].W,
	}
	for index := 1; index < len(fragments); index++ {
		next := fragments[index]
		if shouldMergePDFTextFragment(current, next) {
			current.run.Text += next.S
			nextEnd := next.X + next.W
			if nextEnd > current.endX {
				current.endX = nextEnd
			}
			continue
		}
		if strings.TrimSpace(current.run.Text) != "" {
			result = append(result, current.run)
		}
		current = groupedTextRun{
			run: pdfTextRun{
				PageNumber: pageNumber,
				Font:       next.Font,
				FontSize:   next.FontSize,
				X:          next.X,
				Y:          next.Y,
				Text:       next.S,
			},
			endX: next.X + next.W,
		}
	}
	if strings.TrimSpace(current.run.Text) != "" {
		result = append(result, current.run)
	}
	return result
}

func shouldMergePDFTextFragment(current groupedTextRun, next pdfreader.Text) bool {
	const (
		fontTolerance = 0.001
		yTolerance    = 0.001
		gapTolerance  = 2.0
	)
	if next.Font != current.run.Font {
		return false
	}
	if math.Abs(next.FontSize-current.run.FontSize) > fontTolerance {
		return false
	}
	if math.Abs(next.Y-current.run.Y) > yTolerance {
		return false
	}
	if next.X < current.run.X {
		return false
	}
	if next.X < current.endX-0.001 {
		return false
	}
	if next.X-current.endX > gapTolerance {
		return false
	}
	return true
}

func extractPageContentFromReader(t *testing.T, page pdfreader.Page) string {
	t.Helper()

	var chunks []string
	contents := page.V.Key("Contents")
	switch contents.Kind() {
	case pdfreader.Stream:
		stream := contents.Reader()
		payload, err := io.ReadAll(stream)
		require.NoError(t, err)
		require.NoError(t, stream.Close())
		chunks = append(chunks, string(payload))
	case pdfreader.Array:
		for index := 0; index < contents.Len(); index++ {
			streamValue := contents.Index(index)
			stream := streamValue.Reader()
			payload, err := io.ReadAll(stream)
			require.NoError(t, err)
			require.NoError(t, stream.Close())
			chunks = append(chunks, string(payload))
		}
	}
	return strings.Join(chunks, "\n---STREAM---\n")
}

func collectExpectedSVGTextRuns(report *reportprint.ReportPrint) []pdfTextRun {
	result := make([]pdfTextRun, 0)
	for pageIndex, page := range report.Pages {
		appendRuns := func(elements []reportprint.Element) {
			for _, element := range elements {
				if element.Kind != "svg" || strings.TrimSpace(element.SVG) == "" {
					continue
				}
				document, err := parseSVGDocument(element.SVG)
				if err != nil {
					continue
				}
				viewport, err := buildSVGViewport(document, element.Box)
				if err != nil {
					continue
				}
				for _, node := range document.nodes {
					if node.kind != "text" || node.text == nil || strings.TrimSpace(node.text.value) == "" {
						continue
					}
					expected := buildExpectedSVGTextRun(node.text, viewport, report.PageGeometry.Height)
					expected.PageNumber = pageIndex + 1
					result = append(result, expected)
				}
			}
		}
		appendRuns(page.HeaderElements)
		appendRuns(page.Elements)
		appendRuns(page.FooterElements)
	}
	return result
}

func buildExpectedSVGTextRun(node *svgText, viewport svgViewport, pageHeight float64) pdfTextRun {
	fontSize := node.fontSize * minFloat(viewport.scaleX, viewport.scaleY)
	x := svgX(viewport, node.x)
	y := pageHeight - svgY(viewport, node.y)
	width := measureExpectedTextWidth(node.value, fontSize, node.fontWeight)
	switch strings.ToLower(strings.TrimSpace(node.anchor)) {
	case "middle":
		x -= width / 2
	case "end":
		x -= width
	}
	return pdfTextRun{
		Font:     expectedFontName(node.fontWeight),
		FontSize: fontSize,
		X:        x,
		Y:        y,
		Text:     node.value,
	}
}

func measureExpectedTextWidth(text string, fontSize float64, fontWeight string) float64 {
	pdf := fpdf.New(fpdf.OrientationPortrait, fpdf.UnitPoint, fpdf.PageSizeLetter, "")
	pdf.AddPage()
	pdf.SetFont("Helvetica", fontStyle(fontWeight), fontSize)
	return pdf.GetStringWidth(text)
}

func expectedFontName(fontWeight string) string {
	style := strings.ToUpper(fontStyle(fontWeight))
	switch style {
	case "BI", "IB":
		return "Helvetica-BoldOblique"
	case "B":
		return "Helvetica-Bold"
	case "I":
		return "Helvetica-Oblique"
	default:
		return "Helvetica"
	}
}

func hasMatchingPDFTextRun(actual []pdfTextRun, expected pdfTextRun) bool {
	const (
		positionTolerance = 1.25
		fontTolerance     = 0.25
	)
	for _, candidate := range actual {
		if candidate.PageNumber != expected.PageNumber {
			continue
		}
		if strings.TrimSpace(candidate.Text) != strings.TrimSpace(expected.Text) {
			continue
		}
		if expected.Font != "" && candidate.Font != expected.Font {
			continue
		}
		if math.Abs(candidate.FontSize-expected.FontSize) > fontTolerance {
			continue
		}
		if math.Abs(candidate.X-expected.X) > positionTolerance {
			continue
		}
		if math.Abs(candidate.Y-expected.Y) > positionTolerance {
			continue
		}
		return true
	}
	return false
}

func hasPDFTextRunWithMinX(actual []pdfTextRun, text string, minX float64) bool {
	for _, candidate := range actual {
		if strings.TrimSpace(candidate.Text) != strings.TrimSpace(text) {
			continue
		}
		if candidate.X < minX {
			continue
		}
		return true
	}
	return false
}

func hasMatchingPDFRect(actual []pdfreader.Rect, minX float64, minY float64, maxX float64, maxY float64) bool {
	const tolerance = 0.25
	for _, candidate := range actual {
		if math.Abs(candidate.Min.X-minX) > tolerance {
			continue
		}
		if math.Abs(candidate.Min.Y-minY) > tolerance {
			continue
		}
		if math.Abs(candidate.Max.X-maxX) > tolerance {
			continue
		}
		if math.Abs(candidate.Max.Y-maxY) > tolerance {
			continue
		}
		return true
	}
	return false
}

var moveLinePattern = regexp.MustCompile(`(?s)([-0-9.]+)\s+([-0-9.]+)\s+m\s+([-0-9.]+)\s+([-0-9.]+)\s+l`)
var alphaPattern = regexp.MustCompile(`/ca\s+([0-9.]+)\s+/CA\s+([0-9.]+)`)
var graphicsStateUsePattern = regexp.MustCompile(`/GS[0-9]+\s+gs`)
var curvedPathPattern = regexp.MustCompile(`(?s)([-0-9.]+\s+[-0-9.]+\s+m\s+.*?\s+([fSB]))`)
var pathNumberPattern = regexp.MustCompile(`[-]?[0-9]+(?:\.[0-9]+)?`)

func hasMatchingMoveLine(content string, moveX float64, moveY float64, lineX float64, lineY float64) bool {
	const tolerance = 0.25
	matches := moveLinePattern.FindAllStringSubmatch(content, -1)
	for _, match := range matches {
		if len(match) != 5 {
			continue
		}
		actualMoveX, err := strconv.ParseFloat(match[1], 64)
		if err != nil {
			continue
		}
		actualMoveY, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			continue
		}
		actualLineX, err := strconv.ParseFloat(match[3], 64)
		if err != nil {
			continue
		}
		actualLineY, err := strconv.ParseFloat(match[4], 64)
		if err != nil {
			continue
		}
		if math.Abs(actualMoveX-moveX) > tolerance {
			continue
		}
		if math.Abs(actualMoveY-moveY) > tolerance {
			continue
		}
		if math.Abs(actualLineX-lineX) > tolerance {
			continue
		}
		if math.Abs(actualLineY-lineY) > tolerance {
			continue
		}
		return true
	}
	return false
}

func hasMatchingPathBounds(content string, minX float64, maxY float64, maxX float64, minY float64, command string) bool {
	const tolerance = 0.5
	for _, candidate := range extractPathBlocks(content) {
		if command != "" && candidate.command != command {
			continue
		}
		if math.Abs(candidate.minX-minX) > tolerance {
			continue
		}
		if math.Abs(candidate.maxY-maxY) > tolerance {
			continue
		}
		if math.Abs(candidate.maxX-maxX) > tolerance {
			continue
		}
		if math.Abs(candidate.minY-minY) > tolerance {
			continue
		}
		return true
	}
	return false
}

func extractPathBlocks(content string) []pdfPathBlock {
	result := make([]pdfPathBlock, 0)
	matches := curvedPathPattern.FindAllStringSubmatch(content, -1)
	for _, match := range matches {
		if len(match) != 3 {
			continue
		}
		body := strings.TrimSpace(match[1])
		if strings.Count(body, " c") < 2 {
			continue
		}
		command := strings.TrimSpace(match[2])
		numeric := pathNumberPattern.FindAllString(body, -1)
		if len(numeric) < 4 {
			continue
		}
		values := make([]float64, 0, len(numeric))
		for _, entry := range numeric {
			parsed, err := strconv.ParseFloat(entry, 64)
			if err != nil {
				values = nil
				break
			}
			values = append(values, parsed)
		}
		if len(values) < 4 {
			continue
		}
		minXValue := values[0]
		maxXValue := values[0]
		minYValue := values[1]
		maxYValue := values[1]
		for index, value := range values {
			if index%2 == 0 {
				if value < minXValue {
					minXValue = value
				}
				if value > maxXValue {
					maxXValue = value
				}
				continue
			}
			if value < minYValue {
				minYValue = value
			}
			if value > maxYValue {
				maxYValue = value
			}
		}
		result = append(result, pdfPathBlock{
			minX:    minXValue,
			minY:    minYValue,
			maxX:    maxXValue,
			maxY:    maxYValue,
			command: command,
		})
	}
	return result
}

func hasMatchingAlphaDefinition(content string, alpha float64) bool {
	return hasMatchingAlphaChannels(content, alpha, alpha)
}

func hasMatchingAlphaChannels(content string, fillAlpha float64, strokeAlpha float64) bool {
	const tolerance = 0.001
	matches := alphaPattern.FindAllStringSubmatch(content, -1)
	for _, match := range matches {
		if len(match) != 3 {
			continue
		}
		fillAlphaParsed, err := strconv.ParseFloat(match[1], 64)
		if err != nil {
			continue
		}
		strokeAlphaParsed, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			continue
		}
		if math.Abs(fillAlphaParsed-fillAlpha) > tolerance {
			continue
		}
		if math.Abs(strokeAlphaParsed-strokeAlpha) > tolerance {
			continue
		}
		return true
	}
	return false
}

func hasGraphicsStateUsage(content string) bool {
	return graphicsStateUsePattern.MatchString(content)
}

func collectPreviewVisibleSVGLabels(report *reportprint.ReportPrint) []string {
	seen := map[string]bool{}
	result := make([]string, 0)
	appendLabels := func(elements []reportprint.Element) {
		for _, element := range elements {
			if element.Kind != "svg" || strings.TrimSpace(element.SVG) == "" {
				continue
			}
			document, err := parseSVGDocument(element.SVG)
			if err != nil {
				continue
			}
			for _, node := range document.nodes {
				if node.kind != "text" || node.text == nil {
					continue
				}
				label := strings.TrimSpace(node.text.value)
				if label == "" || seen[label] {
					continue
				}
				// Short two-letter geo labels are covered by the dedicated geo test;
				// this harness focuses on the richer preview-visible labels.
				if len([]rune(label)) < 3 {
					continue
				}
				seen[label] = true
				result = append(result, label)
			}
		}
	}
	for _, page := range report.Pages {
		appendLabels(page.HeaderElements)
		appendLabels(page.Elements)
		appendLabels(page.FooterElements)
	}
	return result
}
