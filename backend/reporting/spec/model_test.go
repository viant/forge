package reportspec

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDecodeJSON_CapacityDirectSeriesReportSpec(t *testing.T) {
	spec := loadReportSpecFixture(t, "capacity-direct-series-export-request-fixture.v1.json")

	require.Equal(t, 1, spec.Version)
	require.Equal(t, "reportSpec", spec.Kind)
	require.Equal(t, "Capacity KPI Blend Q3", spec.Title)
	require.Equal(t, "dashboard.reportBuilder", spec.Source.Kind)
	require.NotNil(t, spec.Binding)
	require.NotNil(t, spec.SemanticSummary)
	require.NotNil(t, spec.Parameters)
	require.NotNil(t, spec.LayoutIntent)
	require.Len(t, spec.Datasets, 1)
	require.NotNil(t, spec.Datasets[0].Request.Limit)
	require.Equal(t, 50, *spec.Datasets[0].Request.Limit)
	require.NotNil(t, spec.Datasets[0].Request.Offset)
	require.Equal(t, 0, *spec.Datasets[0].Request.Offset)
	require.NotNil(t, spec.Datasets[0].Request.SemanticSelection)
	require.Equal(t, "model://example/performance/delivery@v1", spec.Datasets[0].Request.SemanticSelection.ModelRef)
	require.Equal(t, "line_delivery", spec.Datasets[0].Request.SemanticSelection.Entity)
	require.Equal(t, []string{"event_date"}, spec.Datasets[0].Request.SemanticSelection.Selection.Dimensions)
	require.Equal(t, []string{"available_impressions", "household_uniques"}, spec.Datasets[0].Request.SemanticSelection.Selection.Measures)
	require.Equal(t, []string{"eventDate asc"}, spec.Datasets[0].Request.OrderBy)
	require.Len(t, spec.Blocks, 6)
	require.Equal(t, "filterBarBlock", spec.Blocks[0].Kind)
	require.Equal(t, 2, len(spec.Blocks[0].ParamIDs))
	require.Equal(t, "chartBlock", spec.Blocks[3].Kind)
	require.Equal(t, "primary", spec.Blocks[3].DatasetRef)
	require.NotEmpty(t, spec.Blocks[3].ChartSpec)
	require.NotEmpty(t, spec.Blocks[3].ChartModel)
	require.Equal(t, "tableBlock", spec.Blocks[len(spec.Blocks)-1].Kind)
	require.Len(t, spec.Blocks[len(spec.Blocks)-1].Columns, 4)
}

func TestDecodeJSON_CapacityAudienceReportSpecPreservesCellVisualColumns(t *testing.T) {
	spec := loadReportSpecFixture(t, "capacity-audience-export-request-fixture.v1.json")

	var comparisonTable Block
	found := false
	for _, block := range spec.Blocks {
		if block.ID == "comparisonTable" {
			comparisonTable = block
			found = true
			break
		}
	}
	require.True(t, found)
	require.Equal(t, "tableBlock", comparisonTable.Kind)
	require.Len(t, comparisonTable.Columns, 4)
	require.True(t, comparisonTable.Columns[1].RuntimeFilterable)
	require.NotNil(t, comparisonTable.Columns[1].CellVisual)
	require.NotNil(t, comparisonTable.Columns[2].CellVisual)
	require.NotNil(t, spec.Datasets[0].Request.SemanticSelection)
	require.NotNil(t, spec.Datasets[0].Request.SemanticSelection.Parameters)
	require.Equal(t, []string{"country_code"}, spec.Datasets[0].Request.SemanticSelection.Selection.Dimensions)
}

func TestDecodeJSON_RejectsUnknownTopLevelField(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	fixture["unexpected"] = true

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "unknown field")
}

func TestDecodeJSON_RejectsMissingBlocks(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	delete(fixture, "blocks")

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportSpec.blocks must not be empty")
}

func TestDecodeJSON_RejectsInvalidOrderDir(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	parameters := fixture["parameters"].(map[string]any)
	parameters["orderDir"] = "sideways"

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportSpec.parameters.orderDir must be asc or desc")
}

func TestDecodeJSON_RejectsTableBlockWithoutColumns(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "tableBlock" && block["id"] == "comparisonTable" {
			block["columns"] = []any{}
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportSpec.blocks[5].columns must not be empty for tableBlock")
}

func TestDecodeJSON_RejectsDatasetRequestWithoutLimit(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	datasets := fixture["datasets"].([]any)
	dataset := datasets[0].(map[string]any)
	request := dataset["request"].(map[string]any)
	delete(request, "limit")

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportSpec.datasets[0].request.limit is required")
}

func TestDecodeJSON_RejectsSemanticSelectionWithoutParameters(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	datasets := fixture["datasets"].([]any)
	dataset := datasets[0].(map[string]any)
	request := dataset["request"].(map[string]any)
	semanticSelection := request["semanticSelection"].(map[string]any)
	delete(semanticSelection, "parameters")

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportSpec.datasets[0].request.semanticSelection.parameters is required")
}

func TestDecodeJSON_RejectsBlankOrderByEntry(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	datasets := fixture["datasets"].([]any)
	dataset := datasets[0].(map[string]any)
	request := dataset["request"].(map[string]any)
	request["orderBy"] = []any{"   "}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reportSpec.datasets[0].request.orderBy[0] must not be blank")
}

func TestDecodeJSON_RejectsChartBlockWithoutChartSpec(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "chartBlock" {
			delete(block, "chartSpec")
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "chartSpec")
}

func TestDecodeJSON_RejectsTrailingContent(t *testing.T) {
	data := append(loadReportSpecFixtureBytes(t, "capacity-direct-series-export-request-fixture.v1.json"), []byte("\n{}")...)

	_, err := DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), "trailing content after top-level object")
}

func loadReportSpecFixture(t *testing.T, filename string) *ReportSpec {
	t.Helper()
	spec, err := DecodeJSON(loadReportSpecFixtureBytes(t, filename))
	require.NoError(t, err)
	return spec
}

func loadReportSpecFixtureMap(t *testing.T, filename string) map[string]any {
	t.Helper()
	var value map[string]any
	require.NoError(t, json.Unmarshal(loadReportSpecFixtureBytes(t, filename), &value))
	return value
}

func loadReportSpecFixtureBytes(t *testing.T, filename string) []byte {
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

	var exportRequest struct {
		ReportSpec json.RawMessage `json:"reportSpec"`
	}
	require.NoError(t, json.Unmarshal(data, &exportRequest))
	return exportRequest.ReportSpec
}
