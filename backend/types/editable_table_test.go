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
tablePresentation:
  variant: document
  removeIcon: lucide:x
  rowDetails: {field: notes, label: Notes}
minRows: 1
pageSize: 10
addRow:
  label: Add Row
  deriveHandler: Workspace.nextRow
  defaults: {effectiveAt: '', threshold: null}
mobileCards:
  enabled: true
  titleField: effectiveAt
  metaField: threshold
  metaLabel: Threshold
  metaFormat: currency
  fields: [quantity]
  requiredFields: [quantity]
columns:
  - key: effectiveAt
    label: Effective At
    flex: true
    minWidth: 240
    frozen: true
    editor: {type: date}
  - key: quantity
    label: Quantity
    width: 104
    align: right
    cardLabel: Required Quantity
    tooltip: Quantity to allocate
    required: true
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
	if container.MobileCards == nil || !container.MobileCards.Enabled || container.MobileCards.MetaFormat != "currency" || len(container.MobileCards.RequiredFields) != 1 {
		t.Fatalf("editable-table mobile cards were truncated: %#v", container.MobileCards)
	}
	if column := container.Columns[1]; column.CardLabel != "Required Quantity" || column.Tooltip != "Quantity to allocate" || !column.Required {
		t.Fatalf("editable-table column presentation was truncated: %#v", column)
	}
	if container.TablePresentation == nil || container.TablePresentation.Variant != "document" || container.TablePresentation.RowDetails.Field != "notes" || container.TablePresentation.RemoveIcon != "lucide:x" || !container.Columns[0].Flex || container.Columns[0].MinWidth != 240 || container.Columns[1].Width != 104 || container.Columns[1].Align != "right" {
		t.Fatal("document table metadata was truncated")
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
