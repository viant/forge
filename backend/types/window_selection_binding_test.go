package types

import (
	"encoding/json"
	identity "github.com/viant/agently-core/protocol/resource"
	"gopkg.in/yaml.v3"
	"strings"
	"testing"
)

func TestWindowSelectionBindingRuntimeOnly(t *testing.T) {
	envelope := windowBundleFixture(t)
	key := envelope.Targets[0].Variant
	variant := envelope.Variants[key]
	before, err := WindowVariantFingerprint(variant)
	if err != nil {
		t.Fatal(err)
	}
	variant.Window.SelectionBinding = &identity.SelectionBinding{InstanceID: "opened", Token: "runtime-secret"}
	after, err := WindowVariantFingerprint(variant)
	if err != nil || before != after || variant.Window.SelectionBinding == nil {
		t.Fatal("runtime binding changed source fingerprint or mutated source", err)
	}
	raw, _ := json.Marshal(variant.Window)
	if !strings.Contains(string(raw), "selectionBinding") {
		t.Fatal("runtime binding omitted from OPEN JSON")
	}
	authored, err := yaml.Marshal(variant.Window)
	if err != nil || strings.Contains(string(authored), "runtime-secret") || strings.Contains(string(authored), "selectionBinding") {
		t.Fatal("runtime binding entered authored YAML", err)
	}
	envelope.Variants[key] = variant
	if envelope.Validate() == nil {
		t.Fatal("counterfeit authored bundle binding accepted")
	}
	raw, _ = json.Marshal(envelope)
	if _, err := SelectWindowResource(raw, nil); err == nil {
		t.Fatal("counterfeit bundle selected")
	}
	historical, _ := json.Marshal(variant.Window)
	if _, err := SelectWindowResource(historical, nil); err == nil {
		t.Fatal("counterfeit historical window binding accepted")
	}
}
