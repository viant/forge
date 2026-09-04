package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestColumnRetainsIconFromValue(t *testing.T) {
	var actual Column
	if err := yaml.Unmarshal([]byte("id: watching\ntype: button\niconFromValue: true\n"), &actual); err != nil {
		t.Fatal(err)
	}
	if !actual.IconFromValue {
		t.Fatal("iconFromValue was not retained")
	}
	payload, err := json.Marshal(actual)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"iconFromValue":true`) {
		t.Fatalf("iconFromValue missing from JSON: %s", payload)
	}
}
