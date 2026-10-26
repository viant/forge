package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestChoiceBrowserRoundTrip(t *testing.T) {
	var c Container
	err := yaml.Unmarshal([]byte(`id: choices
choiceBrowser:
  scope: windowForm
  field: choices
  identityField: key
  selectionDisabledField: full
  navigationDisabledField: blocked
  pathField: path
  maxPathItems: 3
  detailPathField: detailsPath
  detailFields: [{field: cost, label: Cost, format: currency2, currency: EUR, emptyText: '--'}]
  readOnly: false
  disabled: false
  loadingWhen: {source: windowForm, field: loading, equals: true}
  onAction: Demo.choose
`), &c)
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(c)
	if err != nil {
		t.Fatal(err)
	}
	var restored Container
	if err = json.Unmarshal(encoded, &restored); err != nil {
		t.Fatal(err)
	}
	spec := restored.ChoiceBrowser
	if spec == nil || spec.Scope != "windowForm" || spec.MaxPathItems != 3 || spec.NavigationDisabledField != "blocked" || len(spec.DetailFields) != 1 || spec.DetailFields[0].Currency != "EUR" || spec.OnAction != "Demo.choose" {
		t.Fatalf("metadata lost: %s", encoded)
	}
	if spec.ReadOnly == nil || *spec.ReadOnly || spec.Disabled == nil || *spec.Disabled {
		t.Fatal("explicit false lost")
	}
}
