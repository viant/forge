package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestTableSelectionControlsPreserveExplicitFalse(t *testing.T) {
	container := &Container{}
	if err := yaml.Unmarshal([]byte(`
id: readOnlyFees
table:
  selectionEnabled: false
  selectionVisibleWhen: {source: authorization, field: resource.capabilities.write, equals: true}
  columns: [{id: name, name: Name, showFullContent: false}]
`), container); err != nil {
		t.Fatalf("decode table selection controls: %v", err)
	}
	if container.Table == nil || container.Table.SelectionEnabled == nil || *container.Table.SelectionEnabled {
		t.Fatalf("explicit selectionEnabled:false was not preserved: %#v", container.Table)
	}
	if container.Table.SelectionVisibleWhen["source"] != "authorization" {
		t.Fatalf("selection visibility predicate was not preserved: %#v", container.Table.SelectionVisibleWhen)
	}
	if container.Table.Columns[0].ShowFullContent == nil || *container.Table.Columns[0].ShowFullContent {
		t.Fatalf("explicit showFullContent:false was not preserved: %#v", container.Table.Columns[0])
	}
	payload, err := json.Marshal(container)
	if err != nil {
		t.Fatalf("encode table selection controls: %v", err)
	}
	encoded := string(payload)
	if !strings.Contains(encoded, `"selectionEnabled":false`) || !strings.Contains(encoded, `"selectionVisibleWhen"`) || !strings.Contains(encoded, `"showFullContent":false`) {
		t.Fatalf("table selection controls were dropped from JSON: %s", encoded)
	}
}
