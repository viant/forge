package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestColumnExportPolicyRoundTrip(t *testing.T) {
	for _, enabled := range []string{"true", "false"} {
		var column Column
		if err := yaml.Unmarshal([]byte("id: category\nname: Category\ntype: button\nexportable: "+enabled+"\n"), &column); err != nil {
			t.Fatal(err)
		}
		if column.Exportable == nil || *column.Exportable != (enabled == "true") {
			t.Fatalf("exportable %s was not retained", enabled)
		}
		raw, err := json.Marshal(column)
		if err != nil {
			t.Fatal(err)
		}
		var decoded map[string]any
		if err = json.Unmarshal(raw, &decoded); err != nil {
			t.Fatal(err)
		}
		if value, exists := decoded["exportable"]; !exists || value != (enabled == "true") {
			t.Fatalf("wire export policy missing or changed: %s", raw)
		}
	}
	raw, err := json.Marshal(Column{ID: "action", Type: "button"})
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err = json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if _, exists := decoded["exportable"]; exists {
		t.Fatal("an unspecified policy must retain the renderer default")
	}
}
