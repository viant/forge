package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"reflect"
	"testing"
)

func TestWindowRetainsAuthoredParameterDeclarations(t *testing.T) {
	var window Window
	raw := []byte("windowKey: arbitrary\nparameters:\n  - {name: Selected, type: 'int[]', required: true, bindTo: details.parameters.Object}\n  - {name: Parent, type: 'int[]', required: false}\n  - {name: Limit, type: integer, default: 3}\n")
	if err := yaml.Unmarshal(raw, &window); err != nil {
		t.Fatal(err)
	}
	if len(window.Parameters) != 3 || window.Parameters[0]["type"] != "int[]" || window.Parameters[0]["bindTo"] != "details.parameters.Object" || window.Parameters[1]["required"] != false || window.Parameters[2]["default"] != 3 {
		t.Fatal("authored input declarations lost")
	}
	encoded, err := json.Marshal(window)
	if err != nil {
		t.Fatal(err)
	}
	var restored Window
	if err = json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	again, err := json.Marshal(restored)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(encoded, again) {
		t.Fatal("declarations changed during canonical JSON roundtrip")
	}
}
