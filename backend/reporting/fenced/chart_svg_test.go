package fenced

import (
	"strings"
	"testing"
)

func TestBuildChartSVGNormalizesHorizontalBarType(t *testing.T) {
	rows := []map[string]any{{"label": "A", "value": 10.0}, {"label": "B", "value": 5.0}}
	for _, chartType := range []string{"horizontal_bar", "horizontal-bar", "horizontal bar", "horizontalbar"} {
		svg := buildChartSVG(rows, map[string]any{"type": chartType, "xField": "label", "yFields": []any{"value"}}, 500, 240)
		if !strings.Contains(svg, `<rect x="120.0"`) || strings.Contains(svg, `<path d="M `) {
			t.Fatalf("type %q did not render horizontal bars: %s", chartType, svg)
		}
	}
}

func TestBuildFillBlocksResolvesDonutAsCategorySeries(t *testing.T) {
	blocks := []map[string]any{{"id": "share", "kind": "chartBlock", "datasetRef": "channels", "chartSpec": map[string]any{"type": "donut", "xField": "channel", "yFields": []any{"conversions"}}}}
	datasets := []any{map[string]any{"id": "channels", "rows": []map[string]any{{"channel": "Display", "conversions": 10}, {"channel": "CTV", "conversions": 5}}}}
	result := buildFillBlocks(blocks, datasets)
	content := result[0].(map[string]any)["content"].(map[string]any)
	resolved := content["resolvedChart"].(map[string]any)
	if resolved["kind"] != "category" || resolved["nameKey"] != "channel" || resolved["valueKey"] != "conversions" {
		t.Fatalf("donut category chart was not resolved: %+v", resolved)
	}
	keys := resolved["seriesKeys"].([]string)
	if len(keys) != 2 || keys[0] != "Display" || keys[1] != "CTV" {
		t.Fatalf("unexpected donut category keys: %v", keys)
	}
}

func TestNormalizeSpecBlocksSetsDonutCategoryNameKey(t *testing.T) {
	blocks := []map[string]any{{"id": "share", "kind": "chartBlock", "chartSpec": map[string]any{"type": "donut", "xField": "channel", "yFields": []any{"conversions"}}}}
	normalizeSpecBlocks(blocks)
	model := blocks[0]["chartModel"].(map[string]any)
	series := model["series"].(map[string]any)
	if series["nameKey"] != "channel" || series["valueKey"] != "conversions" {
		t.Fatalf("donut chart model does not identify category/value keys: %+v", model)
	}
}
