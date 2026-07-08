package xlsx

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

func TestRender_TableBlockToWorkbook(t *testing.T) {
	report, err := reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)

	data, err := Render(report)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	workbook, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	require.Equal(t, "Channel", mustCellValue(t, workbook, "Report", "A1"))
	require.Equal(t, "Spend", mustCellValue(t, workbook, "Report", "B1"))
	require.Equal(t, "Display", mustCellValue(t, workbook, "Report", "A2"))
	require.Equal(t, "$42.50", mustCellValue(t, workbook, "Report", "B2"))
	require.Equal(t, "CTV", mustCellValue(t, workbook, "Report", "A3"))
	require.Equal(t, "$30.00", mustCellValue(t, workbook, "Report", "B3"))
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
	require.EqualError(t, err, "xlsx export requires exactly one tableBlock, got 0")

	report, err = reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)
	report.Blocks = append(report.Blocks, report.Blocks[0])
	_, err = Render(report)
	require.EqualError(t, err, "xlsx export requires exactly one tableBlock, got 2")
}

func TestRender_RejectsMissingCells(t *testing.T) {
	report, err := reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)
	report.Blocks[0].Content.ResolvedRows[0].Cells = report.Blocks[0].Content.ResolvedRows[0].Cells[:1]
	_, err = Render(report)
	require.EqualError(t, err, `xlsx export missing cell for column "spend" at row 0`)
}

func TestRender_AcceptsFilterBarWithRichParams(t *testing.T) {
	report, err := reportfill.DecodeJSON([]byte(`{
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
			"id":"scopeFilters",
			"kind":"filterBarBlock",
			"title":"Filters",
			"datasetRef":"primary",
			"paramIds":["dateRange","channelIds"],
			"content":{
				"title":"Filters",
				"params":[
					{"id":"dateRange","label":"Date Range","type":"dateRange","required":true,"presentation":"inlineToolbar","value":{"start":"2026-07-06","end":"2026-07-08"}},
					{"id":"channelIds","label":"Channels","type":"multiSelect","required":false,"multiple":true,"presentation":"compactIconRow","options":[{"label":"Display","value":1,"icon":"media"}],"value":[]}
				]
			}
		},{
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
	}`))
	require.NoError(t, err)

	data, err := Render(report)
	require.NoError(t, err)
	require.NotEmpty(t, data)
}

func TestRender_FormatsDefaultNumbersAndCompactValues(t *testing.T) {
	report, err := reportfill.DecodeJSON([]byte(`{
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
			"provenance": {"requestHash":"fnv1a:9702fdec","rowCount":1,"truncated":false,"hasMore":false,"diagnostics":[]},
			"rows": [{"avails":25095562010,"minClearingPrice":13.151637212662237}]
		}],
		"blocks": [{
			"id":"primaryTable",
			"kind":"tableBlock",
			"datasetRef":"primary",
			"columns":[
				{"key":"avails","label":"Avails","format":"compactNumber"},
				{"key":"minClearingPrice","label":"Min Clearing Price","format":"number"}
			],
			"content":{
				"columns":[
					{"key":"avails","label":"Avails","format":"compactNumber"},
					{"key":"minClearingPrice","label":"Min Clearing Price","format":"number"}
				],
				"rowCount":1,
				"resolvedRows":[
					{"rowIndex":0,"cells":[
						{"key":"avails","sourceKey":"avails","displayKey":"avails","value":25095562010,"displayValue":25095562010,"visualState":null},
						{"key":"minClearingPrice","sourceKey":"minClearingPrice","displayKey":"minClearingPrice","value":13.151637212662237,"displayValue":13.151637212662237,"visualState":null}
					]}
				]
			}
		}],
		"diagnostics": []
	}`))
	require.NoError(t, err)

	data, err := Render(report)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	workbook, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	require.Equal(t, "25 095 562 010", mustCellValue(t, workbook, "Report", "A2"))
	require.Equal(t, "13.15164", mustCellValue(t, workbook, "Report", "B2"))
}

func mustCellValue(t *testing.T, workbook *excelize.File, sheet, cell string) string {
	t.Helper()
	value, err := workbook.GetCellValue(sheet, cell)
	require.NoError(t, err)
	return value
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
