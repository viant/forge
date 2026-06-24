package reportfill

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDecodeJSON_ReportFillTableBlock(t *testing.T) {
	report, err := DecodeJSON([]byte(validTestReportFillJSON()))
	require.NoError(t, err)
	require.Equal(t, 1, report.Version)
	require.Equal(t, "reportFill", report.Kind)
	require.Len(t, report.Datasets, 1)
	require.Len(t, report.Blocks, 1)
	require.Equal(t, "tableBlock", report.Blocks[0].Kind)
	require.NotNil(t, report.Blocks[0].Content)
	require.Len(t, report.Blocks[0].Content.ResolvedRows, 2)
}

func TestDecodeJSON_ReportFillRejectsInvalidTableBlock(t *testing.T) {
	requestHash, err := computeJSONFNV1aRawHash(json.RawMessage(`{"limit":25,"offset":0}`))
	require.NoError(t, err)
	_, err = DecodeJSON([]byte(fmt.Sprintf(`{"version":1,"kind":"reportFill","specVersion":1,"specHash":"spec-1","source":{"kind":"dashboard.reportBuilder","containerId":"demo","stateKey":"demo","dataSourceRef":"demo"},"parameters":{"viewMode":"table","groupBy":"","pageSize":25,"orderField":"","orderDir":"asc"},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"demo","request":{"limit":25,"offset":0},"provenance":{"requestHash":"%s","rowCount":1,"truncated":false,"hasMore":false,"diagnostics":[]},"rows":[{"channel":"Display"}]}],"blocks":[{"id":"primaryTable","kind":"tableBlock","datasetRef":"primary","columns":[],"content":{"columns":[],"rowCount":1,"resolvedRows":[]}}],"diagnostics":[]}`, requestHash)))
	require.EqualError(t, err, "reportFill.blocks[0].columns must not be empty for tableBlock")
}

func TestDecodeJSON_ReportFillRejectsDatasetRequestHashMismatch(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	datasets := fixture["datasets"].([]any)
	dataset := datasets[0].(map[string]any)
	provenance := dataset["provenance"].(map[string]any)
	provenance["requestHash"] = "fnv1a:deadbeef"

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.datasets[0].provenance.requestHash must match request")
}

func TestDecodeJSON_ReportFillRejectsDatasetRowCountMismatch(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	datasets := fixture["datasets"].([]any)
	dataset := datasets[0].(map[string]any)
	provenance := dataset["provenance"].(map[string]any)
	provenance["rowCount"] = 99

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.datasets[0].provenance.rowCount must match rows length")
}

func TestDecodeJSON_ReportFillFixtureWithCellVisualColumns(t *testing.T) {
	data := loadReportFillFixtureBytes(t, "capacity-audience-report-fill-fixture.v1.json")
	report, err := DecodeJSON(data)
	require.NoError(t, err)
	require.Equal(t, "reportFill", report.Kind)
	require.Len(t, report.Blocks, 5)

	var foundCellVisual bool
	var foundBadgeState bool
	var foundDataBarState bool
	for _, block := range report.Blocks {
		for _, column := range block.Columns {
			if column.CellVisual != nil {
				foundCellVisual = true
			}
		}
		if block.Content == nil {
			continue
		}
		for _, row := range block.Content.ResolvedRows {
			for _, cell := range row.Cells {
				if cell.VisualState == nil {
					continue
				}
				switch cell.VisualState.Kind {
				case "badge":
					foundBadgeState = true
					require.NotEmpty(t, cell.VisualState.Label)
					require.NotEmpty(t, cell.VisualState.Tone)
				case "dataBar":
					foundDataBarState = true
					require.NotNil(t, cell.VisualState.Value)
					require.NotNil(t, cell.VisualState.Percent)
					require.NotEmpty(t, cell.VisualState.Palette)
				}
			}
		}
	}
	require.True(t, foundCellVisual)
	require.True(t, foundBadgeState)
	require.True(t, foundDataBarState)
}

func TestDecodeJSON_ReportFillFixtureWithChartAndKPIContent(t *testing.T) {
	report, err := DecodeJSON(loadReportFillFromExportRequestFixtureBytes(t, "capacity-direct-series-export-request-fixture.v1.json"))
	require.NoError(t, err)
	require.Equal(t, "reportFill", report.Kind)
	require.NotNil(t, report.Datasets[0].Request.Limit)
	require.Equal(t, 50, *report.Datasets[0].Request.Limit)
	require.NotNil(t, report.Datasets[0].Request.Offset)
	require.Equal(t, 0, *report.Datasets[0].Request.Offset)
	require.NotNil(t, report.Datasets[0].Request.SemanticSelection)
	require.Equal(t, "model://example/performance/delivery@v1", report.Datasets[0].Request.SemanticSelection.ModelRef)
	require.Equal(t, []string{"event_date"}, report.Datasets[0].Request.SemanticSelection.Selection.Dimensions)
	require.Equal(t, []string{"available_impressions", "household_uniques"}, report.Datasets[0].Request.SemanticSelection.Selection.Measures)

	var foundChart bool
	var foundKPI bool
	var foundFilterBar bool
	var foundRefinementBar bool
	for _, block := range report.Blocks {
		switch block.Kind {
		case "chartBlock":
			foundChart = true
			require.Equal(t, "primary", block.DatasetRef)
			require.NotNil(t, block.ChartContent)
			require.NotNil(t, block.ChartContent.RowCount)
			require.Equal(t, 8, *block.ChartContent.RowCount)
			require.NotEmpty(t, block.ChartSpec)
			require.NotEmpty(t, block.ChartModel)
			require.NotNil(t, block.ChartContent.ResolvedChart)
			require.Equal(t, "directSeries", block.ChartContent.ResolvedChart.Kind)
			require.Equal(t, "eventDate", block.ChartContent.ResolvedChart.XAxisKey)
			require.Equal(t, []string{"avails", "hhUniqs"}, block.ChartContent.ResolvedChart.SeriesKeys)
		case "kpiBlock":
			foundKPI = true
			require.NotNil(t, block.KPIContent)
			require.Equal(t, "Headline KPI", block.KPIContent.Title)
			require.NotNil(t, block.KPIContent.RowCount)
		case "filterBarBlock":
			foundFilterBar = true
			require.NotNil(t, block.FilterBarContent)
			require.NotEmpty(t, block.FilterBarContent.Params)
		case "refinementBarBlock":
			foundRefinementBar = true
			require.NotNil(t, block.RefinementBarContent)
			require.NotNil(t, block.RefinementBarContent.Refinements)
		case "markdownBlock":
			require.NotNil(t, block.MarkdownContent)
		}
	}
	require.True(t, foundChart)
	require.True(t, foundKPI)
	require.True(t, foundFilterBar)
	require.True(t, foundRefinementBar)
}

func TestDecodeJSON_ReportFillFixtureWithGroupedSeriesChartContent(t *testing.T) {
	report := loadReportFillFromPerformanceFixture(t, "raw")
	require.Equal(t, "reportFill", report.Kind)

	var foundChart bool
	for _, block := range report.Blocks {
		if block.Kind != "chartBlock" {
			continue
		}
		foundChart = true
		require.NotNil(t, block.ChartContent)
		require.NotNil(t, block.ChartContent.ResolvedChart)
		require.Equal(t, "groupedSeries", block.ChartContent.ResolvedChart.Kind)
		require.Equal(t, "eventDate", block.ChartContent.ResolvedChart.XAxisKey)
		require.Equal(t, "channelId", block.ChartContent.ResolvedChart.NameKey)
		require.Equal(t, "totalSpend", block.ChartContent.ResolvedChart.ValueKey)
		require.Equal(t, []string{"Display", "CTV"}, block.ChartContent.ResolvedChart.SeriesKeys)
	}
	require.True(t, foundChart)
}

func TestDecodeJSON_ReportFillFixtureWithGeoContent(t *testing.T) {
	report := loadReportFillFromPerformanceFixture(t, "geo")
	require.Equal(t, "reportFill", report.Kind)

	var foundGeo bool
	for _, block := range report.Blocks {
		if block.Kind != "geoMapBlock" {
			continue
		}
		foundGeo = true
		require.Equal(t, "primary", block.DatasetRef)
		require.NotEmpty(t, block.Geo)
		require.NotNil(t, block.GeoContent)
		require.NotNil(t, block.GeoContent.RowCount)
		require.Equal(t, 3, *block.GeoContent.RowCount)
		require.NotEmpty(t, block.GeoContent.Geo)
		require.NotNil(t, block.GeoContent.ResolvedGeo)
		require.Equal(t, "us-states", block.GeoContent.ResolvedGeo.Shape)
		require.Equal(t, "stateCode", block.GeoContent.ResolvedGeo.KeyField)
		require.Equal(t, "stateName", block.GeoContent.ResolvedGeo.LabelField)
		require.Len(t, block.GeoContent.ResolvedGeo.Regions, 2)
		require.Equal(t, "California", block.GeoContent.ResolvedGeo.Regions[0].Label)
		require.Equal(t, "#db3737", block.GeoContent.ResolvedGeo.Regions[0].Color)
		require.NotNil(t, block.GeoContent.ResolvedGeo.Regions[0].RowCount)
		require.Equal(t, 2, *block.GeoContent.ResolvedGeo.Regions[0].RowCount)
		require.NotNil(t, block.GeoContent.ResolvedGeo.Summary)
		require.Equal(t, "$220", block.GeoContent.ResolvedGeo.Summary.TotalValue)
		require.NotNil(t, block.GeoContent.ResolvedGeo.Legend)
		require.Len(t, block.GeoContent.ResolvedGeo.Legend.Rules, 1)
	}
	require.True(t, foundGeo)
}

func TestDecodeJSON_ReportFillRejectsChartBlockWithoutContentChartSpec(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "chartBlock" {
			content := block["content"].(map[string]any)
			delete(content, "chartSpec")
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[3].content.chartSpec is required for chartBlock")
}

func TestDecodeJSON_ReportFillRejectsDatasetRequestWithoutLimit(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	datasets := fixture["datasets"].([]any)
	dataset := datasets[0].(map[string]any)
	request := dataset["request"].(map[string]any)
	delete(request, "limit")

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.datasets[0].request.limit is required")
}

func TestDecodeJSON_ReportFillRejectsSemanticSelectionWithoutParameters(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	datasets := fixture["datasets"].([]any)
	dataset := datasets[0].(map[string]any)
	request := dataset["request"].(map[string]any)
	semanticSelection := request["semanticSelection"].(map[string]any)
	delete(semanticSelection, "parameters")

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.datasets[0].request.semanticSelection.parameters is required")
}

func TestDecodeJSON_ReportFillRejectsBadgeVisualStateWithoutLabel(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-audience-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] != "tableBlock" || block["id"] != "comparisonTable" {
			continue
		}
		content := block["content"].(map[string]any)
		rows := content["resolvedRows"].([]any)
		firstRow := rows[0].(map[string]any)
		cells := firstRow["cells"].([]any)
		for _, cellValue := range cells {
			cell := cellValue.(map[string]any)
			visualState, ok := cell["visualState"].(map[string]any)
			if !ok || visualState["kind"] != "badge" {
				continue
			}
			delete(visualState, "label")
			break
		}
		break
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "visualState.label is required for badge")
}

func TestDecodeJSON_ReportFillRejectsResolvedTableCellWithoutDisplayKey(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-audience-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] != "tableBlock" || block["id"] != "comparisonTable" {
			continue
		}
		content := block["content"].(map[string]any)
		rows := content["resolvedRows"].([]any)
		firstRow := rows[0].(map[string]any)
		cells := firstRow["cells"].([]any)
		firstCell := cells[0].(map[string]any)
		delete(firstCell, "displayKey")
		break
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[4].content.resolvedRows[0].cells[0].displayKey is required for tableBlock")
}

func TestDecodeJSON_ReportFillAcceptsDataBarVisualStateWithEmptyPalette(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] != "tableBlock" || block["id"] != "comparisonTable" {
			continue
		}
		content := block["content"].(map[string]any)
		rows := content["resolvedRows"].([]any)
		firstRow := rows[0].(map[string]any)
		cells := firstRow["cells"].([]any)
		for _, cellValue := range cells {
			cell := cellValue.(map[string]any)
			visualState, ok := cell["visualState"].(map[string]any)
			if !ok || visualState["kind"] != "dataBar" {
				continue
			}
			visualState["palette"] = []any{}
			break
		}
		break
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	report, err := DecodeJSON(data)
	require.NoError(t, err)
	require.NotNil(t, report)
}

func TestDecodeJSON_ReportFillRejectsChartBlockWithoutResolvedChartXAxisKey(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "chartBlock" {
			content := block["content"].(map[string]any)
			resolvedChart := content["resolvedChart"].(map[string]any)
			delete(resolvedChart, "xAxisKey")
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[3].content.resolvedChart.xAxisKey is required for directSeries")
}

func TestDecodeJSON_ReportFillRejectsChartBlockWithoutResolvedChartSeriesKeys(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "chartBlock" {
			content := block["content"].(map[string]any)
			resolvedChart := content["resolvedChart"].(map[string]any)
			resolvedChart["seriesKeys"] = []any{}
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[3].content.resolvedChart.seriesKeys must not be empty for chartBlock")
}

func TestDecodeJSON_ReportFillRejectsGroupedSeriesChartBlockWithBlankSeriesKey(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "raw")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "chartBlock" {
			content := block["content"].(map[string]any)
			resolvedChart := content["resolvedChart"].(map[string]any)
			resolvedChart["seriesKeys"] = []any{"   ", "CTV"}
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[1].content.resolvedChart.seriesKeys[0] must not be blank for chartBlock")
}

func TestDecodeJSON_ReportFillRejectsGeoBlockWithoutResolvedGeoContent(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "geoMapBlock" {
			content := block["content"].(map[string]any)
			delete(content, "geo")
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[2].content.geo is required for geoMapBlock")
}

func TestDecodeJSON_ReportFillRejectsGeoBlockWithoutResolvedGeoPayload(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "geoMapBlock" {
			content := block["content"].(map[string]any)
			delete(content, "resolvedGeo")
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[2].content.resolvedGeo is required for geoMapBlock")
}

func TestDecodeJSON_ReportFillRejectsGeoBlockWithoutResolvedGeoLabelField(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "geoMapBlock" {
			content := block["content"].(map[string]any)
			resolvedGeo := content["resolvedGeo"].(map[string]any)
			delete(resolvedGeo, "labelField")
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[2].content.resolvedGeo.labelField is required for geoMapBlock")
}

func TestDecodeJSON_ReportFillRejectsGeoBlockWithoutRegionLabel(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "geoMapBlock" {
			content := block["content"].(map[string]any)
			resolvedGeo := content["resolvedGeo"].(map[string]any)
			regions := resolvedGeo["regions"].([]any)
			firstRegion := regions[0].(map[string]any)
			delete(firstRegion, "label")
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[2].content.resolvedGeo.regions[0].label is required for geoMapBlock")
}

func TestDecodeJSON_ReportFillAcceptsGeoBlockWithRangeLegend(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "geoMapBlock" {
			content := block["content"].(map[string]any)
			resolvedGeo := content["resolvedGeo"].(map[string]any)
			resolvedGeo["legend"] = map[string]any{
				"min":     "$0",
				"max":     "$220",
				"palette": []any{"#d9f0ea", "#db3737"},
			}
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	report, err := DecodeJSON(data)
	require.NoError(t, err)
	var foundGeo bool
	for _, block := range report.Blocks {
		if block.Kind != "geoMapBlock" {
			continue
		}
		foundGeo = true
		require.NotNil(t, block.GeoContent)
		require.NotNil(t, block.GeoContent.ResolvedGeo)
		require.NotNil(t, block.GeoContent.ResolvedGeo.Legend)
		require.Equal(t, "$0", block.GeoContent.ResolvedGeo.Legend.Min)
		require.Equal(t, "$220", block.GeoContent.ResolvedGeo.Legend.Max)
		require.Equal(t, []string{"#d9f0ea", "#db3737"}, block.GeoContent.ResolvedGeo.Legend.Palette)
	}
	require.True(t, foundGeo)
}

func TestDecodeJSON_ReportFillRejectsGeoBlockLegendWithMixedRulesAndRange(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "geoMapBlock" {
			content := block["content"].(map[string]any)
			resolvedGeo := content["resolvedGeo"].(map[string]any)
			legend := resolvedGeo["legend"].(map[string]any)
			legend["min"] = "$0"
			legend["max"] = "$220"
			legend["palette"] = []any{"#d9f0ea", "#db3737"}
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[2].content.resolvedGeo.legend must use either rules or range for geoMapBlock")
}

func TestDecodeJSON_ReportFillRejectsGeoBlockLegendRangeWithoutMax(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "geoMapBlock" {
			content := block["content"].(map[string]any)
			resolvedGeo := content["resolvedGeo"].(map[string]any)
			resolvedGeo["legend"] = map[string]any{
				"min":     "$0",
				"palette": []any{"#d9f0ea", "#db3737"},
			}
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportFill.blocks[2].content.resolvedGeo.legend.max is required for range geoMapBlock legend")
}

func TestDecodeJSON_ReportFillRejectsTrailingContent(t *testing.T) {
	_, err := DecodeJSON([]byte(validTestReportFillJSON() + "\n{}"))
	require.Error(t, err)
	require.Contains(t, err.Error(), "trailing content after top-level object")
}

func validTestReportFillJSON() string {
	requestHash, err := computeJSONFNV1aRawHash(json.RawMessage(`{"limit":25,"offset":0}`))
	if err != nil {
		panic(err)
	}
	return fmt.Sprintf(`{
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
			"provenance": {"requestHash":"%s","rowCount":2,"truncated":false,"hasMore":false,"diagnostics":[]},
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
	}`, requestHash)
}

func loadReportFillFixtureBytes(t *testing.T, filename string) []byte {
	t.Helper()
	_, currentFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	fixturePath := filepath.Join(
		filepath.Dir(currentFile),
		"..", "..", "..",
		"src", "reporting", "fixtures", filename,
	)
	data, err := os.ReadFile(fixturePath)
	require.NoError(t, err)
	return data
}

func loadReportFillFromExportRequestFixtureBytes(t *testing.T, filename string) []byte {
	t.Helper()
	var exportRequest struct {
		ReportFill json.RawMessage `json:"reportFill"`
	}
	require.NoError(t, json.Unmarshal(loadReportFillFixtureBytes(t, filename), &exportRequest))
	return exportRequest.ReportFill
}

func loadReportFillFromExportRequestFixtureMap(t *testing.T, filename string) map[string]any {
	t.Helper()
	var value map[string]any
	require.NoError(t, json.Unmarshal(loadReportFillFromExportRequestFixtureBytes(t, filename), &value))
	return value
}

func loadReportFillFromPerformanceFixture(t *testing.T, variant string) *ReportFill {
	t.Helper()
	fill, err := DecodeJSON(loadReportFillFromPerformanceFixtureBytes(t, variant))
	require.NoError(t, err)
	return fill
}

func loadReportFillFromPerformanceFixtureMap(t *testing.T, variant string) map[string]any {
	t.Helper()
	var value map[string]any
	require.NoError(t, json.Unmarshal(loadReportFillFromPerformanceFixtureBytes(t, variant), &value))
	return value
}

func syncReportFillFixtureProvenance(fixture map[string]any) {
	datasets, ok := fixture["datasets"].([]any)
	if !ok {
		return
	}
	for _, datasetValue := range datasets {
		dataset, ok := datasetValue.(map[string]any)
		if !ok {
			continue
		}
		request := dataset["request"]
		provenance, ok := dataset["provenance"].(map[string]any)
		if !ok {
			continue
		}
		provenance["requestHash"] = hashFixtureValue(request)
		if rows, ok := dataset["rows"].([]any); ok {
			provenance["rowCount"] = len(rows)
		}
	}
}

func hashFixtureValue(value any) string {
	hash, err := computeJSONFNV1aHash(value)
	if err != nil {
		panic(err)
	}
	return hash
}

func loadReportFillFromPerformanceFixtureBytes(t *testing.T, variant string) []byte {
	t.Helper()
	data := loadReportFillFixtureBytes(t, "performance-report-fixtures.v1.json")
	var fixture struct {
		Raw struct {
			ReportFill json.RawMessage `json:"reportFill"`
		} `json:"raw"`
		Geo struct {
			ReportFill json.RawMessage `json:"reportFill"`
		} `json:"geo"`
	}
	require.NoError(t, json.Unmarshal(data, &fixture))
	switch variant {
	case "raw":
		return fixture.Raw.ReportFill
	case "geo":
		return fixture.Geo.ReportFill
	default:
		t.Fatalf("unsupported performance reportFill fixture variant %q", variant)
		return nil
	}
}
