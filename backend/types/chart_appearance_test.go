package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestChartPresentationSurvivesMetadata(t *testing.T) {
	var chart Chart
	if err := yaml.Unmarshal([]byte("type: line\nappearance: document\nlayout: small-multiples\nstacked: true\n"), &chart); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(chart)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]interface{}
	if err = json.Unmarshal(encoded, &fields); err != nil {
		t.Fatal(err)
	}
	if fields["appearance"] != "document" || fields["layout"] != "small-multiples" || fields["stacked"] != true {
		t.Fatalf("presentation lost: %s", encoded)
	}
	legacy, err := json.Marshal(Chart{Type: "line"})
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(legacy, &fields); err != nil {
		t.Fatal(err)
	}
	var legacyFields map[string]interface{}
	if err = json.Unmarshal(legacy, &legacyFields); err != nil {
		t.Fatal(err)
	}
	if _, ok := legacyFields["appearance"]; ok {
		t.Fatal("legacy chart must not opt in")
	}
}
