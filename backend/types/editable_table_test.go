package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestEditableTableMetadataRoundTrip(t *testing.T) {
	data := []byte(`
id: childRows
kind: dashboard.editableTable
allowAdd: true
allowRemove: false
quickFilter: false
minRows: 1
pageSize: 10
addRow:
  label: Add Row
  deriveHandler: Workspace.nextRow
  defaults: {effectiveAt: '', threshold: null}
columns:
  - key: effectiveAt
    label: Effective At
    frozen: true
    editor: {type: date}
  - key: quantity
    label: Quantity
    visibleWhen: {source: authorization, field: principal.features, contains: QUANTITY}
    editor: {type: number, disabledWhen: {source: row, field: enabled, equals: false}}
`)
	var container Container
	if err := yaml.Unmarshal(data, &container); err != nil {
		t.Fatal(err)
	}
	if container.AllowAdd == nil || !*container.AllowAdd {
		t.Fatalf("allowAdd was not retained: %#v", container.AllowAdd)
	}
	if container.AllowRemove == nil || *container.AllowRemove {
		t.Fatalf("explicit allowRemove:false was not retained: %#v", container.AllowRemove)
	}
	if container.QuickFilter == nil || *container.QuickFilter {
		t.Fatalf("explicit quickFilter:false was not retained: %#v", container.QuickFilter)
	}
	if len(container.Columns) != 2 || container.AddRow == nil || container.AddRow.DeriveHandler != "Workspace.nextRow" {
		t.Fatalf("editable-table contract was truncated: %#v", container)
	}
	encoded, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var output map[string]interface{}
	if err := json.Unmarshal(encoded, &output); err != nil {
		t.Fatal(err)
	}
	if value, ok := output["allowRemove"]; !ok || value != false {
		t.Fatalf("explicit false must be serialized, got %s", encoded)
	}
	if value, ok := output["quickFilter"]; !ok || value != false {
		t.Fatalf("explicit false must be serialized, got %s", encoded)
	}
}
