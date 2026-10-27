package materializer

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

// Independently authored synthetic report: no application capture or data.
func sectionSpecFixture() json.RawMessage {
	return json.RawMessage(`{"version":1,"kind":"reportSpec","title":"Sample sections","source":{"kind":"dashboard.reportBuilder","containerId":"sample","stateKey":"sample","dataSourceRef":"sample"},"parameters":{"viewMode":"table","groupBy":"","pageSize":25,"orderField":"","orderDir":"asc"},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["tabs","overview","metric","detail","table"]},"refinements":[],"calculatedFields":[],"datasets":[{"id":"current","dataSourceRef":"current","request":{"limit":25,"offset":0}},{"id":"prior","dataSourceRef":"prior","request":{"limit":25,"offset":0}},{"id":"trend","dataSourceRef":"trend","request":{"limit":25,"offset":0}},{"id":"detail","dataSourceRef":"detail","request":{"limit":25,"offset":0}}],"blocks":[{"id":"tabs","kind":"tabGroupBlock","sectionIds":["overview","detail"],"defaultSectionId":"overview","includeUnlistedSections":false},{"id":"overview","kind":"sectionBlock","title":"Overview","blockIds":["metric"]},{"id":"metric","kind":"kpiBlock","title":"Sample total","datasetRef":"current","valueField":"amount","secondaryDatasetRef":"prior","secondaryField":"amount","secondaryCalculation":"relativeChange","sparkline":{"datasetRef":"trend","valueField":"amount","categoryField":"day"}},{"id":"detail","kind":"sectionBlock","title":"Detail","blockIds":["table"]},{"id":"table","kind":"tableBlock","title":"Sample detail","datasetRef":"detail","columns":[{"key":"amount","label":"Amount"}]}]}`)
}
func TestInitialSectionUsesCompleteClosureAndNoEmptyPendingDatasets(t *testing.T) {
	plan := PlanInitialSection(sectionSpecFixture(), "")
	if plan == nil || plan.SectionID != "overview" || !reflect.DeepEqual(plan.DatasetIDs, []string{"current", "prior", "trend"}) || len(plan.Sections) != 2 {
		t.Fatalf("bad closure: %+v", plan)
	}
	payloads := map[string]json.RawMessage{"current": json.RawMessage(`{"rows":[{"amount":10}]}`), "prior": json.RawMessage(`{"rows":[{"amount":5}]}`), "trend": json.RawMessage(`{"rows":[{"amount":7,"day":"2026-01-01"}]}`)}
	artifacts, err := MaterializeSection(context.Background(), plan, payloads, nil)
	if err != nil {
		t.Fatal(err)
	}
	var fill struct {
		Datasets []struct {
			ID   string                   `json:"id"`
			Rows []map[string]interface{} `json:"rows"`
		} `json:"datasets"`
	}
	if json.Unmarshal(artifacts.ReportFill, &fill) != nil || len(fill.Datasets) != 3 {
		t.Fatal(string(artifacts.ReportFill))
	}
	for _, dataset := range fill.Datasets {
		if dataset.ID == "detail" || len(dataset.Rows) != 1 {
			t.Fatalf("pending data invented: %+v", dataset)
		}
	}
	if strings.Contains(string(plan.Spec), `"id":"table"`) {
		t.Fatal("pending table included")
	}
	delete(payloads, "prior")
	if _, err := MaterializeSection(context.Background(), plan, payloads, nil); err == nil {
		t.Fatal("missing comparison silently materialized empty")
	}
	detail := PlanInitialSection(sectionSpecFixture(), "detail")
	if detail == nil || !reflect.DeepEqual(detail.DatasetIDs, []string{"detail"}) {
		t.Fatalf("requested tab ignored: %+v", detail)
	}
}
func TestInitialSectionRejectsAmbiguousGraphs(t *testing.T) {
	original := string(sectionSpecFixture())
	for _, raw := range []string{
		strings.Replace(original, `"includeUnlistedSections":false`, `"includeUnlistedSections":true`, 1),
		strings.Replace(original, `"datasetRef":"trend"`, `"datasetRef":"unknown"`, 1),
		strings.Replace(original, `"blockIds":["table"]`, `"blockIds":["missing"]`, 1),
		strings.Replace(original, `"id":"table"`, `"id":"metric"`, 1),
	} {
		if plan := PlanInitialSection(json.RawMessage(raw), ""); plan != nil {
			t.Fatalf("ambiguous section accepted: %+v", plan)
		}
	}
}

func TestInitialSectionExcludesUnlistedAnalyticalBlocksButRetainsGlobalControls(t *testing.T) {
	var root map[string]interface{}
	if err := json.Unmarshal(sectionSpecFixture(), &root); err != nil {
		t.Fatal(err)
	}
	root["datasets"] = append(root["datasets"].([]interface{}), map[string]interface{}{"id": "unlistedRows", "dataSourceRef": "unlistedRows", "request": map[string]interface{}{"limit": 25, "offset": 0}})
	root["blocks"] = append(root["blocks"].([]interface{}), map[string]interface{}{"id": "unlistedMetric", "kind": "kpiBlock", "title": "Unlisted metric", "datasetRef": "unlistedRows", "valueField": "amount"})
	// A hidden drill target is metadata for a future action, not initial content.
	root["drillMetadata"] = map[string]interface{}{"target": map[string]interface{}{"datasetRef": "unlistedRows"}}
	raw, err := json.Marshal(root)
	if err != nil {
		t.Fatal(err)
	}
	plan := PlanInitialSection(raw, "")
	if plan == nil || !reflect.DeepEqual(plan.DatasetIDs, []string{"current", "prior", "trend"}) {
		t.Fatalf("unlisted data entered first wave: %+v", plan)
	}
	var projected struct {
		Blocks []struct {
			ID string `json:"id"`
		} `json:"blocks"`
	}
	if err := json.Unmarshal(plan.Spec, &projected); err != nil {
		t.Fatal(err)
	}
	for _, block := range projected.Blocks {
		if block.ID == "unlistedMetric" {
			t.Fatal("unlisted content materialized")
		}
	}
	// ReportRuntime renders filter bars globally even outside section membership.
	root["blocks"] = append(root["blocks"].([]interface{}), map[string]interface{}{"id": "globalFilters", "kind": "filterBarBlock", "datasetRef": "detail", "filters": []interface{}{}})
	raw, _ = json.Marshal(root)
	plan = PlanInitialSection(raw, "")
	if plan == nil || !reflect.DeepEqual(plan.DatasetIDs, []string{"current", "prior", "trend", "detail"}) {
		t.Fatalf("global control dependencies lost: %+v", plan)
	}
	// Root scope option datasets have the same global visibility obligation.
	root["blocks"] = root["blocks"].([]interface{})[:len(root["blocks"].([]interface{}))-1]
	root["scope"] = map[string]interface{}{"params": []interface{}{map[string]interface{}{"id": "sample", "datasetRef": "detail"}}}
	raw, _ = json.Marshal(root)
	plan = PlanInitialSection(raw, "")
	if plan == nil || !reflect.DeepEqual(plan.DatasetIDs, []string{"current", "prior", "trend", "detail"}) {
		t.Fatalf("global scope dependencies lost: %+v", plan)
	}
}
