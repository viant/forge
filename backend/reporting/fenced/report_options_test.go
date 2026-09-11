package fenced

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	forgepdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// Native clients pass values without creating PDF summary blocks.
func TestReportOptionSummarySurvivesPDFCompilation(t *testing.T) {
	content := "```forge-report\n" +
		`{"version":1,"scope":"message","id":"options","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Pathways","metadata":{"reportOptions":[{"name":"exposurePerspective","label":"First vs. Last Exposure"}],"options":{"exposurePerspective":"First"}},"blocks":[{"id":"pathways","kind":"sectionBlock","title":"Pathways"}]}` +
		"\n```\n```forge-report\n" +
		`{"version":1,"scope":"message","id":"options","sequence":2,"mode":"commit"}` + "\n```"
	compiled, err := Compile(&CompileRequest{Content: content, ReportID: "options"})
	require.NoError(t, err)
	metadata, err := json.Marshal(compiled.Assembly.Source["metadata"])
	require.NoError(t, err)
	require.Contains(t, string(metadata), "exposurePerspective")
	require.NotContains(t, string(compiled.ReportPrint), "First vs. Last Exposure")
	print, err := reportprint.DecodeJSON(compiled.ReportPrint)
	require.NoError(t, err)
	rendered, err := forgepdf.Render(print, forgepdf.Options{Metadata: metadata})
	require.NoError(t, err)
	require.True(t, bytes.HasPrefix(rendered.Bytes, []byte("%PDF-")))
}
