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
