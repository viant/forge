package fenced

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"testing"
)

func boundInvocationFixture() *CompileRequest {
	return &CompileRequest{ReportID: "demo", Fences: []Fence{
		{Kind: ReportFence, Payload: json.RawMessage(`{"version":1,"scope":"message","id":"demo","sequence":1,"mode":"start","grammar":"report-document-v1","title":"Delivery","blocks":[{"id":"scope","kind":"filterBarBlock","title":"Scope","datasetRef":"daily","mode":"summary","paramIds":["adOrderId"]},{"id":"spend","kind":"kpiBlock","size":"quarter","datasetRef":"daily","valueField":"spend","title":"Spend"}]}`)},
		{Kind: DataFence, Payload: json.RawMessage(`{"version":2,"scope":"message","id":"daily","reportRef":"demo","sequence":2,"format":"json","mode":"replace","data":[{"spend":12.5}]}`)},
		{Kind: ReportFence, Payload: json.RawMessage(`{"version":1,"scope":"message","id":"demo","sequence":3,"mode":"commit"}`)},
	}, Invocation: &InvocationBinding{
		Source:     map[string]any{"kind": "dashboard.reportBuilder", "containerId": "delivery", "stateKey": "reportBuilder:delivery", "dataSourceRef": "cube"},
		Parameters: map[string]any{"viewMode": "table", "groupBy": "", "pageSize": 50, "orderField": "", "orderDir": "asc"},
		Datasets:   []DatasetBinding{{ID: "daily", DataSourceRef: "delivery_daily", Request: json.RawMessage(`{"measures":{"spend":true},"dimensions":{"date":true},"filters":{"adOrderId":[2659534]},"limit":1000,"offset":0}`)}},
	}}
}
func TestInvocationPreservesAdmittedRequestsBeforeArtifactHashing(t *testing.T) {
	input := boundInvocationFixture()
	before := mustJSON(t, input)
	result, err := Compile(input)
	require.NoError(t, err)
	require.JSONEq(t, string(before), string(mustJSON(t, input)), "compiler must not mutate admission")
	var spec map[string]any
	require.NoError(t, json.Unmarshal(result.ReportSpec, &spec))
	require.Equal(t, "delivery", spec["source"].(map[string]any)["containerId"])
	require.Equal(t, "quarter", spec["layoutIntent"].(map[string]any)["items"].([]any)[1].(map[string]any)["size"])
	dataset := spec["datasets"].([]any)[0].(map[string]any)
	require.Equal(t, "delivery_daily", dataset["dataSourceRef"])
	require.JSONEq(t, string(input.Invocation.Datasets[0].Request), string(mustJSON(t, dataset["request"])))
	fill, err := reportfill.DecodeJSON(result.ReportFill)
	require.NoError(t, err)
	require.Equal(t, hashJSON(result.ReportSpec), fill.SpecHash)
	require.Equal(t, "adOrderId", fill.Blocks[0].FilterBarContent.Params[0].ID)
	require.Equal(t, []any{float64(2659534)}, fill.Blocks[0].FilterBarContent.Params[0].Value)
	print, err := reportprint.DecodeJSON(result.ReportPrint)
	require.NoError(t, err)
	require.Equal(t, hashJSON(result.ReportFill), print.FillHash)
	require.Equal(t, hashJSON(result.ReportSpec), print.SpecHash)
	require.Contains(t, string(result.ReportPrint), "2659534")
}
func TestInvocationRejectsMismatchedIdentityAndDatasetBindings(t *testing.T) {
	tests := map[string]func(*InvocationBinding){
		"missing source":       func(b *InvocationBinding) { delete(b.Source, "stateKey") },
		"wrong source":         func(b *InvocationBinding) { b.Source["kind"] = "other" },
		"missing parameters":   func(b *InvocationBinding) { b.Parameters = nil },
		"missing dataset":      func(b *InvocationBinding) { b.Datasets = nil },
		"unknown dataset":      func(b *InvocationBinding) { b.Datasets[0].ID = "other" },
		"duplicate dataset":    func(b *InvocationBinding) { b.Datasets = append(b.Datasets, b.Datasets[0]) },
		"missing physical ref": func(b *InvocationBinding) { b.Datasets[0].DataSourceRef = "" },
		"null request":         func(b *InvocationBinding) { b.Datasets[0].Request = json.RawMessage(`null`) },
		"unknown request field": func(b *InvocationBinding) {
			b.Datasets[0].Request = json.RawMessage(`{"limit":10,"offset":0,"unsafeQuery":"x"}`)
		},
	}
	for name, mutate := range tests {
		t.Run(name, func(t *testing.T) {
			input := boundInvocationFixture()
			mutate(input.Invocation)
			_, err := Compile(input)
			require.Error(t, err)
		})
	}
}
