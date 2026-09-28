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
