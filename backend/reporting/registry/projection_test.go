package registry

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestReportDefinitionSelectionIsOptIn(t *testing.T) {
	raw := json.RawMessage(`{"schemaVersion":1,"builderDefinition":{"reportBuilder":{"predicates":[{"name":"period","required":true}],"measures":[{"id":"amount"}]}},"reportDocument":{"title":"Example","blocks":[{"kind":"tabGroupBlock","id":"tabs","sectionIds":["summary","detail"],"defaultSectionId":"summary"},{"kind":"sectionBlock","id":"summary","navigationLabel":"Summary","blockIds":["chart"]},{"kind":"sectionBlock","id":"detail","title":"Detail"},{"kind":"chartBlock","id":"chart","chartSpec":{"privateFixture":"not requested"}}]},"dataSources":{"rows":{"backend":{"kind":"mcp_tool"}}},"metadata":{"note":"not requested"},"state":{"notRequested":true}}`)
	empty, err := SelectReportDefinition(raw, ReportInclude{})
	require.NoError(t, err)
	require.Empty(t, empty)
	selected, err := SelectReportDefinition(raw, ReportInclude{Inputs: true, Tabs: true})
	require.NoError(t, err)
	require.Len(t, selected, 2)
	var inputs map[string]any
	require.NoError(t, json.Unmarshal(selected["inputs"], &inputs))
	require.Contains(t, inputs, "predicates")
	var tabs []map[string]any
	require.NoError(t, json.Unmarshal(selected["tabs"], &tabs))
	require.Len(t, tabs, 3)
	require.Equal(t, "Summary", tabs[1]["navigationLabel"])
	require.NotContains(t, tabs[1], "blockIds")
	data, _ := json.Marshal(selected)
	require.NotContains(t, string(data), "privateFixture")
	require.NotContains(t, string(data), "not requested")
	full, err := SelectReportDefinition(raw, ReportInclude{Raw: true, Inputs: true, Tabs: true, Metadata: true})
	require.NoError(t, err)
	require.Len(t, full, 1)
	var source map[string]string
	require.NoError(t, json.Unmarshal(full["raw"], &source))
	require.Equal(t, string(raw), source["content"])
	selected["inputs"][0] = 'x'
	again, err := SelectReportDefinition(raw, ReportInclude{Inputs: true})
	require.NoError(t, err)
	require.True(t, json.Valid(again["inputs"]))
}

func TestNativeReportDefinitionSelection(t *testing.T) {
	raw := json.RawMessage(`{"schemaVersion":1,"reportSpec":{"scope":{"params":[{"name":"period","type":"string"}]},"parameters":{"pageSize":25},"datasets":[{"id":"rows"}],"blocks":[],"layoutIntent":{"kind":"stack"}},"reportFill":{"datasets":[{"rows":[{"amount":123}]}]}}`)
	selected, err := SelectReportDefinition(raw, ReportInclude{Inputs: true, Layout: true})
	require.NoError(t, err)
	require.Len(t, selected, 2)
	require.NotContains(t, selected, "fill")
	var inputs map[string]any
	require.NoError(t, json.Unmarshal(selected["inputs"], &inputs))
	require.Contains(t, inputs, "scope")
	require.Contains(t, inputs, "parameters")
}
