package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestLayoutPreservesResponsiveCollapseAt(t *testing.T) {
	var container Container
	if err := yaml.Unmarshal([]byte("layout:\n  kind: grid\n  columns: 4\n  collapseAt: phone\n"), &container); err != nil {
		t.Fatal(err)
	}
	if container.Layout == nil || container.Layout.CollapseAt != "phone" {
		t.Fatalf("collapseAt was not preserved: %#v", container.Layout)
	}
	payload, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"collapseAt":"phone"`) {
		t.Fatalf("collapseAt missing from JSON: %s", payload)
	}
}

func TestLayoutPreservesDisabledItemStretch(t *testing.T) {
	var container Container
	if err := yaml.Unmarshal([]byte("layout:\n  kind: grid\n  columns: 3\n  itemStretch: false\n"), &container); err != nil {
		t.Fatal(err)
	}
	if container.Layout == nil || container.Layout.ItemStretch == nil || *container.Layout.ItemStretch {
		t.Fatalf("itemStretch=false was not preserved: %#v", container.Layout)
	}
	payload, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"itemStretch":false`) {
		t.Fatalf("itemStretch=false missing from JSON: %s", payload)
	}
}

func TestItemPreservesDatasourceOptionFilters(t *testing.T) {
	var item Item
	if err := yaml.Unmarshal([]byte(`
id: criterion
optionFilter: {field: group, source: form, selector: group}
optionFilters:
  - {field: active, source: form, selector: active}
`), &item); err != nil {
		t.Fatal(err)
	}
	filter, ok := item.OptionFilter.(map[string]interface{})
	if !ok || filter["field"] != "group" {
		t.Fatalf("optionFilter was not preserved: %#v", item.OptionFilter)
	}
	filters, ok := item.OptionFilters.([]interface{})
	if !ok || len(filters) != 1 {
		t.Fatalf("optionFilters were not preserved: %#v", item.OptionFilters)
	}
	payload, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"optionFilter":{"field":"group"`) ||
		!strings.Contains(string(payload), `"optionFilters":[{"field":"active"`) {
		t.Fatalf("option filters missing from JSON: %s", payload)
	}
}

func TestColumnPreservesPressedWhenValue(t *testing.T) {
	var column Column
	if err := yaml.Unmarshal([]byte("id: watching\nname: ''\ntype: button\npressedWhenValue: star\n"), &column); err != nil {
		t.Fatal(err)
	}
	if column.PressedWhenValue != "star" {
		t.Fatalf("pressedWhenValue was not preserved: %#v", column.PressedWhenValue)
	}
	payload, err := json.Marshal(column)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"pressedWhenValue":"star"`) {
		t.Fatalf("pressedWhenValue missing from JSON: %s", payload)
	}
}
