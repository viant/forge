package reporting

import (
	"encoding/json"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/registry"
	"os"
	"testing"
)

func TestReportParametersUseTrustedAliasesAndPreserveLocalScope(t *testing.T) {
	raw, err := os.ReadFile("testdata/authored_report.json")
	if err != nil {
		t.Fatal(err)
	}
	var e registry.ReportEnvelope
	_ = json.Unmarshal(raw, &e)
	var ds dsproto.DataSource
	_ = json.Unmarshal(e.DataSources["records"], &ds)
	params := map[string]interface{}{"from": "2026-10-01", "to": "2026-10-02"}
	base := map[string]interface{}{"filters": map[string]interface{}{"from": "2026-10-07", "to": "2026-10-07"}, "dimensions": map[string]interface{}{"category": true}, "limit": float64(25)}
	args, err := reportDatasetArguments(base, params, &ds, e.BuilderDefinition, nil)
	if err != nil {
		t.Fatal(err)
	}
	filters := args["filters"].(map[string]interface{})
	if filters["from"] != params["from"] || filters["to"] != params["to"] {
		t.Fatalf("trusted aliases not bound: %+v", args)
	}
	args, err = reportDatasetArguments(base, params, &ds, e.BuilderDefinition, &reportExecutionDatasetScope{Mode: "override"})
	if err != nil {
		t.Fatal(err)
	}
	if args["filters"].(map[string]interface{})["from"] != "2026-10-07" {
		t.Fatal("client widened local dataset dates")
	}
	if _, err = reportDatasetArguments(base, map[string]interface{}{"dimensions": map[string]interface{}{"unapproved": true}}, &ds, e.BuilderDefinition, nil); err == nil {
		t.Fatal("client widened selected fields")
	}
	if _, err = reportDatasetArguments(base, map[string]interface{}{"filters": map[string]interface{}{}}, &ds, e.BuilderDefinition, nil); err == nil {
		t.Fatal("client replaced complete filter scope")
	}
	if _, err = reportDatasetArguments(base, map[string]interface{}{"source": "other"}, &ds, e.BuilderDefinition, nil); err == nil {
		t.Fatal("source override accepted")
	}
	if _, err = reportDatasetArguments(base, map[string]interface{}{"guessedAccountID": "other"}, &ds, e.BuilderDefinition, nil); err == nil {
		t.Fatal("undeclared account parameter accepted")
	}
}
