package fenced

import "testing"

func TestBuildFillBlocksResolvesKPISecondaryValue(t *testing.T) {
	blocks := []map[string]any{{"id": "sales", "kind": "kpiBlock", "title": "Sales", "datasetRef": "summary", "valueField": "sales", "valueLabel": "Sales", "valueFormat": "currency", "secondaryField": "salesChange", "secondaryLabel": "Period change", "secondaryFormat": "percentFraction", "secondaryTrend": true}}
	datasets := []any{map[string]any{"id": "summary", "rows": []map[string]any{{"sales": 1200.0, "salesChange": 0.08}}}}
	result := buildFillBlocks(blocks, datasets)
	block := result[0].(map[string]any)
	content := block["content"].(map[string]any)
	if content["secondaryValue"] != 0.08 || content["secondaryField"] != "salesChange" || content["secondaryTrend"] != true {
		t.Fatalf("secondary KPI content was not resolved: %+v", content)
	}
}
