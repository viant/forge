package materializer

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	reportcsv "github.com/viant/forge/backend/reporting/export/csv"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

// Independently invented records exercise semantic relation labels while the
// dataset and numeric measurements retain their original values.
func TestRelationLabelsReachSelectedAndDashboardExports(t *testing.T) {
	spec := json.RawMessage(`{"version":1,"kind":"reportSpec","title":"Directory","source":{"kind":"report","containerId":"directory","stateKey":"directory","dataSourceRef":"source"},"parameters":{"viewMode":"table","pageSize":25},"layoutIntent":{"kind":"stack","blockOrder":["details"]},"datasets":[{"id":"primary","dataSourceRef":"source","request":{}}],"blocks":[{"id":"details","kind":"tableBlock","title":"Details","datasetRef":"primary","columns":[{"key":"ownerId","sourceKey":"ownerId","displayKey":"owner.name","label":"Owner"},{"key":"amount","label":"Amount","format":"number2"}]}]}`)
	datasets := map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"ownerId":17,"owner":{"name":"Cedar Workshop"},"amount":0.11459765000000001}],"hasMore":false}`)}
	for _, fillOnly := range []bool{true, false} {
		output, err := MaterializePresented(context.Background(), spec, datasets, nil, fillOnly)
		require.NoError(t, err)
		fill, err := reportfill.DecodeDatasourceJSON(output.ReportFill)
		require.NoError(t, err)
		cell := fill.Blocks[0].Content.ResolvedRows[0].Cells[0]
		require.EqualValues(t, 17, cell.Value)
		require.Equal(t, "Cedar Workshop", cell.DisplayValue)
		require.EqualValues(t, 17, fill.Datasets[0].Rows[0]["ownerId"])
		data, err := reportcsv.Render(fill)
		require.NoError(t, err)
		records, err := csv.NewReader(bytes.NewReader(data)).ReadAll()
		require.NoError(t, err)
		require.Equal(t, "Cedar Workshop", records[1][0])
		data, err = reportxlsx.Render(fill)
		require.NoError(t, err)
		book, err := excelize.OpenReader(bytes.NewReader(data))
		require.NoError(t, err)
		value, err := book.GetCellValue("Report", "A2")
		require.NoError(t, err)
		require.Equal(t, "Cedar Workshop", value)
		require.NoError(t, book.Close())
		data, err = reportxlsx.RenderDashboard(fill)
		require.NoError(t, err)
		book, err = excelize.OpenReader(bytes.NewReader(data))
		require.NoError(t, err)
		value, err = book.GetCellValue("Report", "A5")
		require.NoError(t, err)
		require.Equal(t, "Cedar Workshop", value)
		require.NoError(t, book.Close())
		if !fillOnly {
			data, err = reportxlsx.RenderDatasourceDashboardWithPrint(output.ReportFill, output.ReportPrint)
			require.NoError(t, err)
			book, err = excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			value, err = book.GetCellValue("Table Details", "A5")
			require.NoError(t, err)
			require.Equal(t, "Cedar Workshop", value)
			raw, err := book.GetCellValue("Table Details", "B5", excelize.Options{RawCellValue: true})
			require.NoError(t, err)
			require.Equal(t, "0.11459765000000001", raw)
			// Raw dataset worksheets retain numeric identity and relation data.
			rows, err := book.GetRows("Data primary")
			require.NoError(t, err)
			require.Contains(t, rows[4], "17")
			require.Contains(t, rows[4], `{"name":"Cedar Workshop"}`)
			require.NoError(t, book.Close())
		}
	}
}
