package forgeui

import (
	"encoding/json"
	"fmt"
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
	if err != nil {
		t.Logf("diagnostics: %#v", compiled.Diagnostics)
	}
	require.NoError(t, err)
	require.NotEmpty(t, compiled.ReportSpec)
	require.NotEmpty(t, compiled.ReportFill)
	require.NotEmpty(t, compiled.ReportPrint)
}

func TestBuildFencesPreservesForgeUITabsAndOnlyVisiblePresentationFields(t *testing.T) {
	ui := json.RawMessage(`{
		"title":"Media Plan",
		"containers":[
		{
			"id":"planIdentity","dataSourceRef":"identity","items":[
				{"id":"name","label":"Media plan","dataField":"summary.brand"},
				{"id":"version","label":"Latest","dataField":"version"}
			]
		},{
			"id":"detailTabs",
			"tabs":{"defaultSelectedTabId":"generalTab"},
			"containers":[
				{"id":"generalTab","title":"General","containers":[
					{"id":"goal","title":"Goal","dataSourceRef":"overview","items":[
						{"id":"brand","label":"Brand","dataField":"brand"},
						{"id":"budget","label":"Budget","dataField":"budget","format":"currency"}
					]},
					{"id":"hidden","title":"Hidden state","dataSourceRef":"status","visibleWhen":{"source":"form","field":"message"},"items":[{"id":"message","label":"Message"}]}
				]},
				{"id":"channelsTab","title":"Channels","containers":[
					{"id":"mix","title":"Budget mix","dataSourceRef":"channels","chart":{"type":"donut","series":{"nameKey":"Channel","valueKey":"Allocated_Budget","palette":["#3857d6","#2aa198"]}}},
					{"id":"plan","title":"Channel plan","dataSourceRef":"channels","columns":[
						{"key":"Channel","label":"Media"},
						{"key":"Allocation_PCT","label":"Mix %","format":"number"},
						{"key":"Allocated_Budget","label":"Budget","format":"currency"}
					]}
				]}
			]
		}]
	}`)
	fences, err := BuildFences(Request{
		ReportID: "feed_media_plan",
		Title:    "Media Plan",
		UI:       ui,
		DataSources: map[string]json.RawMessage{
			"identity": json.RawMessage(`{"collection":[{"summary":{"brand":"CoinPoker"},"version":1,"warnings":["omit"]}]}`),
			"overview": json.RawMessage(`{"collection":[{"brand":"CoinPoker","budget":100000,"internal":"omit"}]}`),
			"status":   json.RawMessage(`{"collection":[]}`),
			"channels": json.RawMessage(`{"collection":[{"Channel":"CTV","Allocation_PCT":60,"Allocated_Budget":60000},{"Channel":"Video","Allocation_PCT":40,"Allocated_Budget":40000}]}`),
		},
	})
	require.NoError(t, err)
	compiled, err := fenced.Compile(&fenced.CompileRequest{Fences: fences, ReportID: "feed_media_plan"})
	require.NoError(t, err)

	var spec map[string]any
	require.NoError(t, json.Unmarshal(compiled.ReportSpec, &spec))
	blocks, _ := spec["blocks"].([]any)
	require.Len(t, blocks, 6)
	require.Equal(t, "CoinPoker · Latest 1", spec["subtitle"])
	require.Equal(t, "tabGroupBlock", blocks[0].(map[string]any)["kind"])
	require.Equal(t, []any{"generalTab", "channelsTab"}, blocks[0].(map[string]any)["sectionIds"])
	require.Equal(t, "sectionBlock", blocks[1].(map[string]any)["kind"])
	require.Equal(t, "General", blocks[1].(map[string]any)["title"])
	require.Equal(t, "badgesBlock", blocks[2].(map[string]any)["kind"])
	require.NotContains(t, string(compiled.ReportSpec), "Hidden state")
	require.NotContains(t, string(compiled.ReportSpec), "internal")
	require.NotContains(t, string(compiled.ReportSpec), "warnings")
	require.NotContains(t, string(compiled.ReportSpec), "planIdentity")
	require.Equal(t, "sectionBlock", blocks[3].(map[string]any)["kind"])
	require.Equal(t, "chartBlock", blocks[4].(map[string]any)["kind"])
	chartSpec := blocks[4].(map[string]any)["chartSpec"].(map[string]any)
	require.Equal(t, "donut", chartSpec["type"])
	require.Equal(t, "Channel", chartSpec["xField"])
	require.Equal(t, []any{"Allocated_Budget"}, chartSpec["yFields"])
	require.Equal(t, "tableBlock", blocks[5].(map[string]any)["kind"])
	columns := blocks[5].(map[string]any)["columns"].([]any)
	require.Equal(t, "Channel", columns[0].(map[string]any)["key"])
	require.Equal(t, "Allocation_PCT", columns[1].(map[string]any)["key"])
	require.Equal(t, "Allocated_Budget", columns[2].(map[string]any)["key"])

	var printDoc map[string]any
	require.NoError(t, json.Unmarshal(compiled.ReportPrint, &printDoc))
	pages, _ := printDoc["pages"].([]any)
	require.GreaterOrEqual(t, len(pages), 2)
	firstElements := pages[0].(map[string]any)["elements"].([]any)
	secondElements := pages[1].(map[string]any)["elements"].([]any)
	require.Contains(t, fmt.Sprint(firstElements), "General")
	require.Contains(t, fmt.Sprint(secondElements), "Channels")
}

func TestBuildFencesDoesNotDropRowsBeyondFirstUIPage(t *testing.T) {
	rows := make([]map[string]any, 0, 47)
	for index := 1; index <= 47; index++ {
		rows = append(rows, map[string]any{"Name": fmt.Sprintf("Publisher %02d", index), "Cost": index * 100})
	}
	data, err := json.Marshal(map[string]any{"collection": rows})
	require.NoError(t, err)
	fences, err := BuildFences(Request{
		ReportID:    "supply",
		Title:       "Supply",
		UI:          json.RawMessage(`{"containers":[{"id":"supply","title":"Publisher and site inventory","dataSourceRef":"publishers","columns":[{"key":"Name","label":"Publisher / site"},{"key":"Cost","label":"Cost","format":"currency"}]}]}`),
		DataSources: map[string]json.RawMessage{"publishers": data},
	})
	require.NoError(t, err)
	compiled, err := fenced.Compile(&fenced.CompileRequest{Fences: fences, ReportID: "supply"})
	require.NoError(t, err)
	require.Contains(t, string(compiled.ReportPrint), "Publisher 47")
	var printDoc map[string]any
	require.NoError(t, json.Unmarshal(compiled.ReportPrint, &printDoc))
	pages, _ := printDoc["pages"].([]any)
	require.GreaterOrEqual(t, len(pages), 2)
}

func TestBuildFencesUsesNestedFormPresentationInsteadOfParentRawDatasource(t *testing.T) {
	fences, err := BuildFences(Request{
		ReportID: "form",
		Title:    "Form",
		UI:       json.RawMessage(`{"containers":[{"id":"editor","title":"Plan essentials","dataSourceRef":"draft","containers":[{"id":"campaign","title":"Goal and campaign","dataSourceRef":"draft","schemaBasedForm":{"dataSourceRef":"draft","schema":{"type":"object","properties":{"objective":{"type":"string","title":"Goal","x-ui-order":1},"budget":{"type":"number","title":"Budget","x-ui-order":2}}}}}]}]}`),
		DataSources: map[string]json.RawMessage{
			"draft": json.RawMessage(`{"collection":[{"objective":"awareness","budget":100000,"planId":"internal-plan-id"}]}`),
		},
	})
	require.NoError(t, err)
	compiled, err := fenced.Compile(&fenced.CompileRequest{Fences: fences, ReportID: "form"})
	require.NoError(t, err)
	require.Contains(t, string(compiled.ReportSpec), "Goal and campaign")
	require.NotContains(t, string(compiled.ReportSpec), "internal-plan-id")
	require.NotContains(t, string(compiled.ReportSpec), "planId")
}
