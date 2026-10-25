package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestGroupedSelectionRoundTrip(t *testing.T) {
	var container Container
	err := yaml.Unmarshal([]byte(`id: grouped
className: selected-items
groupedSelection:
  scope: windowForm
  field: draft
  sections:
    - {id: left, label: Primary, groupsField: primary, addLabel: Add targeting}
    - {id: right, label: Secondary, groupsField: secondary}
  groupIdentityField: key
  groupLabelField: caption
  itemsField: entries
  itemIdentityField: id
  itemLabelField: title
  itemDescriptionField: path
  activeGroupField: active
  collapsedField: folded
  allowRemoveGroups: false
  readOnly: false
  readOnlyWhen: {source: windowForm, field: locked, equals: true}
  onAction: Demo.editGroups
`), &container)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var restored Container
	if err = json.Unmarshal(data, &restored); err != nil {
		t.Fatal(err)
	}
	spec := restored.GroupedSelection
	if spec == nil || spec.Scope != "windowForm" || spec.Field != "draft" || len(spec.Sections) != 2 || spec.Sections[0].GroupsField != "primary" || spec.Sections[0].AddLabel != "Add targeting" || spec.ItemsField != "entries" || spec.ItemDescriptionField != "path" || spec.OnAction != "Demo.editGroups" {
		t.Fatalf("metadata truncated: %s", data)
	}
	if spec.AllowRemoveGroups == nil || *spec.AllowRemoveGroups || spec.ReadOnly == nil || *spec.ReadOnly {
		t.Fatalf("explicit false flags lost: %s", data)
	}
	if spec.ReadOnlyWhen["equals"] != true {
		t.Fatal("guard lost")
	}
}
