package pdf

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/reporting/materializer"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func TestKPINumberPDFKeepsDeclaredPrecisionAndRawSource(t *testing.T) {
	spec := json.RawMessage(`{"version":1,"kind":"reportSpec","title":"Precision specimen","source":{"kind":"report","containerId":"precision","stateKey":"precision","dataSourceRef":"observations"},"parameters":{"viewMode":"table","pageSize":25,"orderDir":"asc","orderField":"","groupBy":""},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"observations","request":{"limit":1,"offset":0}}],"layoutIntent":{"kind":"single","resultPanePosition":"bottom","blockOrder":["period"]},"blocks":[{"id":"period","kind":"kpiBlock","title":"Measurement","datasetRef":"primary","valueField":"value","valueLabel":"Whole","valueFormat":"number0","secondaryField":"secondary","secondaryLabel":"Decimal","secondaryFormat":"number1"}]}`)
	artifacts, err := materializer.Materialize(t.Context(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"value":1234.26,"secondary":-1234.26}]}`)})
	require.NoError(t, err)
	require.Contains(t, string(artifacts.ReportFill), "1234.26")
	require.Contains(t, string(artifacts.ReportFill), "-1234.26")
	document, err := reportprint.DecodeJSON(artifacts.ReportPrint)
	require.NoError(t, err)
	rendered, err := Render(document, Options{})
	require.NoError(t, err)
	pages, text := extractPDFPlainText(t, rendered.Bytes)
	require.Greater(t, pages, 0)
	require.Contains(t, text, "1,234")
	require.Contains(t, text, "-1,234.3")
	require.NotContains(t, text, "1234.26")
}
