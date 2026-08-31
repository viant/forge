package forgeui

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/reporting/fenced"
)

func TestBuildFencesCompilesSharedForgeUI(t *testing.T) {
	ui := json.RawMessage(`{"containers":[{"id":"tabs","tabs":{},"containers":[{"id":"general","title":"General","containers":[{"id":"summary","kind":"dashboard.summary","dataSourceRef":"plan","metrics":[{"id":"budget","label":"Budget","selector":"budget","format":"currency"}]},{"id":"rows","title":"Rows","kind":"dashboard.editableTable","dataSourceRef":"rows","columns":[{"id":"id","name":"ID"},{"id":"name","name":"Name"}]}]}]}]}`)
	fences, err := BuildFences(Request{
		ReportID: "feed_catalog",
		Title:    "Catalog",
		UI:       ui,
		DataSources: map[string]json.RawMessage{
			"plan": json.RawMessage(`{"budget":250000}`),
			"rows": json.RawMessage(`[{"id":1,"name":"Alpha"}]`),
		},
	})
	require.NoError(t, err)
	compiled, err := fenced.Compile(&fenced.CompileRequest{Fences: fences, ReportID: "feed_catalog"})
	require.NoError(t, err)
	require.NotEmpty(t, compiled.ReportSpec)
	require.NotEmpty(t, compiled.ReportFill)
	require.NotEmpty(t, compiled.ReportPrint)
}
