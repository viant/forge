package fenced

import (
	"bytes"
	"encoding/json"
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
		`{"version":1,"scope":"message","id":"demo","sequence":3,"mode":"append","blocks":[{"id":"spend","kind":"kpiBlock","datasetRef":"metrics","valueField":"spend","valueFormat":"currency","title":"Spend"},{"id":"detail","kind":"tableBlock","datasetRef":"metrics","title":"Delivery","columns":[{"key":"name","label":"Channel"},{"key":"spend","label":"Spend","format":"currency"}]},{"id":"finding","kind":"markdownBlock","title":"Finding","markdown":"**Display** led spend."}]}` +
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

func TestCompileProducesExportableMultiTabDashboard(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"delivery","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Order 2672373 delivery","blocks":[{"id":"tabs","kind":"tabGroupBlock","title":"Report sections","sectionIds":["posture","funnel"],"defaultSectionId":"posture"},{"id":"posture","kind":"sectionBlock","title":"Delivery posture","navigationLabel":"Delivery posture"},{"id":"spend","kind":"kpiBlock","datasetRef":"daily","valueField":"spend","valueFormat":"currency","title":"Spend"},{"id":"status","kind":"badgesBlock","datasetRef":"daily","title":"Status","items":[{"id":"pacing","label":"Pacing","value":"Behind","tone":"warning"}]},{"id":"trend","kind":"chartBlock","datasetRef":"daily","title":"Daily delivery","chartSpec":{"type":"line","xField":"date","yFields":["spend","impressions"]}},{"id":"funnel","kind":"sectionBlock","title":"Bid funnel","navigationLabel":"Bid funnel"},{"id":"funnel_table","kind":"tableBlock","datasetRef":"funnel","title":"Delivery funnel","columns":[{"key":"stage","label":"Stage"},{"key":"count","label":"Count","format":"integer","cellVisual":{"kind":"dataBar"}}]},{"id":"finding","kind":"markdownBlock","title":"Finding","markdown":"Spend is **behind plan**; allocated capacity was not exhausted."}]}` +
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
