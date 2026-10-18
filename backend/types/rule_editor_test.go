package types

import (
	"encoding/json"
	"gopkg.in/yaml.v3"
	"testing"
)

func TestRuleEditorMetadataRoundTrip(t *testing.T) {
	var c Container
	err := yaml.Unmarshal([]byte(`id: rules
ruleEditor:
  field: rule
  childrenField: rules
  operatorField: ruleOperatorId
  parameterField: parameterKeyId
  valueField: ruleValue
  optionsHandler: Pixel.rules
  maxValueLength: 2000
  readOnlyWhen: {source: windowForm, field: editable, notEquals: true}
  groups: [{value: 8, label: Any}]
  fields: [{value: null, label: URL, operators: [4, 5]}]
  defaultRule: {id: 0, ruleOperatorId: 4, parameterKeyId: null, ruleValue: ''}
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
	r := restored.RuleEditor
	if r == nil || r.Field != "rule" || r.OptionsHandler != "Pixel.rules" || r.MaxValueLength != 2000 || r.Fields[0].Value != nil || len(r.Fields[0].Operators) != 2 || r.ReadOnlyWhen["notEquals"] != true {
		t.Fatalf("rule editor metadata lost: %s", data)
	}
}
