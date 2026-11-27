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
