package main

import (
	"go/parser"
	"reflect"
	"testing"
)

func TestSchemaPreservesNullableStringDictionaryValues(t *testing.T) {
	cases := []struct {
		expression string
		valueType  any
	}{
		{"map[string]*string", []string{"string", "null"}},
		{"map[string]string", "string"},
	}
	for _, test := range cases {
		t.Run(test.expression, func(t *testing.T) {
			expression, err := parser.ParseExpr(test.expression)
			if err != nil {
				t.Fatal(err)
			}
			want := S{
				"type": "object",
				"additionalProperties": S{
					"type": test.valueType,
				},
			}
			if actual := schema(expression, definition{}); !reflect.DeepEqual(actual, want) {
				t.Fatalf("dictionary schema = %#v, want %#v", actual, want)
			}
		})
	}
}

func TestGroupedMutationAuthoringSchema(t *testing.T) {
	originalDefinitions, originalGenerated := defs, generated
	originalLoaded, originalProvenance := loaded, provenance
	t.Cleanup(func() {
		defs, generated = originalDefinitions, originalGenerated
		loaded, provenance = originalLoaded, originalProvenance
	})
	defs, generated, loaded, provenance = map[string]definition{}, S{}, map[string]bool{}, map[string]string{}
	load("../../backend/types", "")
	ref("MutationCommand")

	command := generated["MutationCommand"].(S)["properties"].(S)
	group := command["group"].(S)
	if group["type"] != "array" || !reflect.DeepEqual(group["items"], S{"$ref": "#/$defs/MutationGroupMember"}) {
		t.Fatalf("group must be an array of authored members: %#v", group)
	}
	member := generated["MutationGroupMember"].(S)["properties"].(S)
	if len(member) != 2 || member["when"] == nil || !reflect.DeepEqual(member["command"], S{"$ref": "#/$defs/MutationCommand"}) {
		t.Fatalf("group member contains unexpected authored keys: %#v", member)
	}
	receipt := generated["ReceiptIdentity"].(S)["properties"].(S)
	for _, key := range []string{"field", "submittedValues", "submittedRows", "submittedField"} {
		if receipt[key].(S)["type"] != "string" {
			t.Errorf("receipt selector %s has incorrect type", key)
		}
	}
	if receipt["generated"].(S)["type"] != "boolean" || command["dataSourceRef"] == nil || command["before"] == nil {
		t.Fatal("existing receipt or single/ordered writer metadata changed")
	}
	for _, field := range []string{"members", "invocationId", "guarded", "writerStatus", "syncStatus", "phase"} {
		if command[field] != nil || member[field] != nil || receipt[field] != nil {
			t.Errorf("runtime state field %q leaked into the authoring schema", field)
		}
	}
}
