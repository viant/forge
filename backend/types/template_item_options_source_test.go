package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestTemplateItemPreservesNativeOptionsSource(t *testing.T) {
	var item TemplateItem
	if err := yaml.Unmarshal([]byte("id: ids\noperator: in\noptionsDataSourceRef: record_choices\n"), &item); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	var roundtrip TemplateItem
	if err = json.Unmarshal(data, &roundtrip); err != nil {
		t.Fatal(err)
	}
	if roundtrip.OptionsDataSourceRef != "record_choices" {
		t.Fatal("option source lost between authored YAML and runtime JSON")
	}
	absent, err := json.Marshal(TemplateItem{ID: "static"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(absent), "optionsDataSourceRef") {
		t.Fatal("static filter acquired an option source")
	}
}
