package types

import (
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
	"strings"
	"testing"
)

func TestConsumerWindowKeepsDependencySelectionPrivate(t *testing.T) {
	original := &Window{ResourceDependencies: map[string]string{"rows": "private-descriptor-hash"}, ResourceTarget: &WindowTarget{SelectionToken: "opaque-selection", DependencyPins: map[string]identity.ResolvedResource{"rows": {URI: "datasource://example/rows", ResourceCandidate: identity.ResourceCandidate{ContentFingerprint: "private-source-hash"}}}}}
	public := ConsumerWindow(original)
	raw, err := json.Marshal(public)
	if err != nil {
		t.Fatal(err)
	}
	for _, hidden := range []string{"private-descriptor-hash", "private-source-hash", "dependencyPins", "resourceDependencies"} {
		if strings.Contains(string(raw), hidden) {
			t.Fatalf("consumer leaked %s: %s", hidden, raw)
		}
	}
	if public.ResourceTarget.SelectionToken != "opaque-selection" {
		t.Fatal("opaque selection lost")
	}
	if len(original.ResourceTarget.DependencyPins) != 1 || len(original.ResourceDependencies) != 1 {
		t.Fatal("private selection mutated")
	}
}
