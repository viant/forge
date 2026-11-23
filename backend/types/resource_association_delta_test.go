package types

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestResourceAssociationDeltaStructure(t *testing.T) {
	const descriptor = `
schemas:
  record:
    type: object
    identity: [id]
    properties:
      id: {type: integer}
      complete: {type: boolean, readOnly: true}
      items: {type: array, items: {type: integer}}
      edits:
        type: object
        properties:
          added: {type: array, items: {type: string}}
          deleted: {type: array, items: {type: string}}
resourceModels:
  record:
    schemaRef: record
    fields:
      items: {associationDelta: {mode: diff, baselineComplete: complete, added: ids.new, deleted: ids.old}}
      edits: {associationDelta: {mode: explicit, added: labels.new, deleted: labels.old}}
`
	for _, tc := range []struct {
		name, from, to, want string
	}{
		{name: "valid pairs"},
		{"missing completeness", "baselineComplete: complete, ", "", "requires a baselineComplete path"},
		{"mode", "mode: diff", "mode: replacement", "mode must be diff or explicit"},
		{"same target", "deleted: ids.old", "deleted: ids.new", "destinations overlap"},
		{"ancestor target", "deleted: ids.old", "deleted: ids", "destinations overlap"},
		{"conflicting sibling field", "deleted: ids.old", "deleted: id.value", "destination overlaps field id"},
		{"conflicting sibling delta", "deleted: ids.old", "deleted: labels.new", "destination overlaps field"},
		{"unsafe path", "deleted: ids.old", "deleted: ids.__proto__", "requires safe added and deleted paths"},
		{"unsafe marker", "baselineComplete: complete", "baselineComplete: params..complete", "requires a baselineComplete path"},
		{"scalar write", "items: {associationDelta:", "items: {write: items, associationDelta:", "cannot combine"},
		{"required pair", "identity: [id]", "identity: [id]\n    required: [items]", "must be optional"},
		{"mixed explicit types", "deleted: {type: array, items: {type: string}}", "deleted: {type: array, items: {type: integer}}", "matching optional"},
		{"explicit completeness", "mode: explicit", "mode: explicit, baselineComplete: complete", "no baselineComplete path"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var input Window
			data := descriptor
			if tc.from != "" {
				data = strings.Replace(data, tc.from, tc.to, 1)
			}
			if err := yaml.Unmarshal([]byte(data), &input); err != nil {
				t.Fatal(err)
			}
			delta := input.ResourceModels["record"].Fields["items"].AssociationDelta
			if delta == nil {
				t.Fatal("YAML lost the associationDelta field")
			}
			err := ValidateResourceModelStructure(&input)
			if tc.want == "" {
				if err != nil {
					t.Fatal(err)
				}
			} else if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("want %q, got %v", tc.want, err)
			}
		})
	}
}
