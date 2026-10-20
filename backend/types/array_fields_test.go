package types

import (
	"encoding/json"
	"testing"
)

// Array fields travel through the existing extensible widget properties. No
// application-specific field or permissive authorization schema is added.
func TestArrayFieldsWidgetRoundtrip(t *testing.T) {
	source := []byte(`{"id":"ranges","type":"arrayFields","scope":"form","dataField":"ranges","properties":{"fields":[{"field":"start","label":"Start","type":"datetime","readHandler":"Example.readDate","writeHandler":"Example.writeDate"}],"minRows":1,"newRow":{"start":null},"rowReadOnlyWhen":{"source":"row","field":"status","in":[4]},"removeWhen":{"source":"row","field":"status","equals":3}}}`)
	var item Item
	if err := json.Unmarshal(source, &item); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	var expected, actual map[string]interface{}
	json.Unmarshal(source, &expected)
	json.Unmarshal(encoded, &actual)
	want, _ := json.Marshal(expected["properties"])
	got, _ := json.Marshal(actual["properties"])
	if string(want) != string(got) {
		t.Fatalf("widget configuration lost: %s", encoded)
	}
}
