package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestTableDensitySurvivesYAMLAndJSON(t *testing.T) {
	var container Container
	if err := yaml.Unmarshal([]byte(`
id: fees
table:
  density: compact
  columns:
    - {id: id, name: ID}
`), &container); err != nil {
		t.Fatal(err)
	}
	if container.Table == nil || container.Table.Density != "compact" {
		t.Fatalf("table density was not decoded: %#v", container.Table)
	}
	encoded, err := json.Marshal(&container)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) == "" || !json.Valid(encoded) {
		t.Fatalf("invalid JSON: %s", encoded)
	}
	var roundTrip Container
	if err := json.Unmarshal(encoded, &roundTrip); err != nil {
		t.Fatal(err)
	}
	if roundTrip.Table == nil || roundTrip.Table.Density != "compact" {
		t.Fatalf("table density was not preserved: %#v", roundTrip.Table)
	}
}
