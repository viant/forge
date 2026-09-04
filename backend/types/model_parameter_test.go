package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestParameterRetainsExplicitOptionality(t *testing.T) {
	var actual Parameter
	if err := yaml.Unmarshal([]byte("name: AgencyId\nrequired: false\n"), &actual); err != nil {
		t.Fatal(err)
	}
	if actual.Required == nil || *actual.Required {
		t.Fatalf("required:false was not retained: %#v", actual.Required)
	}
	payload, err := json.Marshal(actual)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"required":false`) {
		t.Fatalf("required:false missing from JSON: %s", payload)
	}
}
