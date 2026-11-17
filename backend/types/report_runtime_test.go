package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestEmbeddedReportRuntimeSurvivesWindowMetadata(t *testing.T) {
	var container Container
	err := yaml.Unmarshal([]byte(`id: overview
kind: dashboard.reportRuntime
dashboard:
  reportRuntime:
    datasetBindings:
      summary: {selector: '0.summary'}
    reportSpec:
      version: 1
      blocks: [{id: spend, kind: kpiBlock, datasetRef: summary}]
`), &container)
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var wire map[string]any
	if err = json.Unmarshal(body, &wire); err != nil {
		t.Fatal(err)
	}
	runtime := wire["dashboard"].(map[string]any)["reportRuntime"].(map[string]any)
	if runtime["datasetBindings"] == nil || runtime["reportSpec"] == nil {
		t.Fatal("embedded report lost during metadata transport")
	}
}

func TestGuidedResultSurvivesWindowMetadata(t *testing.T) {
	var container Container
	err := yaml.Unmarshal([]byte(`id: result
kind: dashboard.guidedResult
guidedResult:
  title: Value needs review
  receipt: {title: Source checked, subject: example.test, detail: Public setup reviewed, tone: success}
  values: [{label: Amount, value: '[Amount]', tone: warning}]
  limit: A completed transaction was not tested.
  checks: [{label: Record received, status: Confirmed, tone: success}]
  example: {code: 'https://example.test/collect?value=[Amount]'}
  nextStep:
    title: Review the source
    collapsible: true
    action: {label: Show the check, prompt: Help me inspect the mapping.}
`), &container)
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var wire map[string]interface{}
	if err = json.Unmarshal(body, &wire); err != nil {
		t.Fatal(err)
	}
	result := wire["guidedResult"].(map[string]interface{})
	if result["checks"] == nil || result["example"] == nil || result["nextStep"] == nil {
		t.Fatal("guided result lost during metadata transport")
	}
	if result["receipt"].(map[string]interface{})["subject"] != "example.test" || result["values"] == nil || result["limit"] == nil || result["nextStep"].(map[string]interface{})["collapsible"] != true {
		t.Fatal("check receipt or supplied-step disclosure lost during metadata transport")
	}
}
