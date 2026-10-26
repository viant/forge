package pdf

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// These boxes and labels reproduce clipped headings from complete report
// exports. Inspect the rendered PDF itself: a correct print model alone cannot
// establish that the final words survived rendering.
func TestRender_LongMeasuredTableHeadersPreserveEveryWord(t *testing.T) {
	cases := []struct {
		name, text    string
		width, height float64
	}{
		{"seven_lines", "Conversion Date Extrapolated Prior Period Control Conversion Sales Amount", 63.52179775280898, 84},
		{"narrow_seven_lines", "Conversion Date Prior Period Control Conversion Sales Amount", 53.44179775280898, 84},
		{"two_lines", "Conversion Date Prior Period Conversion Sales Amount", 141.85756097560977, 24},
		{"five_lines", "Post Click Control Conversion Sales Amount", 51.57333333333333, 60},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			report := &reportprint.ReportPrint{
				Version: 1, Kind: "reportPrint", SpecVersion: 1, SpecHash: "fnv1a:header-spec", FillVersion: 1, FillHash: "fnv1a:header-fill",
				Source: reportprint.Source{Kind: "dashboard.reportBuilder", ContainerID: "headers", StateKey: "headers", DataSourceRef: "source"}, Title: "Headers",
				PageGeometry: reportprint.PageGeometry{Width: 612, Height: 792, MarginTop: 36, MarginRight: 36, MarginBottom: 36, MarginLeft: 36, HeaderHeight: 36, FooterHeight: 24},
				Pages: []reportprint.Page{{Number: 1, Elements: []reportprint.Element{{
					ID: "header", Kind: "text", Box: reportprint.Box{X: 42, Y: 112, Width: tc.width, Height: tc.height},
					Text: tc.text, FontSize: 9, FontWeight: "600", Wrap: true,
				}}}},
			}
			result, err := Render(report, Options{})
			require.NoError(t, err)
			inspected := inspectRenderedPDF(t, result.Bytes)
			var text strings.Builder
			for _, run := range inspected.pageRuns[1] {
				text.WriteString(run.Text)
			}
			// Wrapping may split a long word. Ignore only whitespace, not missing
			// words, punctuation, duplicated text or changes to their order.
			require.Equal(t, strings.Join(strings.Fields(tc.text), ""), strings.Join(strings.Fields(text.String()), ""))
		})
	}
}
