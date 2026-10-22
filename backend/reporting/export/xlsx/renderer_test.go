package xlsx

import (
	"bytes"
	"encoding/json"
	"strconv"
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

func TestRenderPreservesNumericPrecisionAndSpreadsheetCalculations(t *testing.T) {
	report, err := reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)
	values := []float64{0.11459765000000001, 0}
	for i, value := range values {
		report.Datasets[0].Rows[i]["spend"] = value
		report.Blocks[0].Content.ResolvedRows[i].Cells[1].Value = value
		report.Blocks[0].Content.ResolvedRows[i].Cells[1].DisplayValue = value
	}
	// Currency changes presentation only; SUM must retain sub-cent precision.
	data, err := Render(report)
	require.NoError(t, err)
	workbook, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer workbook.Close()
	raw, err := workbook.GetCellValue("Report", "B2", excelize.Options{RawCellValue: true})
	require.NoError(t, err)
	value, err := strconv.ParseFloat(raw, 64)
	require.NoError(t, err)
	require.Equal(t, values[0], value)
	require.Equal(t, "$0.11", mustCellValue(t, workbook, "Report", "B2"))
	zero, err := workbook.GetCellValue("Report", "B3", excelize.Options{RawCellValue: true})
	require.NoError(t, err)
	require.Equal(t, "0", zero, "zero must not become a blank cell")
	require.NoError(t, workbook.SetCellFormula("Report", "D2", "SUM(B2:B3)"))
	total, err := workbook.CalcCellValue("Report", "D2")
	require.NoError(t, err)
	sum, err := strconv.ParseFloat(total, 64)
	require.NoError(t, err)
	require.InDelta(t, values[0], sum, 1e-14)
}

func TestRenderRetainsLongIdentifiersAndNullCells(t *testing.T) {
	report, err := reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)
	cell := &report.Blocks[0].Content.ResolvedRows[0].Cells[0]
	cell.Value = json.Number("9007199254740993")
	cell.DisplayValue = cell.Value
	report.Datasets[0].Rows[0]["channel"] = cell.Value
	cell = &report.Blocks[0].Content.ResolvedRows[1].Cells[1]
	cell.Value = nil
	cell.DisplayValue = nil
	report.Datasets[0].Rows[1]["spend"] = nil
	column := reportfill.TableColumn{Key: "enabled", Label: "Enabled"}
	report.Blocks[0].Columns = append(report.Blocks[0].Columns, column)
	report.Blocks[0].Content.Columns = append(report.Blocks[0].Content.Columns, column)
	for i, enabled := range []bool{false, true} {
		report.Datasets[0].Rows[i]["enabled"] = enabled
		report.Blocks[0].Content.ResolvedRows[i].Cells = append(report.Blocks[0].Content.ResolvedRows[i].Cells, reportfill.ResolvedTableCell{Key: "enabled", SourceKey: "enabled", DisplayKey: "enabled", Value: enabled, DisplayValue: enabled})
	}
	data, err := Render(report)
	require.NoError(t, err)
	workbook, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer workbook.Close()
	require.Equal(t, "9007199254740993", mustCellValue(t, workbook, "Report", "A2"))
	kind, err := workbook.GetCellType("Report", "A2")
	require.NoError(t, err)
	require.Equal(t, excelize.CellTypeSharedString, kind)
	require.Empty(t, mustCellValue(t, workbook, "Report", "B3"))
	require.NoError(t, workbook.SetCellFormula("Report", "D2", "ISBLANK(B3)"))
	blank, err := workbook.CalcCellValue("Report", "D2")
	require.NoError(t, err)
	require.Equal(t, "TRUE", blank, "null measurements must be real blanks")
	for _, address := range []string{"C2", "C3"} {
		kind, err := workbook.GetCellType("Report", address)
		require.NoError(t, err)
		require.Equal(t, excelize.CellTypeBool, kind)
	}
}

func TestRenderPercentageDisplayKeepsOriginalScale(t *testing.T) {
	for _, tc := range []struct {
		format  string
		value   float64
		display string
	}{
		{"percent", 12.345, "12.3%"}, {"percentFraction", 0.12345, "12.3%"}, {"percentFraction2", 0.12345, "12.35%"},
	} {
		t.Run(tc.format, func(t *testing.T) {
			report, err := reportfill.DecodeJSON([]byte(validTestReportFillJSON()))
			require.NoError(t, err)
			report.Blocks[0].Columns[1].Format = tc.format
			report.Blocks[0].Content.Columns[1].Format = tc.format
			cell := &report.Blocks[0].Content.ResolvedRows[0].Cells[1]
			cell.Value, cell.DisplayValue = tc.value, tc.value
			report.Datasets[0].Rows[0]["spend"] = tc.value
			data, err := Render(report)
			require.NoError(t, err)
			workbook, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer workbook.Close()
			require.Equal(t, tc.display, mustCellValue(t, workbook, "Report", "B2"))
			raw, err := workbook.GetCellValue("Report", "B2", excelize.Options{RawCellValue: true})
			require.NoError(t, err)
			value, err := strconv.ParseFloat(raw, 64)
			require.NoError(t, err)
			require.Equal(t, tc.value, value)
		})
	}
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
	require.Equal(t, "25,095,562,010", mustCellValue(t, workbook, "Report", "A2"))
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
