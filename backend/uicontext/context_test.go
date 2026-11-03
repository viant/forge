package uicontext

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestSemanticContextHostRedactsMetadataSensitiveFilters(t *testing.T) {
	win := &Input{DataSourceRefs: []string{"rows"}, Metadata: map[string]interface{}{"view": map[string]interface{}{"controls": []interface{}{map[string]interface{}{"id": "opaqueControl", "dataSourceRef": "rows", "dataField": "opaque", "type": "password"}}}}, SemanticContext: map[string]interface{}{"version": 1, "revision": 3, "sources": []interface{}{map[string]interface{}{"dataSourceRef": "rows", "filters": map[string]interface{}{"opaque": "private", "api_key": "private", "allowed": "Visible"}, "changedFields": []interface{}{"opaque", "name"}, "selectedIds": []interface{}{7}, "form": map[string]interface{}{"password": "private"}}}}}
	state := Project(win)
	require.NotNil(t, state)
	require.Equal(t, map[string]interface{}{"allowed": "Visible"}, state.Sources[0].Filters)
	require.Equal(t, []string{"name"}, state.Sources[0].ChangedFields)
	raw, err := json.Marshal(state)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "private")
	win.SemanticContext["version"] = 2
	require.Nil(t, Project(win))
}

func TestSemanticContextRejectsUndeclaredSourcesAndCanonicalPasswordFields(t *testing.T) {
	win := &Input{DataSourceRefs: []string{"rows"}, Metadata: map[string]interface{}{"view": map[string]interface{}{"content": map[string]interface{}{"dataSourceRef": "rows", "items": []interface{}{map[string]interface{}{"id": "arbitrary", "dataField": "opaque", "type": "text", "properties": map[string]interface{}{"inputType": "password"}}}}}}, SemanticContext: map[string]interface{}{"version": 1, "sources": []interface{}{map[string]interface{}{"dataSourceRef": "rows", "filters": map[string]interface{}{"opaque": "private", "Name": "Visible"}}, map[string]interface{}{"dataSourceRef": "undeclared", "selectedIds": []interface{}{100}}}}}
	state := Project(win)
	require.Len(t, state.Sources, 1)
	require.Equal(t, map[string]interface{}{"Name": "Visible"}, state.Sources[0].Filters)
}

func TestSemanticReportMetadataBoundedCopiedAndRedacted(t *testing.T) {
	input := &Input{Metadata: map[string]interface{}{"view": map[string]interface{}{"controls": []interface{}{map[string]interface{}{"id": "opaque", "sensitive": true}}}}, SemanticContext: map[string]interface{}{"version": 1, "report": map[string]interface{}{"windowId": "summary-instance", "resourceUri": "report://example/summary", "status": "ready", "hasCompletedRun": true, "parameters": map[string]interface{}{"from": "2026-10-01", "opaque": "private", "password": "private"}, "draftParameters": map[string]interface{}{"from": "", "ids": []interface{}{}}, "reportFill": map[string]interface{}{"rows": []interface{}{map[string]interface{}{"private": "excluded"}}}}}}
	state := Project(input)
	raw, err := json.Marshal(state)
	require.NoError(t, err)
	var decoded map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &decoded))
	report, ok := decoded["report"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "summary-instance", report["windowId"])
	require.Equal(t, true, report["hasCompletedRun"])
	require.Equal(t, map[string]interface{}{"from": "2026-10-01"}, report["parameters"])
	require.Equal(t, false, report["parametersComplete"])
	require.Equal(t, map[string]interface{}{"from": "", "ids": []interface{}{}}, report["draftParameters"])
	require.NotContains(t, string(raw), "private")
	require.NotContains(t, string(raw), "reportFill")
	input.SemanticContext["report"].(map[string]interface{})["parameters"].(map[string]interface{})["from"] = "2026-10-02"
	after, _ := json.Marshal(state)
	require.Equal(t, string(raw), string(after))
}
