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

func TestDecodeJSON_PreservesBlockRuntimeContract(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	blocks := fixture["blocks"].([]any)
	first := blocks[0].(map[string]any)
	first["runtime"] = map[string]any{
		"visibleWhen":    map[string]any{"source": "selection", "selector": "entityKey", "notEmpty": true},
		"filterBindings": map[string]any{"region": "region"},
	}
	data, err := json.Marshal(fixture)
	require.NoError(t, err)
	spec, err := DecodeJSON(data)
	require.NoError(t, err)
	require.Equal(t, "region", spec.Blocks[0].Runtime["filterBindings"].(map[string]any)["region"])
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

func TestDecodeJSON_BadgesBlock(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	blocks := fixture["blocks"].([]any)
	fixture["blocks"] = append(blocks, map[string]any{
		"id":         "currentSignals",
		"kind":       "badgesBlock",
		"title":      "Current Signals",
		"datasetRef": "primary",
		"items": []any{
			map[string]any{"id": "channel", "label": "Top channel", "valueField": "channelId"},
			map[string]any{"id": "spend", "label": "Spend", "valueField": "totalSpend", "format": "currency"},
		},
	})

	data, err := json.Marshal(fixture)
	require.NoError(t, err)
	spec, err := DecodeJSON(data)
	require.NoError(t, err)

	badges := spec.Blocks[len(spec.Blocks)-1]
	require.Equal(t, "badgesBlock", badges.Kind)
	require.Equal(t, "primary", badges.DatasetRef)
	require.Len(t, badges.Items, 2)
	require.Equal(t, "channelId", badges.Items[0].ValueField)
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
	fixture["theme"] = map[string]any{
		"accentTone":   "green",
		"badgePalette": "bold",
	}
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

func TestDecodeJSON_AcceptsExtendedDashboardBlocks(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	fixture["theme"] = map[string]any{
		"accentTone":   "green",
		"badgePalette": "bold",
	}
	blocks := fixture["blocks"].([]any)
	blocks = append(blocks,
		map[string]any{
			"id":              "overviewSection",
			"kind":            "sectionBlock",
			"title":           "Overview",
			"subtitle":        "Supply outlook",
			"description":     "Starts with the high-level executive view.",
			"navigationLabel": "Overview",
		},
		map[string]any{
			"id":            "summaryPanel",
			"kind":          "compositeBlock",
			"title":         "Summary panel",
			"description":   "Groups the opening narrative and KPI.",
			"childBlockIds": []any{"narrativeIntro", "headlineKpi"},
		},
		map[string]any{
			"id":               "sectionTabs",
			"kind":             "tabGroupBlock",
			"title":            "Forecast views",
			"sectionIds":       []any{"overviewSection"},
			"defaultSectionId": "overviewSection",
		},
		map[string]any{
			"id":          "integrationFlow",
			"kind":        "stepperBlock",
			"title":       "Direct Integration Path",
			"description": "Three stages to define a direct path.",
			"steps": []any{
				map[string]any{"id": "step_1", "title": "Bid directly", "body": "Connect bidding directly to the publisher ad server."},
			},
		},
		map[string]any{
			"id":          "directIntro",
			"kind":        "infoPanelBlock",
			"title":       "What is a Direct Integration Path?",
			"eyebrow":     "What is it?",
			"description": "Explains the direct path concept.",
			"tone":        "info",
			"bodyFormat":  "markdown",
			"body":        "A direct integration connects bidding directly into the publisher ad server.",
		},
		map[string]any{
			"id":          "launchCallout",
			"kind":        "calloutBlock",
			"title":       "Launch update",
			"icon":        "warning-sign",
			"description": "Important rollout note.",
			"tone":        "warning",
			"badges":      []any{"Executive", "Launch Ready"},
			"bodyFormat":  "markdown",
			"body":        "Publisher activation is staged for Friday.",
		},
		map[string]any{
			"id":             "topChannels",
			"kind":           "collectionBlock",
			"title":          "Top Channels",
			"datasetRef":     "primary",
			"itemTitleField": "channelV2",
			"itemTitleLabel": "Channel",
			"valueField":     "avails",
			"valueLabel":     "Avails",
			"layout":         "grid",
			"columns":        2,
			"rowLimit":       2,
		},
		map[string]any{
			"id":          "publisherPipeline",
			"kind":        "kanbanBlock",
			"title":       "Publisher Pipeline",
			"description": "Track publisher activations by stage.",
			"columns": []any{
				map[string]any{
					"id":    "signed",
					"title": "Signed",
					"cards": []any{
						map[string]any{"id": "tubi", "title": "Tubi", "body": "SpringServe integration live.", "badge": "Live"},
					},
				},
			},
		},
		map[string]any{
			"id":          "integrationTimeline",
			"kind":        "timelineBlock",
			"title":       "Integration Timeline",
			"description": "Track the rollout milestones.",
			"events": []any{
				map[string]any{"id": "event_1", "date": "2026-07-15", "badge": "Target", "title": "Roku signed", "body": "Expected signature date."},
			},
		},
	)
	fixture["blocks"] = blocks

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	spec, err := DecodeJSON(data)
	require.NoError(t, err)
	require.True(t, len(spec.Blocks) >= 15)
	require.Equal(t, "sectionBlock", spec.Blocks[6].Kind)
	require.Equal(t, "compositeBlock", spec.Blocks[7].Kind)
	require.Equal(t, "tabGroupBlock", spec.Blocks[8].Kind)
	require.Equal(t, "stepperBlock", spec.Blocks[9].Kind)
	require.Equal(t, "infoPanelBlock", spec.Blocks[10].Kind)
	require.Equal(t, "calloutBlock", spec.Blocks[11].Kind)
	require.Equal(t, "collectionBlock", spec.Blocks[12].Kind)
	require.Equal(t, "kanbanBlock", spec.Blocks[13].Kind)
	require.Equal(t, "timelineBlock", spec.Blocks[14].Kind)
	require.Equal(t, "Overview", spec.Blocks[6].NavigationLabel)
	require.Equal(t, []string{"narrativeIntro", "headlineKpi"}, spec.Blocks[7].ChildBlockIDs)
	require.Equal(t, []string{"overviewSection"}, spec.Blocks[8].SectionIDs)
	require.Equal(t, "overviewSection", spec.Blocks[8].DefaultSectionID)
	require.Equal(t, "warning-sign", spec.Blocks[11].Icon)
	require.Equal(t, []string{"Executive", "Launch Ready"}, spec.Blocks[11].Badges)
	require.Equal(t, "green", spec.Theme["accentTone"])
	require.Equal(t, "bold", spec.Theme["badgePalette"])
	require.Equal(t, 2, *spec.Blocks[12].RowLimit)
	require.Equal(t, 2, spec.Blocks[12].CollectionCols)
	require.Len(t, spec.Blocks[13].ColumnsLayout, 1)
	require.Len(t, spec.Blocks[14].Events, 1)
}

func TestDecodeJSON_AcceptsHybridKPIBlockFields(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] != "kpiBlock" {
			continue
		}
		block["valueFormat"] = "compact"
		block["secondaryField"] = "channelV2"
		block["secondaryLabel"] = "Channel"
		block["secondaryFormat"] = "compactNumber"
		block["secondaryDisplayKey"] = "channelLabel"
		block["secondaryDisplayValueMap"] = map[string]any{
			"ctv": "CTV",
		}
		block["rowSelector"] = "maxbyvalue"
		block["presentationMode"] = "both"
		block["bodyFormat"] = "markdown"
		block["bodyTemplate"] = "### Leading inventory\n**${valueLabel}:** ${value}"
		break
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	spec, err := DecodeJSON(data)
	require.NoError(t, err)

	var kpi Block
	found := false
	for _, block := range spec.Blocks {
		if block.Kind == "kpiBlock" {
			kpi = block
			found = true
			break
		}
	}
	require.True(t, found)
	require.Equal(t, "compact", kpi.ValueFormat)
	require.Equal(t, "compactNumber", kpi.SecondaryFormat)
	require.Equal(t, "channelLabel", kpi.SecondaryDisplayKey)
	require.Equal(t, map[string]any{"ctv": "CTV"}, kpi.SecondaryDisplayValueMap)
	require.Equal(t, "maxbyvalue", kpi.RowSelector)
	require.Equal(t, "both", kpi.PresentationMode)
	require.Equal(t, "markdown", kpi.BodyFormat)
	require.Equal(t, "### Leading inventory\n**${valueLabel}:** ${value}", kpi.BodyTemplate)
}

func TestDecodeJSON_RejectsUnsupportedKPIPresentationMode(t *testing.T) {
	fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] == "kpiBlock" {
			block["presentationMode"] = "floating"
			break
		}
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), `presentationMode "floating" is not supported for kpiBlock`)
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
