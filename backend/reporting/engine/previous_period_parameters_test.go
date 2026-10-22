package reporting

import (
	"encoding/json"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"testing"
)

func TestPreviousPeriodUsesFreshBoundRunParameters(t *testing.T) {
	builder := json.RawMessage(`{"reportBuilder":{"predicates":[{"id":"advertiserId","paramPath":"filters.advertiserId"},{"id":"campaignIds","paramPath":"filters.campaignIds","multiple":true},{"id":"dateRange","startParamPath":"filters.from","endParamPath":"filters.to","prefill":{"start":"from","end":"to"}}]}}`)
	var scope reportExecutionDatasetScope
	scopeRaw := json.RawMessage(`{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}}`)
	if err := json.Unmarshal(scopeRaw, &scope); err != nil {
		t.Fatal(err)
	}
	descriptor := &dsproto.DataSource{}
	primaryRaw := json.RawMessage(`{"filters":{"advertiserId":42,"campaignIds":[7],"from":"2026-09-21","to":"2026-10-20"}}`)
	priorRaw := json.RawMessage(`{"filters":{"advertiserId":42,"campaignIds":[7],"from":"2026-08-22","to":"2026-09-20"}}`)
	parameters := map[string]interface{}{"advertiserId": 43, "campaignIds": []interface{}{8}, "from": "2026-10-01", "to": "2026-10-07"}
	var primaryBase, priorBase map[string]interface{}
	_ = json.Unmarshal(primaryRaw, &primaryBase)
	_ = json.Unmarshal(priorRaw, &priorBase)
	primary, err := reportDatasetArguments(primaryBase, parameters, descriptor, builder, nil)
	if err != nil {
		t.Fatal(err)
	}
	prior, err := reportDatasetArguments(priorBase, parameters, descriptor, builder, &scope)
	if err != nil {
		t.Fatal(err)
	}
	var scopeMap map[string]interface{}
	_ = json.Unmarshal(scopeRaw, &scopeMap)
	datasets := []map[string]interface{}{{"id": "prior", "scope": scopeMap, "request": prior}, {"id": "primary", "request": primary}}
	if err = applyReportPreviousPeriods(datasets); err != nil {
		t.Fatal(err)
	}
	for _, request := range []map[string]interface{}{primary, prior} {
		filters := request["filters"].(map[string]interface{})
		if filters["advertiserId"] != 43 || filters["campaignIds"].([]interface{})[0] != 8 {
			t.Fatalf("stale entity selection: %v", request)
		}
	}
	if reportRequestPath(primary, "filters.from") != "2026-10-01" || reportRequestPath(primary, "filters.to") != "2026-10-07" {
		t.Fatal(primary)
	}
	if reportRequestPath(prior, "filters.from") != "2026-09-24" || reportRequestPath(prior, "filters.to") != "2026-09-30" {
		t.Fatal(prior)
	}
	// A dataset-subset execution still resolves its anchor from the prepared full
	// dataset set. No primary fetch is required merely to calculate the dates.
	if err = applyReportPreviousPeriods(datasets); err != nil {
		t.Fatal(err)
	}
	if reportRequestPath(prior, "filters.from") != "2026-09-24" {
		t.Fatal("comparison shifted twice")
	}
}
