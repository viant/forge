package types

import (
	"bytes"
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestWindowAuthoredTitleAndViewMetadataStrictRoundTrip(t *testing.T) {
	var window Window
	if err := yaml.Unmarshal([]byte("title: Advertisers\nnamespace: Advertiser List\nview: {content: {id: root}}\n"), &window); err != nil {
		t.Fatal(err)
	}
	if window.Title != "Advertisers" || window.Namespace != "Advertiser List" {
		t.Fatal("authored title/display namespace changed")
	}
	raw, err := json.Marshal(window)
	if err != nil {
		t.Fatal(err)
	}
	var restored Window
	if err = json.Unmarshal(raw, &restored); err != nil || restored.Title != "Advertisers" {
		t.Fatal("title roundtrip", err)
	}
	envelope := windowBundleFixture(t)
	envelope.ViewMetadata = json.RawMessage(`{"id":"original","title":"Advertisers","windowKey":"original"}`)
	raw, err = json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = SelectWindowResource(raw, nil); err != nil {
		t.Fatal("explicit owning metadata rejected", err)
	}
	var extra map[string]json.RawMessage
	_ = json.Unmarshal(raw, &extra)
	extra["undeclaredAuthority"] = json.RawMessage(`true`)
	raw, _ = json.Marshal(extra)
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var strict WindowResourceEnvelope
	if err = decoder.Decode(&strict); err == nil {
		t.Fatal("unknown envelope authority accepted")
	}
}
