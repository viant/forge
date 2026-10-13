package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestItemEmptyTextSurvivesWindowCompilation(t *testing.T) {
	var item Item
	if err := yaml.Unmarshal([]byte("id: budget\ntype: label\nemptyText: Not available\n"), &item); err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	var runtime map[string]interface{}
	if err = json.Unmarshal(b, &runtime); err != nil {
		t.Fatal(err)
	}
	if runtime["emptyText"] != "Not available" {
		t.Fatalf("authored empty display was lost: %s", b)
	}
}
