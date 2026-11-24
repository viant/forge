package window

import (
	"testing"

	forgeTypes "github.com/viant/forge/backend/types"
)

func TestSemanticReportModelURIIsNotForgeResourceModelDependency(t *testing.T) {
	const semantic = "model://example/performance/line_delivery@v1"
	refs := collectAssetReferences(map[string]any{
		"reportBuilder": map[string]any{
			"binding":       map[string]any{"modelRef": semantic, "entity": "line_delivery"},
			"semanticModel": map[string]any{"modelRef": semantic, "version": 1},
		},
		"resourceModelRef": "advertiserIdentity",
		"dialog":           map[string]any{"modelRef": "dialogIdentity"},
	})
	if refs.ResourceModels[semantic] {
		t.Fatal("inline report semantic model was treated as a missing Forge resource model")
	}
	if !refs.ResourceModels["advertiserIdentity"] || !refs.ResourceModels["dialogIdentity"] {
		t.Fatalf("ordinary Forge resource model references were dropped: %+v", refs.ResourceModels)
	}
}

func TestMappingReferencesIgnoreApplicationValues(t *testing.T) {
	window := &forgeTypes.Window{ResourceMappings: map[string]forgeTypes.ResourceMapping{"editor": {
		Cases:   map[string]forgeTypes.ResourceMappingCase{"short": {ModelRef: "shortRecord", Values: map[string]interface{}{"modelRef": "label", "dataSourceRef": "caption"}}},
		Default: &forgeTypes.ResourceMappingCase{ModelRef: "defaultRecord"},
	}}}
	refs := CollectWindowReferences(window).YAML
	if len(refs.ResourceModels) != 2 || !refs.ResourceModels["shortRecord"] || !refs.ResourceModels["defaultRecord"] || len(refs.DataSources) != 0 {
		t.Fatalf("incorrect mapping dependencies: %+v", refs)
	}
}
