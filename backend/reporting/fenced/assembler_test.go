package fenced

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	forgeexport "github.com/viant/forge/backend/reporting/export"
	forgepdf "github.com/viant/forge/backend/reporting/export/pdf"
)

func TestParseAndAssembleCommittedReport(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"demo","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Demo","blocks":[]}` +
		"\n```\n```forge-data\n" +
		`{"version":2,"scope":"message","id":"metrics","reportRef":"demo","sequence":2,"format":"json","mode":"replace","data":[{"spend":12.5}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"demo","sequence":3,"mode":"append","blocks":[{"id":"spend","kind":"kpiBlock","datasetRef":"metrics","valueKey":"spend","title":"Spend"}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"demo","sequence":4,"mode":"commit"}` +
		"\n```"

	fences, err := Parse(content)
	require.NoError(t, err)
	require.Len(t, fences, 4)

	result, err := Assemble(fences, "demo")
	require.NoError(t, err)
	require.NotNil(t, result.Assembly)
	require.Equal(t, "committed", result.Assembly.Status)
	require.Equal(t, "report-document-v1", result.Assembly.Grammar)
	require.JSONEq(t, `[{"spend":12.5}]`, string(result.Assembly.DataSources["metrics"]))
	require.Empty(t, result.Diagnostics)
}

func TestCompileProducesExportablePDFContract(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"demo","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Backend compiled report","blocks":[]}` +
		"\n```\n```forge-data\n" +
		`{"version":2,"scope":"message","id":"metrics","reportRef":"demo","sequence":2,"format":"json","mode":"replace","data":[{"name":"Display","spend":12.5},{"name":"CTV","spend":8.25}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"demo","sequence":3,"mode":"append","blocks":[{"id":"spend","kind":"kpiBlock","datasetRef":"metrics","valueField":"spend","valueFormat":"currency","title":"Spend"},{"id":"detail","kind":"tableBlock","datasetRef":"metrics","title":"Delivery","description":"Interactive detail","link":{"href":"detailUrl"},"columns":[{"key":"name","label":"Channel","type":"link","link":{"href":"detailUrl"}},{"key":"spend","label":"Spend","format":"currency"}]},{"id":"finding","kind":"markdownBlock","title":"Finding","markdown":"**Display** led spend."}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"demo","sequence":4,"mode":"commit"}` +
		"\n```"

	compiled, err := Compile(&CompileRequest{Content: content, ReportID: "demo"})
	require.NoError(t, err)
	require.NotEmpty(t, compiled.ReportSpec)
	require.NotEmpty(t, compiled.ReportFill)
	require.NotEmpty(t, compiled.ReportPrint)

	envelope, err := forgeexport.DecodeJSON(mustJSON(t, map[string]any{
		"version": 1,
		"kind":    "reportExportRequest",
		"target":  map[string]any{"format": "pdf"},
		"source": map[string]any{
			"from": "draft", "artifactKind": "dashboard.reportBuilder",
			"artifactRef": "dashboard.reportBuilder://demo", "title": "Backend compiled report", "reportId": "demo",
		},
		"reportSpec":  jsonRaw(compiled.ReportSpec),
		"reportFill":  jsonRaw(compiled.ReportFill),
		"reportPrint": jsonRaw(compiled.ReportPrint),
	}))
	require.NoError(t, err)
	rendered, err := forgepdf.Render(envelope.ReportPrintModel(), forgepdf.Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(rendered.Bytes, []byte("%PDF-")))
}

func TestCompileProducesExportableStaticReportWithoutDataFences(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"static-report","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Static diagnostic","blocks":[{"id":"summary","kind":"markdownBlock","title":"Summary","markdown":"Evidence is currently unavailable."},{"id":"posture","kind":"badgesBlock","title":"Diagnostic status","items":[{"id":"order","label":"Ad order","value":"2,664,518","tone":"info"},{"id":"diagnosis","label":"Diagnosis","value":"Unavailable","tone":"warning"},{"id":"confidence","label":"Confidence","value":"Insufficient evidence","tone":"danger"},{"id":"setup","label":"Setup state","value":"Not evaluated","tone":"neutral"}]},{"id":"next","kind":"calloutBlock","title":"Next step","tone":"info","body":"Validate the order state."}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"static-report","sequence":2,"mode":"commit"}` +
		"\n```"

	compiled, err := Compile(&CompileRequest{Content: content, ReportID: "static-report"})
	require.NoError(t, err)
	require.NotEmpty(t, compiled.ReportSpec)
	require.NotEmpty(t, compiled.ReportFill)

	var spec map[string]any
	require.NoError(t, json.Unmarshal(compiled.ReportSpec, &spec))
	datasets := spec["datasets"].([]any)
	require.Len(t, datasets, 1)
	require.Equal(t, "static-report", datasets[0].(map[string]any)["id"])
	request := datasets[0].(map[string]any)["request"].(map[string]any)
	require.Equal(t, []any{"_placeholder"}, request["columnKeys"])

	var printArtifact map[string]any
	require.NoError(t, json.Unmarshal(compiled.ReportPrint, &printArtifact))
	pageElements := printArtifact["pages"].([]any)[0].(map[string]any)["elements"].([]any)
	badges := map[string]map[string]any{}
	for _, rawElement := range pageElements {
		element := rawElement.(map[string]any)
		id, _ := element["id"].(string)
		if strings.HasPrefix(id, "posture__badge_") && !strings.Contains(id, "text") {
			badges[id] = element
		}
	}
	require.Len(t, badges, 4)
	firstBox := badges["posture__badge_0"]["box"].(map[string]any)
	secondBox := badges["posture__badge_1"]["box"].(map[string]any)
	thirdBox := badges["posture__badge_2"]["box"].(map[string]any)
	fourthBox := badges["posture__badge_3"]["box"].(map[string]any)
	require.Equal(t, firstBox["y"], secondBox["y"])
	require.Equal(t, thirdBox["y"], fourthBox["y"])
	require.Greater(t, thirdBox["y"].(float64), firstBox["y"].(float64))
	require.LessOrEqual(t, fourthBox["x"].(float64)+fourthBox["width"].(float64), 576.0)
	require.NotEqual(t, badges["posture__badge_0"]["fillColor"], badges["posture__badge_1"]["fillColor"])

	envelope, err := forgeexport.DecodeJSON(mustJSON(t, map[string]any{
		"version": 1,
		"kind":    "reportExportRequest",
		"target":  map[string]any{"format": "pdf"},
		"source": map[string]any{
			"from": "draft", "artifactKind": "dashboard.reportBuilder",
			"artifactRef": "dashboard.reportBuilder://static-report", "title": "Static diagnostic", "reportId": "static-report",
		},
		"reportSpec":  jsonRaw(compiled.ReportSpec),
		"reportFill":  jsonRaw(compiled.ReportFill),
		"reportPrint": jsonRaw(compiled.ReportPrint),
	}))
	require.NoError(t, err)
	rendered, err := forgepdf.Render(envelope.ReportPrintModel(), forgepdf.Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(rendered.Bytes, []byte("%PDF-")))
}

func TestCompileProducesExportableMultiTabDashboard(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"delivery","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Order 2672373 delivery","blocks":[{"id":"tabs","kind":"tabGroupBlock","title":"Report sections","sectionIds":["posture","funnel"],"defaultSectionId":"posture"},{"id":"posture","kind":"sectionBlock","title":"Delivery posture","navigationLabel":"Delivery posture"},{"id":"spend","kind":"kpiBlock","datasetRef":"daily","valueField":"spend","valueFormat":"currency","title":"Spend"},{"id":"status","kind":"badgesBlock","datasetRef":"daily","title":"Current posture","items":[{"id":"pacing","label":"Pacing","value":"Behind","tone":"warning"}]},{"id":"trend","kind":"chartBlock","datasetRef":"daily","title":"Daily delivery","chartSpec":{"type":"line","xField":"date","yFields":["spend","impressions"]}},{"id":"funnel","kind":"sectionBlock","title":"Bid funnel","navigationLabel":"Bid funnel"},{"id":"funnel_table","kind":"tableBlock","datasetRef":"funnel","title":"Delivery funnel","columns":[{"key":"stage","label":"Stage"},{"key":"count","label":"Count","format":"integer","cellVisual":{"kind":"dataBar"}}]},{"id":"finding","kind":"markdownBlock","title":"Finding","markdown":"Spend is **behind plan**; allocated capacity was not exhausted."}]}` +
		"\n```\n```forge-data\n" +
		`{"version":2,"scope":"message","id":"daily","reportRef":"delivery","sequence":2,"format":"json","mode":"replace","data":[{"date":"2026-07-25","spend":1100.64,"impressions":27678},{"date":"2026-07-26","spend":980.25,"impressions":24120}]}` +
		"\n```\n```forge-data\n" +
		`{"version":2,"scope":"message","id":"funnel","reportRef":"delivery","sequence":3,"format":"json","mode":"replace","data":[{"stage":"Allocated opportunities","count":62276080},{"stage":"Submitted bids","count":297356},{"stage":"Impressions","count":27678}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"delivery","sequence":4,"mode":"commit"}` +
		"\n```"

	compiled, err := Compile(&CompileRequest{Content: content, ReportID: "delivery"})
	require.NoError(t, err)
	require.Empty(t, compiled.Diagnostics)
	printJSON := string(mustJSON(t, compiled.ReportPrint))
	require.Contains(t, printJSON, "#fff7e1")
	require.Contains(t, printJSON, "#f5d28c")
	require.Contains(t, printJSON, "Pacing: Behind")

	envelope, err := forgeexport.DecodeJSON(mustJSON(t, map[string]any{
		"version": 1,
		"kind":    "reportExportRequest",
		"target":  map[string]any{"format": "pdf"},
		"source": map[string]any{
			"from": "draft", "artifactKind": "dashboard.reportBuilder",
			"artifactRef": "dashboard.reportBuilder://delivery", "title": "Order 2672373 delivery", "reportId": "delivery",
		},
		"reportSpec":  jsonRaw(compiled.ReportSpec),
		"reportFill":  jsonRaw(compiled.ReportFill),
		"reportPrint": jsonRaw(compiled.ReportPrint),
	}))
	require.NoError(t, err)
	rendered, err := forgepdf.Render(envelope.ReportPrintModel(), forgepdf.Options{})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(rendered.Bytes, []byte("%PDF-")))
	require.Greater(t, len(rendered.Bytes), 1000)
}

func TestCompileProducesInfoPanelAndCalloutFill(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"panels","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Panels","blocks":[{"id":"context","kind":"infoPanelBlock","title":"Context","eyebrow":"Read first","tone":"info","body":"Capacity detail"},{"id":"action","kind":"calloutBlock","title":"Action","icon":"warning","tone":"warning","badges":["Validated"],"body":"Restore pacing"}]}` +
		"\n```\n```forge-data\n" +
		`{"version":2,"scope":"message","id":"rows","reportRef":"panels","sequence":2,"format":"json","mode":"replace","data":[{"status":"ready"}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"panels","sequence":3,"mode":"commit"}` +
		"\n```"

	compiled, err := Compile(&CompileRequest{Content: content, ReportID: "panels"})
	require.NoError(t, err)
	require.NotEmpty(t, compiled.ReportFill)
}

func TestCompilePrintGroupsKPIsAndFormatsCounts(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"kpis","sequence":1,"mode":"start","grammar":"report-document-v1","title":"KPI report","blocks":[{"id":"spend","kind":"kpiBlock","datasetRef":"metrics","valueField":"spend","valueFormat":"currency","title":"Spend"},{"id":"bids","kind":"kpiBlock","datasetRef":"metrics","valueField":"bids","valueFormat":"compact","title":"Bids"},{"id":"impressions","kind":"kpiBlock","datasetRef":"metrics","valueField":"impressions","valueFormat":"compact","title":"Impressions"},{"id":"detail","kind":"tableBlock","datasetRef":"metrics","title":"Delivery","columns":[{"key":"bids","label":"Submitted bids","format":"integer"},{"key":"impressions","label":"Impressions","format":"integer"}]}]}` +
		"\n```\n```forge-data\n" +
		`{"version":2,"scope":"message","id":"metrics","reportRef":"kpis","sequence":2,"format":"json","mode":"replace","data":[{"spend":9292.606,"bids":6226971,"impressions":903913}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"kpis","sequence":3,"mode":"commit"}` +
		"\n```"

	compiled, err := Compile(&CompileRequest{Content: content, ReportID: "kpis"})
	require.NoError(t, err)

	var printArtifact map[string]any
	require.NoError(t, json.Unmarshal(compiled.ReportPrint, &printArtifact))
	pages := printArtifact["pages"].([]any)
	elements := pages[0].(map[string]any)["elements"].([]any)
	byID := map[string]map[string]any{}
	for _, item := range elements {
		element := item.(map[string]any)
		byID[element["id"].(string)] = element
	}
	require.Equal(t, "$9,292.61", byID["spend__value"]["text"])
	require.Equal(t, "6.23M", byID["bids__value"]["text"])
	require.Equal(t, "904K", byID["impressions__value"]["text"])
	require.Equal(t, byID["spend__card"]["box"].(map[string]any)["y"], byID["bids__card"]["box"].(map[string]any)["y"])
	require.NotEqual(t, byID["spend__card"]["box"].(map[string]any)["x"], byID["bids__card"]["box"].(map[string]any)["x"])
	require.Equal(t, "6,226,971", byID["detail__r0_bids"]["text"])
}

func TestCompilePreservesAuthoredGridSpans(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"layout","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Layout report","blocks":[{"id":"spend","kind":"kpiBlock","datasetRef":"metrics","valueField":"spend","title":"Spend"},{"id":"detail","kind":"tableBlock","datasetRef":"metrics","title":"Delivery","columns":[{"key":"spend","label":"Spend"}]}]}` +
		"\n```\n```forge-data\n" +
		`{"version":2,"scope":"message","id":"metrics","reportRef":"layout","sequence":2,"format":"json","mode":"replace","data":[{"spend":10}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"layout","sequence":3,"mode":"patch","layout":{"type":"grid","columns":12,"items":[{"blockId":"spend","x":0,"y":0,"w":3,"h":2},{"blockId":"detail","x":0,"y":2,"w":12,"h":4}]}}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"layout","sequence":4,"mode":"commit"}` +
		"\n```"

	compiled, err := Compile(&CompileRequest{Content: content, ReportID: "layout"})
	require.NoError(t, err)

	var spec map[string]any
	require.NoError(t, json.Unmarshal(compiled.ReportSpec, &spec))
	layout := spec["layoutIntent"].(map[string]any)
	items := layout["items"].([]any)
	require.Equal(t, "quarter", items[0].(map[string]any)["size"])
	require.Equal(t, "full", items[1].(map[string]any)["size"])
}

func TestFitTableTextPreventsCellOverflow(t *testing.T) {
	require.Equal(t, "short", fitTableText("short", 100, 9))
	require.Equal(t, "a very lon…", fitTableText("a very long operational interpretation", 54, 9))
}

func TestTextElementUsesMissingValueMarkerForBlankText(t *testing.T) {
	element := textElement("blank-cell", 0, 0, 100, 20, "  ", 10, "")
	require.Equal(t, "—", element["text"])
}

func TestFormatValueDoesNotAddMeaninglessDecimalZeros(t *testing.T) {
	require.Equal(t, "1", formatValue(float64(1), "number"))
	require.Equal(t, "0.684", formatValue(0.684, "number"))
	require.Equal(t, "6,226,971", formatValue(float64(6226971), "integer"))
	require.Equal(t, "6.23M", formatValue(float64(6226971), "compact"))
}

type jsonRaw []byte

func (j jsonRaw) MarshalJSON() ([]byte, error) { return j, nil }

func mustJSON(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	require.NoError(t, err)
	return raw
}

func TestAssembleRejectsSequenceGap(t *testing.T) {
	fences := []Fence{
		{Kind: ReportFence, Payload: []byte(`{"version":1,"id":"demo","sequence":1,"mode":"start","grammar":"report-document-v1","blocks":[]}`)},
		{Kind: ReportFence, Payload: []byte(`{"version":1,"id":"demo","sequence":3,"mode":"commit"}`)},
	}
	result, err := Assemble(fences, "demo")
	require.NoError(t, err)
	require.Equal(t, "incomplete", result.Assembly.Status)
	require.NotEmpty(t, result.Diagnostics)
}

func TestAssembleRejectsTabSectionMissingFromExplicitLayout(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"tabs","sequence":1,"mode":"start","grammar":"report-document-v1","blocks":[{"id":"tabs_block","kind":"tabGroupBlock","sectionIds":["overview"]},{"id":"overview","kind":"sectionBlock","title":"Overview"},{"id":"finding","kind":"markdownBlock","title":"Finding","markdown":"Useful content."}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"tabs","sequence":2,"mode":"patch","layout":{"type":"grid","columns":12,"items":[{"blockId":"tabs_block"},{"blockId":"finding"}]}}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"tabs","sequence":3,"mode":"commit"}` +
		"\n```"

	fences, err := Parse(content)
	require.NoError(t, err)
	result, err := Assemble(fences, "tabs")
	require.NoError(t, err)
	require.NotEqual(t, "committed", result.Assembly.Status)
	messages := make([]string, 0, len(result.Diagnostics))
	for _, diagnostic := range result.Diagnostics {
		messages = append(messages, diagnostic.Message)
	}
	require.Contains(t, strings.Join(messages, "\n"), `section "overview" must appear in layout.items`)
}

func TestAssembleAcceptsDataBeforeStartAndPatchesBlocks(t *testing.T) {
	content := "```forge-data\n" +
		`{"version":2,"id":"rows","reportRef":"demo","sequence":1,"format":"json","mode":"replace","data":[{"spend":12.5}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"id":"demo","sequence":2,"mode":"start","grammar":"report-document-v1","title":"Draft","blocks":[{"id":"summary","kind":"markdownBlock","title":"Old","markdown":"Before"}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"id":"demo","sequence":3,"mode":"patch","title":"Final","blocks":[{"id":"summary","title":"Finding","markdown":"After"}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"id":"demo","sequence":4,"mode":"commit"}` +
		"\n```"

	result, err := Compile(&CompileRequest{Content: content, ReportID: "demo"})
	require.NoError(t, err)
	require.Equal(t, "committed", result.Assembly.Status)
	require.Equal(t, "Final", textValue(result.Assembly.Source["title"]))
	block := findReportBlock(result.Assembly.Source["blocks"], "summary")
	require.Equal(t, "Finding", textValue(block["title"]))
	require.Equal(t, "After", textValue(block["markdown"]))
}
