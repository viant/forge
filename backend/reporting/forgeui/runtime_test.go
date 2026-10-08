package forgeui

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/viant/forge/backend/types"
)

func TestPortableNativeReportWindowMatchesRendererFixture(t *testing.T) {
	data, err := os.ReadFile("testdata/native-report.json")
	if err != nil {
		t.Fatal(err)
	}
	report, err := reportspec.DecodeJSON(data)
	if err != nil {
		t.Fatal(err)
	}
	window := &types.Window{WindowKey: "report", View: types.View{Content: &types.Container{ID: "root"}}, DataSource: map[string]types.DataSource{"records": {Service: &types.Service{Endpoint: "agentlyAPI", URI: "/providers/studio/windows/report/datasources/records/fetch?definitionRevision=published-1", Method: "POST"}, Selectors: &types.Selectors{Data: "rows"}}}}
	if err = AttachReportRuntime(window, report, map[string]string{"records": "request"}); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(window)
	if err != nil {
		t.Fatal(err)
	}
	golden, err := os.ReadFile("testdata/native-report-window.json")
	if err != nil {
		t.Fatal(err)
	}
	var actual, expected any
	if err = json.Unmarshal(encoded, &actual); err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(golden, &expected); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(actual, expected) {
		t.Fatal("Go runtime assembly differs from frontend render fixture")
	}
	if err = AttachReportRuntime(&types.Window{View: types.View{Content: &types.Container{}}, DataSource: window.DataSource}, report, nil); err == nil {
		t.Fatal("authored dataset request silently ignored")
	}
	for _, path := range []string{"__proto__.admin", "request.constructor.prototype", "prototype"} {
		if err = AttachReportRuntime(&types.Window{View: types.View{Content: &types.Container{}}, DataSource: window.DataSource}, report, map[string]string{"records": path}); err == nil {
			t.Fatalf("unsafe request path %q accepted", path)
		}
	}
}

func TestPortableReportDatasetsHaveIndependentRequests(t *testing.T) {
	data, _ := os.ReadFile("testdata/native-report.json")
	report, err := reportspec.DecodeJSON(data)
	if err != nil {
		t.Fatal(err)
	}
	second := report.Datasets[0]
	second.ID = "secondary"
	offset := 50
	second.Request.Offset = &offset
	report.Datasets = append(report.Datasets, second)
	window := &types.Window{View: types.View{Content: &types.Container{}}, DataSource: map[string]types.DataSource{"records": {Service: &types.Service{URI: "/fetch"}}}}
	if err = AttachReportRuntime(window, report, map[string]string{"records": "query.request"}); err != nil {
		t.Fatal(err)
	}
	first := window.DataSource["portable-report-dataset-primary"]
	last := window.DataSource["portable-report-dataset-secondary"]
	if first.Parameters[0].Default == last.Parameters[0].Default {
		t.Fatal("independent datasets shared request state")
	}
	if first.Service.URI != last.Service.URI || first.Parameters[0].Name != "query.request" || last.Parameters[0].Codec.Name != "json" {
		t.Fatal("provider route/request binding changed")
	}
}
