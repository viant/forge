package pdf

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/reporting/materializer"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func TestKPIDatePDFKeepsCalendarDisplayAndRawSource(t *testing.T) {
	spec := json.RawMessage(`{"version":1,"kind":"reportSpec","title":"Calendar specimen","source":{"kind":"report","containerId":"calendar","stateKey":"calendar","dataSourceRef":"observations"},"parameters":{"viewMode":"table","pageSize":25,"orderDir":"asc","orderField":"","groupBy":""},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"observations","request":{"limit":1,"offset":0}}],"layoutIntent":{"kind":"single","resultPanePosition":"bottom","blockOrder":["period"]},"blocks":[{"id":"period","kind":"kpiBlock","title":"Observation period","datasetRef":"primary","valueField":"start","valueLabel":"Start","valueFormat":"date","secondaryField":"end","secondaryLabel":"End","secondaryFormat":"date"}]}`)
	artifacts, err := materializer.Materialize(t.Context(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"start":"2040-02-29T00:00:00Z","end":"2040-03-01"}]}`)})
	require.NoError(t, err)
	require.Contains(t, string(artifacts.ReportFill), "2040-02-29T00:00:00Z")
	require.Contains(t, string(artifacts.ReportFill), "2040-03-01")
	document, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	rendered, err := Render(document, Options{})
	require.NoError(t, err)
	pages, text := extractPDFPlainText(t, rendered.Bytes)
	require.Greater(t, pages, 0)
	require.Contains(t, text, "Feb 29, 2040")
	require.Contains(t, text, "Mar 1, 2040")
	require.NotContains(t, text, "2040-02-29T00:00:00Z")
}
