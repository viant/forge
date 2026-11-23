package types

import (
	"strings"
	"testing"
)

func TestValidateResourceCollectionDeleteMarker(t *testing.T) {
	row := ResourceSchema{Type: "object", Identity: []string{"id"}, Properties: map[string]ResourceFieldSchema{
		"id": {Type: "integer"}, "remove": {Type: "boolean"},
	}}
	window := &Window{
		Schemas: map[string]ResourceSchema{
			"row":  row,
			"root": {Type: "object", Properties: map[string]ResourceFieldSchema{"rows": {Type: "array"}}},
		},
		ResourceModels: map[string]ResourceModel{
			"row": {SchemaRef: "row", Fields: map[string]ResourceFieldBinding{"id": {Write: "id"}, "remove": {Write: "toBeDeleted"}}},
			"root": {SchemaRef: "root", Fields: map[string]ResourceFieldBinding{
				"rows": {Collection: &ResourceCollectionBinding{ModelRef: "row", DeleteMarker: "remove"}},
			}},
		},
	}
	if err := ValidateResourceModelStructure(window); err != nil {
		t.Fatalf("explicit marker rejected: %v", err)
	}
	row.Properties["remove"] = ResourceFieldSchema{Type: "boolean", Default: true}
	if err := ValidateResourceModelStructure(window); err == nil || !strings.Contains(err.Error(), "without a default") {
		t.Fatalf("defaulted marker validation = %v", err)
	}
	row.Properties["remove"] = ResourceFieldSchema{Type: "boolean"}
	window.ResourceModels["row"].Fields["id"] = ResourceFieldBinding{Write: "-"}
	if err := ValidateResourceModelStructure(window); err == nil || !strings.Contains(err.Error(), "writable identity") {
		t.Fatalf("hidden deletion identity validation = %v", err)
	}
}
