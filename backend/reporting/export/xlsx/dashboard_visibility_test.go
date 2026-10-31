package xlsx

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// Independently invented measurements share a selected value field; inactive
// presentation variants must not relabel that field in supporting worksheets.
func TestPrintSupportingSheetsHonorRuntimeVisibility(t *testing.T) {
	for _, selected := range []string{"count", "area", "none"} {
		t.Run(selected, func(t *testing.T) {
			artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
				spec["scope"] = map[string]any{"dataSourceRef": "synthetic", "params": []any{map[string]any{"id": "mode", "value": selected}}}
				blocks := []any{}
				for _, mode := range []string{"count", "area"} {
					runtime := map[string]any{"visibleWhen": map[string]any{"source": "filters", "field": "mode", "equals": mode}}
					blocks = append(blocks, map[string]any{"id": "chart_" + mode, "kind": "chartBlock", "title": mode + " chart", "datasetRef": "primary", "runtime": runtime, "rowLimit": 1, "chartSpec": map[string]any{"type": "bar", "xField": "period", "yFields": []string{"value"}}, "chartModel": map[string]any{"type": "bar", "xAxis": map[string]any{"dataKey": "period"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "label": mode, "type": "bar"}}}}}, map[string]any{"id": "table_" + mode, "kind": "tableBlock", "title": mode + " table", "datasetRef": "primary", "runtime": runtime, "columns": []any{map[string]any{"key": "period", "label": "Period"}, map[string]any{"key": "value", "label": mode}}}, map[string]any{"id": "metric_" + mode, "kind": "kpiBlock", "title": mode + " metric", "datasetRef": "primary", "runtime": runtime, "valueField": "value", "valueLabel": mode, "valueFormat": "number"})
				}
				// These children have no own visibility condition. Their inactive ancestor
				// owns visibility, including when a child ID resembles an active ID.
				childChart := map[string]any{"id": "chart_count__shadow", "kind": "chartBlock", "title": "Excluded child chart", "datasetRef": "primary", "chartSpec": map[string]any{"type": "bar", "xField": "period", "yFields": []string{"value"}}, "chartModel": map[string]any{"type": "bar", "xAxis": map[string]any{"dataKey": "period"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "type": "bar"}}}}}
				childTable := map[string]any{"id": "excluded_table", "kind": "tableBlock", "title": "Excluded child table", "datasetRef": "primary", "columns": []any{map[string]any{"key": "value", "label": "Unselected value"}}}
				blocks = append(blocks, map[string]any{"id": "excluded_panel", "kind": "compositeBlock", "title": "Excluded panel", "runtime": map[string]any{"visibleWhen": map[string]any{"source": "filters", "field": "mode", "equals": "never"}}, "childBlockIds": []string{"chart_count__shadow", "excluded_table"}}, childChart, childTable)
				spec["blocks"] = blocks
				spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"chart_count", "chart_area", "table_count", "table_area", "metric_count", "metric_area"}}
			})
			printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			for _, page := range printed.Pages {
				for _, element := range page.Elements {
					if selected != "area" {
						require.NotContains(t, element.Text, "area")
					}
					if selected != "count" {
						require.NotContains(t, element.Text, "count")
					}
				}
			}
			data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
			require.NoError(t, err)
			workbook, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer workbook.Close()
			for _, mode := range []string{"count", "area"} {
				if selected == mode {
					require.Contains(t, workbook.GetSheetList(), "Chart "+mode+" chart")
					require.Contains(t, workbook.GetSheetList(), "Table "+mode+" table")
				} else {
					require.NotContains(t, workbook.GetSheetList(), "Chart "+mode+" chart")
					require.NotContains(t, workbook.GetSheetList(), "Table "+mode+" table")
				}
			}
			require.NotContains(t, workbook.GetSheetList(), "Chart Excluded child chart")
			require.NotContains(t, workbook.GetSheetList(), "Table Excluded child table")
			if selected == "none" {
				require.NotContains(t, workbook.GetSheetList(), "Values")
				require.NotNil(t, printed.VisibleBlockIDs)
				require.Empty(t, *printed.VisibleBlockIDs)
				roundtrip, err := json.Marshal(printed)
				require.NoError(t, err)
				decoded, err := reportprint.DecodeJSON(roundtrip)
				require.NoError(t, err)
				require.NotNil(t, decoded.VisibleBlockIDs)
				require.Empty(t, *decoded.VisibleBlockIDs)
			} else {
				values, err := workbook.GetRows("Values")
				require.NoError(t, err)
				for _, row := range values {
					if selected == "count" {
						require.NotContains(t, row, "area metric")
					} else {
						require.NotContains(t, row, "count metric")
					}
				}
			}
			// Legacy matched print recovers rendered membership without requiring
			// new metadata or requerying a data producer.
			var legacy map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(artifacts.ReportPrint, &legacy))
			delete(legacy, "visibleBlockIds")
			legacyPrint, err := json.Marshal(legacy)
			require.NoError(t, err)
			legacyData, err := RenderDashboardWithPrint(artifacts.ReportFill, legacyPrint)
			require.NoError(t, err)
			legacyBook, err := excelize.OpenReader(bytes.NewReader(legacyData))
			require.NoError(t, err)
			for _, mode := range []string{"count", "area"} {
				if mode == selected {
					require.Contains(t, legacyBook.GetSheetList(), "Table "+mode+" table")
				} else {
					require.NotContains(t, legacyBook.GetSheetList(), "Table "+mode+" table")
				}
			}
			require.NotContains(t, legacyBook.GetSheetList(), "Table Excluded child table")
			require.NoError(t, legacyBook.Close())
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			require.NoError(t, err)
			_, err = RenderDashboard(fill)
			require.NoError(t, err)
			for _, ids := range [][]string{{"unknown"}, {"chart_count", "chart_count"}, {""}} {
				raw, err := json.Marshal(ids)
				require.NoError(t, err)
				legacy["visibleBlockIds"] = raw
				invalid, err := json.Marshal(legacy)
				require.NoError(t, err)
				_, err = RenderDashboardWithPrint(artifacts.ReportFill, invalid)
				require.ErrorContains(t, err, "visibleBlockIds")
			}
			rows, err := workbook.GetRows("Data primary")
			require.NoError(t, err)
			require.Equal(t, [][]string{{"Period 01", "12.125"}, {"Period 02", "18.25"}, {"Period 03", "15.5"}, {"Period 04", "23.75"}}, rows[4:8])
		})
	}
}

func TestPrintMembershipRetainsAllTabsAndNestedGroups(t *testing.T) {
	artifacts := printExample(t, func(spec map[string]any, _ map[string]json.RawMessage) {
		spec["blocks"] = []any{
			map[string]any{"id": "tabs", "kind": "tabGroupBlock", "title": "Measurements", "sectionIds": []string{"first", "second"}, "defaultSectionId": "first"},
			map[string]any{"id": "first", "kind": "sectionBlock", "title": "First measurements", "navigationLabel": "First measurements", "blockIds": []string{"outer"}},
			map[string]any{"id": "outer", "kind": "compositeBlock", "title": "Outer group", "childBlockIds": []string{"inner"}},
			map[string]any{"id": "inner", "kind": "compositeBlock", "title": "Inner group", "childBlockIds": []string{"chart"}},
			map[string]any{"id": "chart", "kind": "chartBlock", "title": "First chart", "datasetRef": "primary", "chartSpec": map[string]any{"type": "bar", "xField": "period", "yFields": []string{"value"}}, "chartModel": map[string]any{"type": "bar", "xAxis": map[string]any{"dataKey": "period"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "type": "bar"}}}}},
			map[string]any{"id": "second", "kind": "sectionBlock", "title": "Second measurements", "navigationLabel": "Second measurements", "blockIds": []string{"secondGroup"}},
			map[string]any{"id": "secondGroup", "kind": "compositeBlock", "title": "Second group", "childBlockIds": []string{"table"}},
			map[string]any{"id": "table", "kind": "tableBlock", "title": "Second table", "datasetRef": "primary", "columns": []any{map[string]any{"key": "value", "label": "Value"}}},
		}
		spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"tabs", "first", "outer", "second", "secondGroup"}}
	})
	printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	require.NotNil(t, printed.VisibleBlockIDs)
	for _, id := range []string{"first", "outer", "inner", "chart", "second", "secondGroup", "table"} {
		require.Contains(t, *printed.VisibleBlockIDs, id)
	}
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	workbook, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer workbook.Close()
	for _, sheet := range []string{"First measurements", "Second measurements", "Chart First chart", "Table Second table", "Data primary"} {
		require.Contains(t, workbook.GetSheetList(), sheet)
	}
}

func TestLegacyUnconditionalPrintMembershipRemainsOptional(t *testing.T) {
	artifacts := printExample(t)
	var legacy map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(artifacts.ReportPrint, &legacy))
	delete(legacy, "visibleBlockIds")
	raw, err := json.Marshal(legacy)
	require.NoError(t, err)
	decoded, err := reportprint.DecodeJSON(raw)
	require.NoError(t, err)
	require.Nil(t, decoded.VisibleBlockIDs)
	encoded, err := json.Marshal(decoded)
	require.NoError(t, err)
	require.NotContains(t, string(encoded), "visibleBlockIds")
	_, err = RenderDashboardWithPrint(artifacts.ReportFill, raw)
	require.NoError(t, err)
}
