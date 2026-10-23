package window

import "testing"

func TestSemanticReportModelURIIsNotForgeResourceModelDependency(t *testing.T) {
	const semantic = "model://steward/performance/line_delivery@v1"
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
