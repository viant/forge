package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestParameterEditorRoundTrip(t *testing.T) {
	var c Container
	err := yaml.Unmarshal([]byte(`id: parameter
parameterEditor:
  dataSourceRef: draft
  label: Input
  readOnlyWhen: {selector: canEdit, equals: false}
  fields:
    - {id: key, dataField: name, label: Name, type: text}
    - {id: source, dataField: source, label: Source, type: select, optionsDataSourceRef: sources, optionValueField: id, optionLabelField: title}
  sections:
    - id: validation
      label: Error response
      fields: [{id: code, dataField: errorCode, label: Error code, type: number}]
  draft:
    saveLabel: Save parameter
    validate: editor.validate
    submit: {commandId: save, dataSourceRef: parameter_save}
`), &c)
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(c)
	if err != nil {
		t.Fatal(err)
	}
	var restored Container
	if err = json.Unmarshal(data, &restored); err != nil {
		t.Fatal(err)
	}
	p := restored.ParameterEditor
	if p == nil || len(p.Fields) != 2 || p.Fields[1].OptionsDataSourceRef != "sources" || p.Sections[0].Fields[0].DataField != "errorCode" || p.Draft.Submit.DataSourceRef != "parameter_save" {
		t.Fatalf("metadata lost: %s", data)
	}
}
