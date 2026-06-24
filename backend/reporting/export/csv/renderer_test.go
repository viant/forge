package csv

import (
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
)

func TestRender_TableBlockToCSV(t *testing.T) {
	report, err := reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)

	data, err := Render(report)
	require.NoError(t, err)
	require.Equal(t, "Channel,Spend\nDisplay,$42.50\nCTV,$30.00\n", string(data))
}

func TestRender_RejectsMissingOrMultipleTableBlocks(t *testing.T) {
	report, err := reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)

	report.Blocks[0].Kind = "filterBarBlock"
	report.Blocks[0].Title = "Filters"
	report.Blocks[0].Content = nil
	report.Blocks[0].Columns = nil
	report.Blocks[0].FilterBarContent = &reportfill.FilterBarContent{
		Title: "Filters",
		Params: []reportfill.FilterBarContentParams{
			{ID: "dateRange", Value: "2026-05-01"},
		},
	}
	_, err = Render(report)
	require.EqualError(t, err, "csv export requires exactly one tableBlock, got 0")

	report, err = reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)
	report.Blocks = append(report.Blocks, report.Blocks[0])
	_, err = Render(report)
	require.EqualError(t, err, "csv export requires exactly one tableBlock, got 2")
}

func TestRender_RejectsMissingCells(t *testing.T) {
	report, err := reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)
	report.Blocks[0].Content.ResolvedRows[0].Cells = report.Blocks[0].Content.ResolvedRows[0].Cells[:1]
	_, err = Render(report)
	require.EqualError(t, err, `csv export missing cell for column "spend" at row 0`)
}

func validTestReportFillJSON() string {
	return `{
		"version": 1,
		"kind": "reportFill",
		"specVersion": 1,
		"specHash": "spec-1",
		"source": {"kind":"dashboard.reportBuilder","containerId":"demo","stateKey":"demo","dataSourceRef":"demo"},
		"parameters": {"viewMode":"table","groupBy":"","pageSize":25,"orderField":"","orderDir":"asc"},
		"refinements": [],
		"calculatedFields": [],
		"datasets": [{
			"id": "primary",
			"dataSourceRef": "demo",
			"request": {"limit": 25, "offset": 0},
			"provenance": {"requestHash":"fnv1a:9702fdec","rowCount":2,"truncated":false,"hasMore":false,"diagnostics":[]},
			"rows": [{"channel":"Display","spend":42.5},{"channel":"CTV","spend":30}]
		}],
		"blocks": [{
			"id":"primaryTable",
			"kind":"tableBlock",
			"datasetRef":"primary",
			"columns":[
				{"key":"channel","label":"Channel"},
				{"key":"spend","label":"Spend","format":"currency"}
			],
			"content":{
				"columns":[
					{"key":"channel","label":"Channel"},
					{"key":"spend","label":"Spend","format":"currency"}
				],
				"rowCount":2,
				"resolvedRows":[
					{"rowIndex":0,"cells":[
						{"key":"channel","sourceKey":"channel","displayKey":"channel","value":"Display","displayValue":"Display","visualState":null},
						{"key":"spend","sourceKey":"spend","displayKey":"spend","value":42.5,"displayValue":"$42.50","visualState":null}
					]},
					{"rowIndex":1,"cells":[
						{"key":"channel","sourceKey":"channel","displayKey":"channel","value":"CTV","displayValue":"CTV","visualState":null},
						{"key":"spend","sourceKey":"spend","displayKey":"spend","value":30,"displayValue":"$30.00","visualState":null}
					]}
				]
			}
		}],
		"diagnostics": []
	}`
}
