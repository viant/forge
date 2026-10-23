package pdf

import (
	"encoding/json"
	"fmt"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReportOptionsWebAndMobileUseSameBackendRendering(t *testing.T) {
	report := loadFixtureReportPrint(t, "raw")
	before, err := json.Marshal(report)
	require.NoError(t, err)
	definitions := `"reportOptions":[{"name":"exposurePerspective","label":"First vs. Last Exposure","default":"Last","values":["First","Last"]},{"name":"organic","label":"Include organic"},{"name":"lookback","label":"Lookback"}]`
	values := `{"exposurePerspective":"First","organic":false,"lookback":0}`
	web := Options{ReportSpec: json.RawMessage(`{"datasets":[{"request":{"options":` + values + `}}]}`), Metadata: json.RawMessage(`{` + definitions + `}`)}
	mobile := Options{Metadata: json.RawMessage(`{` + definitions + `,"options":` + values + `}`)}
	require.Equal(t, reportOptionLines(web), reportOptionLines(mobile))
	for _, options := range []Options{web, mobile} {
		prepared, err := withReportOptionContext(report, options)
		require.NoError(t, err)
		for _, page := range prepared.Pages {
			for _, element := range page.Elements {
				if strings.HasPrefix(element.ID, "option_context_") {
					require.LessOrEqual(t, element.Box.Y+element.Box.Height, report.PageGeometry.Height-report.PageGeometry.MarginBottom)
				}
			}
		}
		rendered, err := Render(report, options)
		require.NoError(t, err)
		_, text := extractPDFPlainText(t, rendered.Bytes)
		require.Contains(t, text, "First vs. Last Exposure: First")
		require.Contains(t, text, "Include organic: false")
		require.Contains(t, text, "Lookback: 0")
		require.NotContains(t, text, "First vs. Last Exposure: Last")
	}
	after, err := json.Marshal(report)
	require.NoError(t, err)
	require.Equal(t, string(before), string(after), "rendering does not mutate the input artifact")
}

func TestReportOptionsPaginateAndDoNotInventDefaults(t *testing.T) {
	report := loadFixtureReportPrint(t, "raw")
	untouched, err := withReportOptionContext(report, Options{Metadata: json.RawMessage(`{"reportOptions":[{"name":"model","default":"Last"}]}`)})
	require.NoError(t, err)
	require.Same(t, report, untouched)
	metadata, err := json.Marshal(map[string]any{"options": map[string]any{"exposurePerspective": strings.Repeat("Long report option value ", 1000)}})
	require.NoError(t, err)
	prepared, err := withReportOptionContext(report, Options{Metadata: metadata})
	require.NoError(t, err)
	require.Greater(t, len(prepared.Pages), len(report.Pages))
	require.NoError(t, prepared.Validate())
}

func TestReportOptionsExcludeCompatibilityAndHiddenControls(t *testing.T) {
	options := Options{
		Metadata: json.RawMessage(`{"reportOptions":[{"name":"metric","label":"Ranking Metric"},{"name":"hidden","hidden":true},{"name":"invisible","visible":false},{"name":"legacy","presentation":{"placement":"hidden"}}],"options":{"metric":"ROAS","compatibility":"Device","hidden":true,"invisible":1,"legacy":"Channel"}}`),
	}
	require.Equal(t, []string{"Ranking Metric: ROAS"}, reportOptionLines(options))
	options.ReportSpec = json.RawMessage(`{"datasets":[{"request":{"options":{"metric":"ROAS","compatibility":"Device","hidden":true,"invisible":1,"legacy":"Channel"}}}]}`)
	require.Equal(t, []string{"Ranking Metric: ROAS"}, reportOptionLines(options))
}

func TestReportOptionsKeepShortContextTogetherAndRepeatLongHeading(t *testing.T) {
	report := loadFixtureReportPrint(t, "raw")
	report.Pages = report.Pages[:1]
	g := report.PageGeometry
	report.Pages[0].FooterElements = nil
	report.Pages[0].Elements = []reportprint.Element{{ID: "occupied", Kind: "text", Text: "Existing evidence", FontSize: 10, Box: reportprint.Box{X: g.MarginLeft, Y: g.Height - g.MarginBottom - g.FooterHeight - 80, Width: 100, Height: 14}}}
	selected := map[string]any{}
	for i := 0; i < 10; i++ {
		selected[fmt.Sprintf("option%02d", i)] = fmt.Sprintf("Selected %d", i)
	}
	metadata, err := json.Marshal(map[string]any{"options": selected})
	require.NoError(t, err)
	prepared, err := withReportOptionContext(report, Options{Metadata: metadata})
	require.NoError(t, err)
	require.Len(t, prepared.Pages, 2)
	for _, element := range prepared.Pages[0].Elements {
		require.False(t, strings.HasPrefix(element.ID, "option_context_"), "short context must move intact")
	}
	require.Equal(t, "Report options", prepared.Pages[1].Elements[0].Text)
	require.Len(t, prepared.Pages[1].Elements, 11)
	longMetadata, err := json.Marshal(map[string]any{"options": map[string]any{"selection": strings.Repeat("Long option value ", 1000)}})
	require.NoError(t, err)
	long, err := withReportOptionContext(report, Options{Metadata: longMetadata})
	require.NoError(t, err)
	require.Greater(t, len(long.Pages), 2)
	for _, page := range long.Pages {
		hasContext, hasHeading := false, false
		for _, element := range page.Elements {
			if strings.HasPrefix(element.ID, "option_context_") {
				hasContext = true
				if strings.HasPrefix(element.Text, "Report options") {
					hasHeading = true
				}
			}
		}
		if hasContext {
			require.True(t, hasHeading, "every context page retains its heading")
		}
	}
}
