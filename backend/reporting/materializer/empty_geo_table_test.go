package materializer

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

// Independently invented polygons and readings; the same fixture exercises the
// native JavaScript producer/schema and the embedded Goja materializer.
func TestEmptyGeoDoesNotBlockTableXLSX(t *testing.T) {
	raw, err := os.ReadFile("testdata/empty-geo-table-report.json")
	require.NoError(t, err)
	var fixture struct {
		ReportSpec json.RawMessage            `json:"reportSpec"`
		Datasets   map[string]json.RawMessage `json:"datasets"`
	}
	require.NoError(t, json.Unmarshal(raw, &fixture))
	artifacts, err := Materialize(t.Context(), fixture.ReportSpec, fixture.Datasets)
	require.NoError(t, err)
	fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	geo := fill.Blocks[1].GeoContent.ResolvedGeo
	require.Len(t, geo.Geometry.Features, 2)
	require.Len(t, geo.Regions, 2)
	require.Empty(t, fill.Datasets[1].Rows)
	require.Empty(t, geo.Ranking)
	require.Empty(t, geo.Summary.TopKey)
	for _, region := range geo.Regions {
		require.Nil(t, region.RawValue)
		require.Equal(t, "No row", region.DisplayValue)
		require.Equal(t, 0, *region.RowCount)
	}
	// Keep the unrelated empty map in the fill: the selected-table renderer
	// validates the entire report before choosing its single table block.
	selected, err := reportxlsx.Render(fill)
	require.NoError(t, err)
	book, err := excelize.OpenReader(bytes.NewReader(selected))
	require.NoError(t, err)
	defer book.Close()
	require.Equal(t, []string{"Report"}, book.GetSheetList())
	rows, err := book.GetRows("Report")
	require.NoError(t, err)
	require.Equal(t, [][]string{{"Label", "Value"}, {"Alpha", "7.25"}, {"Beta"}}, rows)
	numeric, err := book.GetCellValue("Report", "B2", excelize.Options{RawCellValue: true})
	require.NoError(t, err)
	require.Equal(t, "7.25", numeric)
	full, err := reportxlsx.RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	workbook, err := excelize.OpenReader(bytes.NewReader(full))
	require.NoError(t, err)
	defer workbook.Close()
	var allRows [][]string
	for _, sheet := range workbook.GetSheetList() {
		rows, err := workbook.GetRows(sheet)
		require.NoError(t, err)
		allRows = append(allRows, rows...)
	}
	require.Contains(t, allRows, []string{"Alpha", "7.25"})
	require.Contains(t, allRows, []string{"Beta"})
	// An observed region still requires a real top key. The empty exemption
	// must not weaken validation for populated maps or bypass it on table export.
	fixture.Datasets["empty"] = json.RawMessage(`{"rows":[{"region":"A","value":1}],"hasMore":false}`)
	populated, err := Materialize(t.Context(), fixture.ReportSpec, fixture.Datasets)
	require.NoError(t, err)
	candidate, err := reportfill.DecodeJSON(populated.ReportFill)
	require.NoError(t, err)
	require.Equal(t, "A", candidate.Blocks[1].GeoContent.ResolvedGeo.Summary.TopKey)
	candidate.Blocks[1].GeoContent.ResolvedGeo.Summary.TopKey = ""
	require.ErrorContains(t, candidate.Validate(), "summary.topKey")
	_, err = reportxlsx.Render(candidate)
	require.ErrorContains(t, err, "summary.topKey")
	var wire map[string]any
	require.NoError(t, json.Unmarshal(populated.ReportFill, &wire))
	content := wire["blocks"].([]any)[1].(map[string]any)["content"].(map[string]any)
	content["resolvedGeo"].(map[string]any)["summary"].(map[string]any)["topKey"] = ""
	invalid, err := json.Marshal(wire)
	require.NoError(t, err)
	_, err = reportxlsx.RenderDashboardWithPrint(invalid, populated.ReportPrint)
	require.ErrorContains(t, err, "summary.topKey")
}
