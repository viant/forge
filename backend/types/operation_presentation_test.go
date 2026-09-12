package types

import (
	"encoding/json"
	"testing"
)

func TestOperationPresentationRoundTrip(t *testing.T) {
	const input = `{"id":"export","icon":"export","hideLabel":false,"ariaLabel":"Export selected campaigns"}`
	var operation EditableCollectionOperation
	if err := json.Unmarshal([]byte(input), &operation); err != nil {
		t.Fatal(err)
	}
	if operation.Icon != "export" || operation.HideLabel == nil || *operation.HideLabel || operation.AriaLabel != "Export selected campaigns" {
		t.Fatalf("presentation fields lost: %+v", operation)
	}
	data, err := json.Marshal(operation)
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]interface{}
	if err = json.Unmarshal(data, &result); err != nil {
		t.Fatal(err)
	}
	if result["hideLabel"] != false || result["icon"] != "export" {
		t.Fatalf("serialized presentation lost: %s", data)
	}
}

func TestMutationCommandClassName(t *testing.T) {
	var command MutationCommand
	if err := json.Unmarshal([]byte(`{"className":"forge-action-icon","hideLabel":true,"icon":"undo"}`), &command); err != nil {
		t.Fatal(err)
	}
	if command.ClassName != "forge-action-icon" || !command.HideLabel {
		t.Fatalf("presentation lost: %+v", command)
	}
	data, err := json.Marshal(command)
	if err != nil {
		t.Fatal(err)
	}
	var output map[string]interface{}
	if err = json.Unmarshal(data, &output); err != nil {
		t.Fatal(err)
	}
	if output["className"] != "forge-action-icon" {
		t.Fatalf("class lost: %s", data)
	}
}

func TestTableRowSlotsRoundTrip(t *testing.T) {
	var table Table
	if err := json.Unmarshal([]byte(`{"minRows":10,"rowHeight":32,"columns":[]}`), &table); err != nil {
		t.Fatal(err)
	}
	if table.MinRows != 10 || table.RowHeight != 32 {
		t.Fatalf("row slots lost: %+v", table)
	}
	data, err := json.Marshal(table)
	if err != nil {
		t.Fatal(err)
	}
	var copy Table
	if err = json.Unmarshal(data, &copy); err != nil {
		t.Fatal(err)
	}
	if copy.MinRows != 10 || copy.RowHeight != 32 {
		t.Fatalf("round trip lost: %s", data)
	}
}
