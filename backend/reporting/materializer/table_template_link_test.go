package materializer

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	reportcsv "github.com/viant/forge/backend/reporting/export/csv"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	identity "github.com/viant/forge/backend/resource"
	"github.com/xuri/excelize/v2"
)

// Independent synthetic authoring exercises trusted lowering, hidden row-key
// dependencies, typed round trips and complete exports through the native bundle.
func TestTableTemplateLinksPreserveNativeDataAndExports(t *testing.T) {
	envelope := fingerprintEnvelope()
	envelope.BuilderDefinition = json.RawMessage(`{"id":"builder","reportBuilder":{"dataSourceRef":"rows","dimensions":[{"id":"name","key":"name","label":"Record","paramPath":"dimensions.name"},{"id":"recordId","key":"recordId","paramPath":"dimensions.recordId"}],"measures":[{"id":"count","key":"count","label":"Count","paramPath":"measures.count"}]}}`)
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","id":"records","title":"Record counts","blocks":[{"id":"details","kind":"tableBlock","title":"Records","datasetRef":"primary","columns":[{"key":"name","label":"Record","link":{"kind":"external","hrefTemplate":"https://example.invalid/records/{{recordId}}"}},{"key":"count","label":"Count"}]}]}`)
	envelope.State = json.RawMessage(`{"selectedDimensions":["name"],"selectedMeasures":["count"],"viewMode":"table","pageSize":1}`)
	for i := range envelope.Dependencies {
		switch envelope.Dependencies[i].Kind {
		case "builder":
			envelope.Dependencies[i].ContentFingerprint = identity.ContentFingerprint(envelope.BuilderDefinition)
		case "report":
			envelope.Dependencies[i].ContentFingerprint = identity.ContentFingerprint(envelope.ReportDocument)
		}
	}
	authored, err := json.Marshal(envelope)
	require.NoError(t, err)
	raw, err := Lower(t.Context(), authored)
	require.NoError(t, err)
	spec, err := reportspec.DecodeJSON(raw)
	require.NoError(t, err)
	require.True(t, spec.Datasets[0].Request.Dimensions["recordId"], "template key must survive native request planning")
	require.Empty(t, spec.CalculatedFields)
	var details *reportspec.Block
	for i := range spec.Blocks {
		if spec.Blocks[i].ID == "details" {
			details = &spec.Blocks[i]
		}
	}
	require.NotNil(t, details)
	require.Equal(t, "https://example.invalid/records/{{recordId}}", details.Columns[0].Link["hrefTemplate"])
	raw, err = json.Marshal(spec)
	require.NoError(t, err)
	data := map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"recordId":"9007199254740993","name":"North record","count":3},{"recordId":"000017","name":"South record","count":4}],"hasMore":false}`)}
	output, err := Materialize(t.Context(), raw, data)
	require.NoError(t, err)
	fill, err := reportfill.DecodeJSON(output.ReportFill)
	require.NoError(t, err)
	var table *reportfill.Block
	for i := range fill.Blocks {
		if fill.Blocks[i].ID == "details" {
			table = &fill.Blocks[i]
		}
	}
	require.NotNil(t, table)
	require.Equal(t, "https://example.invalid/records/{{recordId}}", table.Content.Columns[0].Link["hrefTemplate"])
	require.Len(t, fill.Datasets[0].Rows, 2)
	for _, row := range fill.Datasets[0].Rows {
		require.Len(t, row, 3, "presentation links must not add raw data columns")
	}
	selected := *fill
	selected.Blocks = []reportfill.Block{*table}
	csv, err := reportcsv.Render(&selected)
	require.NoError(t, err)
	require.Equal(t, "Record,Count\nNorth record,3\nSouth record,4\n", string(csv))
	xlsx, err := reportxlsx.Render(&selected)
	require.NoError(t, err)
	book, err := excelize.OpenReader(bytes.NewReader(xlsx))
	require.NoError(t, err)
	defer book.Close()
	grid, err := book.GetRows("Report")
	require.NoError(t, err)
	require.Equal(t, [][]string{{"Record", "Count"}, {"North record", "3"}, {"South record", "4"}}, grid)
	dashboard, err := reportxlsx.RenderDashboardWithPrint(output.ReportFill, output.ReportPrint)
	require.NoError(t, err)
	workbook, err := excelize.OpenReader(bytes.NewReader(dashboard))
	require.NoError(t, err)
	defer workbook.Close()
	rawGrid, err := workbook.GetRows("Data primary")
	require.NoError(t, err)
	require.Equal(t, []string{"count", "name", "recordId"}, rawGrid[3])
	require.Equal(t, []string{"3", "North record", "9007199254740993"}, rawGrid[4])
	require.Equal(t, []string{"4", "South record", "000017"}, rawGrid[5])
}
