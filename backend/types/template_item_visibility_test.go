package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestTemplateItemPreservesAuthoredVisibilityHint(t *testing.T) {
	const original = "id: autonomous\nfield: campaignType\noperator: eq\nvisibleWhen: {source: authorization, field: principal.features, contains: EXPOSE_AUTONOMOUS_CAMPAIGNS}\n"
	var item TemplateItem
	if err := yaml.Unmarshal([]byte(original), &item); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	var roundtrip TemplateItem
	if err = json.Unmarshal(raw, &roundtrip); err != nil {
		t.Fatal(err)
	}
	if roundtrip.ID != "autonomous" || roundtrip.VisibleWhen["source"] != "authorization" || roundtrip.VisibleWhen["field"] != "principal.features" || roundtrip.VisibleWhen["contains"] != "EXPOSE_AUTONOMOUS_CAMPAIGNS" {
		t.Fatal("authored UI hint lost")
	}
	absent, err := json.Marshal(TemplateItem{ID: "public"})
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err = json.Unmarshal(absent, &fields); err != nil {
		t.Fatal(err)
	}
	if _, present := fields["visibleWhen"]; present {
		t.Fatal("absent hint fabricated")
	}
}
