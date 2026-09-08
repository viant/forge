package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestOptionPreservesDisabledAndTooltip(t *testing.T) {
	item := &Item{}
	if err := yaml.Unmarshal([]byte(`
id: flightMode
options:
  - {value: campaign, label: Campaign Flights, disabled: true, tooltip: Add after creation}
  - {value: orders, label: Order Flights}
`), item); err != nil {
		t.Fatalf("decode item options: %v", err)
	}
	if len(item.Options) != 2 || !item.Options[0].Disabled || item.Options[0].Tooltip != "Add after creation" {
		t.Fatalf("disabled option metadata was not preserved: %#v", item.Options)
	}
	payload, err := json.Marshal(item)
	if err != nil {
		t.Fatalf("encode item options: %v", err)
	}
	encoded := string(payload)
	if !strings.Contains(encoded, `"disabled":true`) || !strings.Contains(encoded, `"tooltip":"Add after creation"`) {
		t.Fatalf("disabled option metadata was dropped from JSON: %s", encoded)
	}
}
