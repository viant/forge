package xlsx

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// Independently invented region labels exercise the canonical native lowerer
// and workbook embedding boundary, including complete long-label rankings.
func TestDashboardCanonicalGeoRankingSVG(t *testing.T) {
	artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
		spec["blocks"] = []any{map[string]any{"id": "regions", "kind": "geoMapBlock", "title": "Facility regions", "datasetRef": "primary", "geo": map[string]any{"shape": "us-states", "key": "code", "labelKey": "label", "metric": map[string]any{"key": "value", "label": "Measurement", "format": "number"}}}}
		spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"regions"}}
		inputs["primary"] = json.RawMessage(`{"rows":[{"code":"CA","label":"North annex","value":9876543210123},{"code":"REGION_WITH_A_COMPLETE_UNBROKEN_IDENTIFIER","label":"","value":7654321098765},{"code":"EA","label":"Eastern collection and distribution facility","value":6543210987654},{"code":"WA","label":"Western facility","value":5432109876543},{"code":"SW","label":"Riverbend","value":4321098765432}]}`)
	})
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	canonicalSVG := ""
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			if strings.Contains(element.SVG, "Top Regions") {
				canonicalSVG = element.SVG
			}
		}
	}
	require.NotEmpty(t, canonicalSVG)
	require.Equal(t, 5, strings.Count(canonicalSVG, `class="forge-geo-ranking-track"`))
	require.Contains(t, canonicalSVG, ">Riverbend</text>")
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	book, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer book.Close()
	require.Contains(t, book.GetSheetList(), "Dashboard")
	found := false
	for name, content := range workbookZIP(t, data) {
		if strings.HasSuffix(name, ".svg") && content == canonicalSVG {
			found = true
		}
	}
	require.True(t, found, "Workbook retains the exact canonical ranking SVG")
	// The renderer must produce admitted attributes; arbitrary data attributes
	// remain rejected rather than widening the shared SVG validation boundary.
	for i := range printed.Pages {
		for j := range printed.Pages[i].Elements {
			element := &printed.Pages[i].Elements[j]
			element.SVG = strings.ReplaceAll(element.SVG, `class="forge-geo-ranking-track"`, `data-ranking-row="0"`)
		}
	}
	invalid, err := json.Marshal(printed)
	require.NoError(t, err)
	data, err = RenderDashboardWithPrint(artifacts.ReportFill, invalid)
	require.ErrorContains(t, err, `unsupported embedded SVG attribute "data-ranking-row"`)
	require.Empty(t, data)
}
