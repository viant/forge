package types

import (
	"math"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestResourceInvariantSchemaAdmission(t *testing.T) {
	const source = `
schemas:
  range:
    type: object
    properties:
      kind: {type: string}
      lower: {type: number}
      upper: {type: number}
    invariants:
      - when: {field: kind, in: [bounded]}
        assert:
          all:
            - {field: lower, gte: 0, lte: 100}
            - {not: {field: upper, empty: true}}
        path: lower
        message: Enter both range limits.
  wrapper:
    type: object
    properties:
      selected: {$ref: range}
      rows:
        type: array
        items:
          type: object
          properties: {enabled: {type: boolean}, code: {type: string}}
          invariants:
            - when: {field: enabled, equals: true}
              assert: {field: code, notEmpty: true}
              message: A code is required.
    invariants:
      - assert: {any: [{field: selected.upper, gteField: selected.lower}, {field: rows.0.enabled, equals: false}]}
        message: Select a range or disable the first row.
`
	var window Window
	if err := yaml.Unmarshal([]byte(source), &window); err != nil {
		t.Fatal(err)
	}
	if err := ValidateResourceModels(&window); err != nil {
		t.Fatal(err)
	}
	if len(window.Schemas["wrapper"].Properties["rows"].Items.Invariants) != 1 {
		t.Fatal("lost inline array-item invariant")
	}

	for _, tc := range []struct {
		name      string
		condition map[string]any
	}{
		{"missing condition", nil},
		{"missing peer", map[string]any{"field": "selected.upper", "gteField": "missing"}},
		{"duplicate bound", map[string]any{"field": "selected.upper", "gteField": "selected.lower", "gte": 1}},
		{"unknown field", map[string]any{"field": "missing", "exists": true}},
		{"unknown nested field", map[string]any{"field": "selected.missing", "exists": true}},
		{"invalid array index", map[string]any{"field": "rows.foo.enabled", "exists": true}},
		{"external scope", map[string]any{"source": "authorization", "field": "rows", "exists": true}},
		{"unknown operator", map[string]any{"field": "rows", "length": 3}},
		{"mixed predicates", map[string]any{"field": "rows", "empty": true, "exists": true}},
		{"malformed group", map[string]any{"all": []any{}}},
		{"mixed group", map[string]any{"all": []any{map[string]any{"field": "rows", "exists": true}}, "field": "rows"}},
		{"string instead of bool", map[string]any{"field": "rows", "exists": "true"}},
		{"invalid bound", map[string]any{"field": "selected.lower", "gt": math.NaN()}},
		{"invalid choice", map[string]any{"field": "rows", "in": []any{map[string]any{"key": true}}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := Window{Schemas: map[string]ResourceSchema{"wrapper": window.Schemas["wrapper"], "range": window.Schemas["range"]}}
			s := w.Schemas["wrapper"]
			s.Invariants = []ResourceInvariant{{Assert: tc.condition, Message: "Invalid entry."}}
			w.Schemas["wrapper"] = s
			if err := ValidateResourceModels(&w); err == nil || !strings.Contains(err.Error(), "wrapper.invariants[0].assert") {
				t.Fatalf("got %v", err)
			}
		})
	}
}
