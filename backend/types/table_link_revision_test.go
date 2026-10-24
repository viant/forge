package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestWindowTableLinkRevisionSurvivesYAMLAndCanonicalJSON(t *testing.T) {
	input := []byte("windowKey: advertiser\nview:\n  content:\n    id: campaigns\n    table:\n      columns:\n        - id: name\n          type: link\n          link: {kind: window, windowKey: campaign, revision: '4'}\n")
	var window Window
	if err := yaml.Unmarshal(input, &window); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(window)
	if err != nil {
		t.Fatal(err)
	}
	var published Window
	if err := json.Unmarshal(raw, &published); err != nil {
		t.Fatal(err)
	}
	yamlAgain, err := yaml.Marshal(published)
	if err != nil {
		t.Fatal(err)
	}
	if published.View.Content == nil || published.View.Content.Table == nil || len(published.View.Content.Table.Columns) != 1 || published.View.Content.Table.Columns[0].Link == nil || published.View.Content.Table.Columns[0].Link.Revision != "4" {
		t.Fatalf("published window lost exact child revision: %s", raw)
	}
	var reopened Window
	if err := yaml.Unmarshal(yamlAgain, &reopened); err != nil {
		t.Fatal(err)
	}
	if reopened.View.Content.Table.Columns[0].Link.Revision != "4" {
		t.Fatalf("reopened YAML lost exact child revision: %s", yamlAgain)
	}
}
