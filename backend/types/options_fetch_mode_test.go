package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestItemPreservesOptionsFetchMode(t *testing.T) {
	var item Item
	if err := yaml.Unmarshal([]byte("id: choice\nlabel: Choice\ntype: select\noptionsDataSourceRef: choices\noptionsFetchMode: onFocus\n"), &item); err != nil {
		t.Fatal(err)
	}
	if item.OptionsFetchMode != "onFocus" || item.OptionsDataSourceRef != "choices" {
		t.Fatalf("lazy option metadata dropped: %#v", item)
	}
	data, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	var actual map[string]interface{}
	if err = json.Unmarshal(data, &actual); err != nil {
		t.Fatal(err)
	}
	if actual["optionsFetchMode"] != "onFocus" {
		t.Fatalf("native JSON lost option fetch mode: %s", data)
	}
}
