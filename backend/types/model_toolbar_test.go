package types

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestToolbarItemRetainsDirtyValue(t *testing.T) {
	var actual Item
	if err := yaml.Unmarshal([]byte(`
id: mutationStatus
type: status
dataField: mutationMessage
dirtyValue: Unsaved changes
`), &actual); err != nil {
		t.Fatalf("unmarshal toolbar item: %v", err)
	}
	if actual.DirtyValue != "Unsaved changes" {
		t.Fatalf("dirtyValue was not retained: %#v", actual.DirtyValue)
	}
	payload, err := json.Marshal(actual)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(payload), `"dirtyValue":"Unsaved changes"`) {
		t.Fatalf("dirtyValue missing from JSON: %s", payload)
	}
}

func TestToolbarCheckboxRetainsBindingAndStateRules(t *testing.T) {
	var actual Item
	if err := yaml.Unmarshal([]byte(`
id: activeOnly
type: checkbox
scope: windowForm
dataSourceRef: campaignLines
dataField: filters.activeOnly
label: Active only
ariaLabel: Show active lines only
readOnlyWhen: {source: windowForm, field: locked, equals: true}
disabledWhen: {source: windowForm, field: loading, equals: true}
on:
  - {event: onChange, handler: lines.refresh}
`), &actual); err != nil {
		t.Fatalf("unmarshal toolbar checkbox: %v", err)
	}
	if actual.Type != "checkbox" || actual.Scope != "windowForm" || actual.DataSourceRef != "campaignLines" || actual.DataField != "filters.activeOnly" {
		t.Fatalf("checkbox binding was not retained: %#v", actual)
	}
	if actual.AriaLabel != "Show active lines only" || actual.ReadOnlyWhen["source"] != "windowForm" || actual.DisabledWhen["source"] != "windowForm" {
		t.Fatalf("checkbox accessibility/state rules were not retained: %#v", actual)
	}
	if len(actual.On) != 1 || actual.On[0].Event != "onChange" || actual.On[0].Handler != "lines.refresh" {
		t.Fatalf("checkbox onChange was not retained: %#v", actual.On)
	}
	payload, err := json.Marshal(actual)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{`"type":"checkbox"`, `"scope":"windowForm"`, `"dataSourceRef":"campaignLines"`, `"dataField":"filters.activeOnly"`, `"readOnlyWhen"`, `"disabledWhen"`, `"onChange"`} {
		if !strings.Contains(string(payload), expected) {
			t.Fatalf("%s missing from checkbox JSON: %s", expected, payload)
		}
	}
}
