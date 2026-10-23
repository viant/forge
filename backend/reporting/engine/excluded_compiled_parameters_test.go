package reporting

import (
	"encoding/json"
	"reflect"
	"testing"

	dsproto "github.com/viant/forge/backend/datasource/contract"
)

func TestExcludedDatasetParametersRemoveCompiledInheritedValues(t *testing.T) {
	builder := json.RawMessage(`{"reportBuilder":{"predicates":[{"id":"dateRange","kind":"dateRange","startParamPath":"filters.from","endParamPath":"filters.to","prefill":{"start":"from","end":"to"}},{"id":"interval","paramPath":"options.interval"}]}}`)
	base := map[string]interface{}{"filters": map[string]interface{}{"from": "2026-10-10", "to": "2026-10-12", "account": "owned"}, "options": map[string]interface{}{"interval": "local comparison"}}
	parameters := map[string]interface{}{"from": "2026-11-01", "to": "2026-11-02", "interval": "global interval"}
	descriptor := &dsproto.DataSource{}
	scope := &reportExecutionDatasetScope{Mode: "exclude", Exclude: []string{"dateRange", "interval"}, Local: map[string]interface{}{"options": map[string]interface{}{"interval": "local comparison"}}}
	args, err := reportDatasetArguments(base, parameters, descriptor, builder, scope)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]interface{}{"filters": map[string]interface{}{"account": "owned"}, "options": map[string]interface{}{"interval": "local comparison"}}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("excluded daily dates reached snapshot export: got %#v, want %#v", args, want)
	}
	if base["filters"].(map[string]interface{})["from"] != "2026-10-10" {
		t.Fatal("mutated compiled request shared with another dataset")
	}
	// A daily dataset without the exclusion must still receive the new dates.
	daily, err := reportDatasetArguments(base, parameters, descriptor, builder, nil)
	if err != nil {
		t.Fatal(err)
	}
	if daily["filters"].(map[string]interface{})["from"] != "2026-11-01" {
		t.Fatal("daily filter was suppressed")
	}
}
