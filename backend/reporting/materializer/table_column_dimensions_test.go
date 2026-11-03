package materializer

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
)

func TestMaterializedTableColumnDimensionsRoundTrip(t *testing.T) {
	raw, err := os.ReadFile("testdata/empty-geo-table-report.json")
	require.NoError(t, err)
	var fixture struct {
		ReportSpec map[string]any             `json:"reportSpec"`
		Datasets   map[string]json.RawMessage `json:"datasets"`
	}
	require.NoError(t, json.Unmarshal(raw, &fixture))
	columns := fixture.ReportSpec["blocks"].([]any)[0].(map[string]any)["columns"].([]any)
	column := columns[0].(map[string]any)
	column["width"], column["minWidth"], column["flex"] = 96.5, 48.5, true
	spec, err := json.Marshal(fixture.ReportSpec)
	require.NoError(t, err)
	artifacts, err := Materialize(t.Context(), spec, fixture.Datasets)
	require.NoError(t, err)
	fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
	require.NoError(t, err)
	for _, columns := range [][]reportfill.TableColumn{fill.Blocks[0].Columns, fill.Blocks[0].Content.Columns} {
		encoded, err := json.Marshal(columns[0])
		require.NoError(t, err)
		var actual map[string]any
		require.NoError(t, json.Unmarshal(encoded, &actual))
		require.Equal(t, 96.5, actual["width"])
		require.Equal(t, 48.5, actual["minWidth"])
		require.Equal(t, true, actual["flex"])
	}
	_, err = reportxlsx.Render(fill)
	require.NoError(t, err)
	_, err = reportxlsx.RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	for _, content := range []bool{false, true} {
		for _, field := range []string{"width", "minWidth"} {
			var wire map[string]any
			require.NoError(t, json.Unmarshal(artifacts.ReportFill, &wire))
			block := wire["blocks"].([]any)[0].(map[string]any)
			if content {
				block = block["content"].(map[string]any)
			}
			block["columns"].([]any)[0].(map[string]any)[field] = 47
			invalid, err := json.Marshal(wire)
			require.NoError(t, err)
			_, err = reportfill.DecodeJSON(invalid)
			require.ErrorContains(t, err, "width/minWidth must be >= 48")
		}
	}
}
