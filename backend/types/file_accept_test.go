package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestFileAcceptSurvivesWindowCompilation(t *testing.T) {
	var item Item
	if err := yaml.Unmarshal([]byte("id: spreadsheet\ntype: file\naccept: .xlsx\n"), &item); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	var runtime map[string]any
	if err := json.Unmarshal(raw, &runtime); err != nil {
		t.Fatal(err)
	}
	if runtime["accept"] != ".xlsx" {
		t.Fatalf("file chooser filter was lost: %s", raw)
	}
}
