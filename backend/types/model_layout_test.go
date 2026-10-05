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

func TestLayoutPreservesLabelAlignment(t *testing.T) {
	var container Container
	if err := yaml.Unmarshal([]byte("layout:\n  kind: grid\n  columns: 1\n  labels:\n    mode: left\n    align: baseline\n"), &container); err != nil {
		t.Fatal(err)
	}
	if container.Layout == nil || container.Layout.Labels == nil || container.Layout.Labels.Align != "baseline" {
		t.Fatalf("label alignment was not preserved: %#v", container.Layout)
	}
	payload, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"align":"baseline"`) {
		t.Fatalf("label alignment missing from JSON: %s", payload)
	}
}

func TestLayoutPreservesAppearance(t *testing.T) {
	var container Container
	if err := yaml.Unmarshal([]byte("layout:\n  kind: grid\n  appearance: divided-sections\n  columns: 2\n"), &container); err != nil {
		t.Fatal(err)
	}
	if container.Layout == nil || container.Layout.Appearance != "divided-sections" {
		t.Fatalf("layout appearance was not preserved: %#v", container.Layout)
	}
	payload, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"appearance":"divided-sections"`) {
		t.Fatalf("layout appearance missing from JSON: %s", payload)
	}
}

func TestSchemaBasedFormPreservesFieldTracksLayout(t *testing.T) {
	var container Container
	if err := yaml.Unmarshal([]byte(`
schemaBasedForm:
  id: campaign
  layout:
    kind: grid
    appearance: field-tracks
    columns: 2
    collapseAt: phone
    labels:
      mode: top
      align: start
`), &container); err != nil {
		t.Fatal(err)
	}
	form := container.SchemaBasedForm
	if form == nil || form.Layout == nil {
		t.Fatalf("schema form layout was not preserved: %#v", form)
	}
	if form.Layout.Kind != "grid" || form.Layout.Appearance != "field-tracks" || form.Layout.Columns != 2 {
		t.Fatalf("schema form field-tracks layout was not preserved: %#v", form.Layout)
	}
	if form.Layout.CollapseAt != "phone" || form.Layout.Labels == nil || form.Layout.Labels.Mode != "top" || form.Layout.Labels.Align != "start" {
		t.Fatalf("schema form responsive label contract was not preserved: %#v", form.Layout)
	}
	payload, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	for _, fragment := range []string{
		`"appearance":"field-tracks"`,
		`"collapseAt":"phone"`,
		`"mode":"top"`,
		`"align":"start"`,
	} {
		if !strings.Contains(string(payload), fragment) {
			t.Fatalf("schema form layout field %s missing from JSON: %s", fragment, payload)
		}
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
