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

func TestDecodeJSON_ReportFillPreservesBlockRuntimeContract(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	blocks := fixture["blocks"].([]any)
	first := blocks[0].(map[string]any)
	first["runtime"] = map[string]any{
		"selectionBindings": map[string]any{"entityKey": "market"},
	}
	syncReportFillFixtureProvenance(fixture)
	data, err := json.Marshal(fixture)
	require.NoError(t, err)
	fill, err := DecodeJSON(data)
	require.NoError(t, err)
	require.Equal(t, "market", fill.Blocks[0].Runtime["selectionBindings"].(map[string]any)["entityKey"])
}

func TestDecodeJSON_ReportFillBadgesBlock(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	blocks := fixture["blocks"].([]any)
	fixture["blocks"] = append(blocks, map[string]any{
		"id":         "currentSignals",
		"kind":       "badgesBlock",
		"title":      "Current Signals",
		"datasetRef": "primary",
		"items": []any{
			map[string]any{"id": "channel", "label": "Top channel", "valueField": "channelId"},
		},
		"content": map[string]any{
			"title":    "Current Signals",
			"rowCount": 1,
			"items": []any{
				map[string]any{"id": "channel", "label": "Top channel", "valueField": "channelId", "value": "CTV", "displayValue": "Connected TV", "tone": "success"},
			},
		},
	})
	syncReportFillFixtureProvenance(fixture)

	data, err := json.Marshal(fixture)
	require.NoError(t, err)
	fill, err := DecodeJSON(data)
	require.NoError(t, err)

	badges := fill.Blocks[len(fill.Blocks)-1]
	require.Equal(t, "badgesBlock", badges.Kind)
	require.Len(t, badges.Items, 1)
	require.NotNil(t, badges.BadgesContent)
	require.Equal(t, "Connected TV", badges.BadgesContent.Items[0].DisplayValue)
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

func TestDecodeJSON_ReportFillFixtureWithExtendedDashboardBlocks(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	blocks = append(blocks,
		map[string]any{
			"id":    "overviewSection",
			"kind":  "sectionBlock",
			"title": "Overview",
			"content": map[string]any{
				"title":           "Overview",
				"subtitle":        "Supply outlook",
				"description":     "Starts with the high-level executive view.",
				"navigationLabel": "Overview",
			},
		},
		map[string]any{
			"id":            "summaryPanel",
			"kind":          "compositeBlock",
			"title":         "Summary panel",
			"description":   "Groups the opening narrative and KPI.",
			"childBlockIds": []any{"directIntro", "integrationFlow"},
			"content": map[string]any{
				"title":         "Summary panel",
				"description":   "Groups the opening narrative and KPI.",
				"childBlockIds": []any{"directIntro", "integrationFlow"},
			},
		},
		map[string]any{
			"id":               "sectionTabs",
			"kind":             "tabGroupBlock",
			"title":            "Forecast views",
			"sectionIds":       []any{"overviewSection"},
			"defaultSectionId": "overviewSection",
			"content": map[string]any{
				"title":            "Forecast views",
				"sectionIds":       []any{"overviewSection"},
				"defaultSectionId": "overviewSection",
				"tabs": []any{
					map[string]any{"id": "overviewSection", "title": "Overview", "navigationLabel": "Overview"},
				},
			},
		},
		map[string]any{
			"id":    "integrationFlow",
			"kind":  "stepperBlock",
			"title": "Direct Integration Path",
			"content": map[string]any{
				"title":       "Direct Integration Path",
				"description": "Three stages to define a direct path.",
				"steps": []any{
					map[string]any{"id": "step_1", "title": "Bid directly", "body": "Connect bidding directly to the publisher ad server."},
				},
			},
		},
		map[string]any{
			"id":    "directIntro",
			"kind":  "infoPanelBlock",
			"title": "What is a Direct Integration Path?",
			"content": map[string]any{
				"title":       "What is a Direct Integration Path?",
				"eyebrow":     "What is it?",
				"description": "Explains the direct path concept.",
				"tone":        "info",
				"bodyFormat":  "markdown",
				"body":        "A direct integration connects bidding directly into the publisher ad server.",
			},
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
			"content": map[string]any{
				"title":       "Launch update",
				"icon":        "warning-sign",
				"description": "Important rollout note.",
				"tone":        "warning",
				"badges":      []any{"Executive", "Launch Ready"},
				"bodyFormat":  "markdown",
				"body":        "Publisher activation is staged for Friday.",
			},
		},
		map[string]any{
			"id":             "topChannels",
			"kind":           "collectionBlock",
			"title":          "Top Channels",
			"datasetRef":     "primary",
			"itemTitleField": "channelV2",
			"valueField":     "avails",
			"valueLabel":     "Avails",
			"layout":         "grid",
			"rowLimit":       2,
			"content": map[string]any{
				"title":    "Top Channels",
				"layout":   "grid",
				"columns":  2,
				"rowCount": 2,
				"rowLimit": 2,
				"items": []any{
					map[string]any{"title": "Display", "valueField": "avails", "valueLabel": "Avails", "value": 1200000},
				},
			},
		},
		map[string]any{
			"id":    "publisherPipeline",
			"kind":  "kanbanBlock",
			"title": "Publisher Pipeline",
			"content": map[string]any{
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
		},
		map[string]any{
			"id":    "integrationTimeline",
			"kind":  "timelineBlock",
			"title": "Integration Timeline",
			"content": map[string]any{
				"title":       "Integration Timeline",
				"description": "Track the rollout milestones.",
				"events": []any{
					map[string]any{"id": "event_1", "date": "2026-07-15", "badge": "Target", "title": "Roku signed", "body": "Expected signature date."},
				},
			},
		},
	)
	fixture["blocks"] = blocks

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	report, err := DecodeJSON(data)
	require.NoError(t, err)
	var foundSection, foundComposite, foundTabGroup, foundStepper, foundInfo, foundCallout, foundCollection, foundKanban, foundTimeline bool
	for _, block := range report.Blocks {
		switch block.Kind {
		case "sectionBlock":
			foundSection = true
			require.NotNil(t, block.SectionContent)
			require.Equal(t, "Overview", block.SectionContent.NavigationLabel)
		case "compositeBlock":
			foundComposite = true
			require.NotNil(t, block.CompositeContent)
			require.Equal(t, []string{"directIntro", "integrationFlow"}, block.ChildBlockIDs)
			require.Equal(t, []string{"directIntro", "integrationFlow"}, block.CompositeContent.ChildBlockIDs)
		case "tabGroupBlock":
			foundTabGroup = true
			require.NotNil(t, block.TabGroupContent)
			require.Equal(t, []string{"overviewSection"}, block.SectionIDs)
			require.Equal(t, "overviewSection", block.DefaultSectionID)
			require.Len(t, block.TabGroupContent.Tabs, 1)
		case "stepperBlock":
			foundStepper = true
			require.NotNil(t, block.StepperContent)
			require.Len(t, block.StepperContent.Steps, 1)
		case "infoPanelBlock":
			foundInfo = true
			require.NotNil(t, block.InfoPanelContent)
			require.Equal(t, "info", block.InfoPanelContent.Tone)
		case "calloutBlock":
			foundCallout = true
			require.NotNil(t, block.CalloutContent)
			require.Equal(t, "warning-sign", block.CalloutContent.Icon)
			require.Equal(t, []string{"Executive", "Launch Ready"}, block.CalloutContent.Badges)
		case "collectionBlock":
			foundCollection = true
			require.NotNil(t, block.CollectionContent)
			require.Equal(t, 2, block.CollectionContent.Columns)
		case "kanbanBlock":
			foundKanban = true
			require.NotNil(t, block.KanbanContent)
			require.Len(t, block.KanbanContent.Columns, 1)
		case "timelineBlock":
			foundTimeline = true
			require.NotNil(t, block.TimelineContent)
			require.Len(t, block.TimelineContent.Events, 1)
		}
	}
	require.True(t, foundSection)
	require.True(t, foundComposite)
	require.True(t, foundTabGroup)
	require.True(t, foundStepper)
	require.True(t, foundInfo)
	require.True(t, foundCallout)
	require.True(t, foundCollection)
	require.True(t, foundKanban)
	require.True(t, foundTimeline)
}

func TestDecodeJSON_ReportFillAcceptsHybridKPIBlockFields(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
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
			"CTV": "Connected TV",
		}
		block["rowSelector"] = "maxbyvalue"
		block["presentationMode"] = "both"
		block["bodyFormat"] = "markdown"
		block["bodyTemplate"] = "### Leading inventory\n**${valueLabel}:** ${value}"
		content := block["content"].(map[string]any)
		content["valueFormat"] = "compact"
		content["secondaryField"] = "channelV2"
		content["secondaryLabel"] = "Channel"
		content["secondaryFormat"] = "compactNumber"
		content["secondaryDisplayKey"] = "channelLabel"
		content["secondaryDisplayValueMap"] = map[string]any{
			"CTV": "Connected TV",
		}
		content["secondaryValue"] = "Connected TV"
		content["rowSelector"] = "maxbyvalue"
		content["presentationMode"] = "both"
		content["bodyFormat"] = "markdown"
		content["bodyTemplate"] = "### Leading inventory\n**${valueLabel}:** ${value}"
		content["bodyMarkdown"] = "### Leading inventory\n**Avails:** 82.8K"
		break
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	report, err := DecodeJSON(data)
	require.NoError(t, err)

	var kpi Block
	found := false
	for _, block := range report.Blocks {
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
	require.Equal(t, map[string]any{"CTV": "Connected TV"}, kpi.SecondaryDisplayValueMap)
	require.Equal(t, "maxbyvalue", kpi.RowSelector)
	require.Equal(t, "both", kpi.PresentationMode)
	require.Equal(t, "markdown", kpi.BodyFormat)
	require.Equal(t, "### Leading inventory\n**${valueLabel}:** ${value}", kpi.BodyTemplate)
	require.NotNil(t, kpi.KPIContent)
	require.Equal(t, "compact", kpi.KPIContent.ValueFormat)
	require.Equal(t, "compactNumber", kpi.KPIContent.SecondaryFormat)
	require.Equal(t, "channelLabel", kpi.KPIContent.SecondaryDisplayKey)
	require.Equal(t, map[string]any{"CTV": "Connected TV"}, kpi.KPIContent.SecondaryDisplayValueMap)
	require.Equal(t, "maxbyvalue", kpi.KPIContent.RowSelector)
	require.Equal(t, "both", kpi.KPIContent.PresentationMode)
	require.Equal(t, "markdown", kpi.KPIContent.BodyFormat)
	require.Equal(t, "### Leading inventory\n**${valueLabel}:** ${value}", kpi.KPIContent.BodyTemplate)
	require.Equal(t, "### Leading inventory\n**Avails:** 82.8K", kpi.KPIContent.BodyMarkdown)
}

func TestDecodeJSON_ReportFillRejectsUnsupportedKPIPresentationMode(t *testing.T) {
	fixture := loadReportFillFromExportRequestFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
	syncReportFillFixtureProvenance(fixture)
	blocks := fixture["blocks"].([]any)
	for _, blockValue := range blocks {
		block := blockValue.(map[string]any)
		if block["kind"] != "kpiBlock" {
			continue
		}
		block["presentationMode"] = "floating"
		content := block["content"].(map[string]any)
		content["presentationMode"] = "floating"
		break
	}

	data, err := json.Marshal(fixture)
	require.NoError(t, err)

	_, err = DecodeJSON(data)
	require.Error(t, err)
	require.Contains(t, err.Error(), `presentationMode "floating" is not supported for kpiBlock`)
}

func TestDecodeJSON_ReportFillAcceptsRichFilterBarParams(t *testing.T) {
	report, err := DecodeJSON([]byte(`{
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
					{
						"id":"dateRange",
						"label":"Date Range",
						"type":"dateRange",
						"required":true,
						"presentation":"inlineToolbar",
						"value":{"start":"2026-07-06","end":"2026-07-08"}
					},
					{
						"id":"channelIds",
						"label":"Channels",
						"type":"multiSelect",
						"required":false,
						"multiple":true,
						"presentation":"compactIconRow",
						"options":[
							{"label":"Display","value":1,"icon":"media"},
							{"label":"CTV","value":6,"icon":"video"}
						],
						"value":[]
					}
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
	require.Len(t, report.Blocks, 2)
	require.NotNil(t, report.Blocks[0].FilterBarContent)
	require.Len(t, report.Blocks[0].FilterBarContent.Params, 2)
	require.Equal(t, "inlineToolbar", report.Blocks[0].FilterBarContent.Params[0].Presentation)
	require.NotNil(t, report.Blocks[0].FilterBarContent.Params[0].Required)
	require.True(t, *report.Blocks[0].FilterBarContent.Params[0].Required)
	require.NotNil(t, report.Blocks[0].FilterBarContent.Params[1].Multiple)
	require.True(t, *report.Blocks[0].FilterBarContent.Params[1].Multiple)
	require.Len(t, report.Blocks[0].FilterBarContent.Params[1].Options, 2)
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
	geoBlockIndex := findFixtureBlockIndexByKind(t, fixture, "geoMapBlock")
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
	require.Contains(t, err.Error(), fmt.Sprintf("reportFill.blocks[%d].content.geo is required for geoMapBlock", geoBlockIndex))
}

func TestDecodeJSON_ReportFillRejectsGeoBlockWithoutResolvedGeoPayload(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	geoBlockIndex := findFixtureBlockIndexByKind(t, fixture, "geoMapBlock")
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
	require.Contains(t, err.Error(), fmt.Sprintf("reportFill.blocks[%d].content.resolvedGeo is required for geoMapBlock", geoBlockIndex))
}

func TestDecodeJSON_ReportFillRejectsGeoBlockWithoutResolvedGeoLabelField(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	geoBlockIndex := findFixtureBlockIndexByKind(t, fixture, "geoMapBlock")
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
	require.Contains(t, err.Error(), fmt.Sprintf("reportFill.blocks[%d].content.resolvedGeo.labelField is required for geoMapBlock", geoBlockIndex))
}

func TestDecodeJSON_ReportFillRejectsGeoBlockWithoutRegionLabel(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	geoBlockIndex := findFixtureBlockIndexByKind(t, fixture, "geoMapBlock")
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
	require.Contains(t, err.Error(), fmt.Sprintf("reportFill.blocks[%d].content.resolvedGeo.regions[0].label is required for geoMapBlock", geoBlockIndex))
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
	geoBlockIndex := findFixtureBlockIndexByKind(t, fixture, "geoMapBlock")
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
	require.Contains(t, err.Error(), fmt.Sprintf("reportFill.blocks[%d].content.resolvedGeo.legend must use either rules or range for geoMapBlock", geoBlockIndex))
}

func TestDecodeJSON_ReportFillRejectsGeoBlockLegendRangeWithoutMax(t *testing.T) {
	fixture := loadReportFillFromPerformanceFixtureMap(t, "geo")
	syncReportFillFixtureProvenance(fixture)
	geoBlockIndex := findFixtureBlockIndexByKind(t, fixture, "geoMapBlock")
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
	require.Contains(t, err.Error(), fmt.Sprintf("reportFill.blocks[%d].content.resolvedGeo.legend.max is required for range geoMapBlock legend", geoBlockIndex))
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

func findFixtureBlockIndexByKind(t *testing.T, fixture map[string]any, kind string) int {
	t.Helper()
	blocks, ok := fixture["blocks"].([]any)
	require.True(t, ok)
	for index, blockValue := range blocks {
		block, ok := blockValue.(map[string]any)
		require.True(t, ok)
		if block["kind"] == kind {
			return index
		}
	}
	t.Fatalf("expected to find %s block", kind)
	return -1
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
