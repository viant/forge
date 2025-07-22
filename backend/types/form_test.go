package types

import (
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestJSONSchemaToFormFields(t *testing.T) {
    testCases := []struct {
        name     string
        schema   JSONSchema
        expected []FormField
    }{
        {
            name: "basic types & alphabetical order",
            schema: JSONSchema{
                Type: "object",
                Properties: map[string]SchemaProperty{
                    "name": {
                        Type:        "string",
                        Description: "Name",
                    },
                    "age": {
                        Type:        "integer",
                        Description: "Age",
                    },
                    "active": {
                        Type:        "boolean",
                        Description: "Active?",
                    },
                },
                Required: []string{"name"},
            },
            expected: []FormField{
                {
                    Name:     "active",
                    Label:    "Active?",
                    Type:     "boolean",
                    Widget:   "checkbox",
                    Required: false,
                },
                {
                    Name:     "age",
                    Label:    "Age",
                    Type:     "integer",
                    Widget:   "number",
                    Required: false,
                },
                {
                    Name:     "name",
                    Label:    "Name",
                    Type:     "string",
                    Widget:   "text",
                    Required: true,
                },
            },
        },
        {
            name: "ui-order overrides & enum mapping",
            schema: JSONSchema{
                Type: "object",
                Properties: map[string]SchemaProperty{
                    "b": {Type: "string", UIOrder: 1, Enum: []string{"x", "y"}},
                    "a": {Type: "string", UIOrder: 2},
                    "c": {Type: "integer", UIOrder: 3},
                },
            },
            expected: []FormField{
                {Name: "b", Label: "B", Type: "string", Widget: "select", Enum: []string{"x", "y"}},
                {Name: "a", Label: "A", Type: "string", Widget: "text"},
                {Name: "c", Label: "C", Type: "integer", Widget: "number"},
            },
        },
        {
            name: "format mapping and explicit widget",
            schema: JSONSchema{
                Type: "object",
                Properties: map[string]SchemaProperty{
                    "file_ref": {Type: "string", Format: "uri"},
                    "pwd":      {Type: "string", Format: "password"},
                    "json_cfg": {Type: "string", Format: "json"},
                    "custom":   {Type: "string", UIWidget: "textarea"},
                },
            },
            expected: []FormField{
                {Name: "custom", Label: "Custom", Type: "string", Widget: "textarea"},
                {Name: "file_ref", Label: "File ref", Type: "string", Widget: "file"},
                {Name: "json_cfg", Label: "Json cfg", Type: "string", Widget: "object"},
                {Name: "pwd", Label: "Pwd", Type: "string", Widget: "password"},
            },
        },
    }

    for _, tc := range testCases {
        actual := JSONSchemaToFormFields(tc.schema)
        assert.EqualValues(t, tc.expected, actual, tc.name)
    }
}
