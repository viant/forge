package types

import (
    "sort"
    "strings"
)

// JSONSchemaToFormFields converts the small subset of a draft-07 JSON-Schema
// supported by Forge into a deterministic slice of FormField objects that can
// be consumed by the runtime UI layer (SchemaBasedForm on the frontend).
//
// The implementation intentionally mirrors utils/schema.js (jsonSchemaToFields)
// to guarantee identical ordering and widget inference between backend and
// frontend.  Only the minimal set of keywords required by the UI is taken into
// account – everything else is ignored.
func JSONSchemaToFormFields(schema JSONSchema) []FormField {
    if (schema.Type != "object" && (schema.Type == "" || len(schema.Properties) == 0)) {
        return nil
    }

    // ---------------------------------------------------------------------
    // Stable key order – explicit x-ui-order first, then alphabetically.
    // ---------------------------------------------------------------------
    keys := make([]string, 0, len(schema.Properties))
    for k := range schema.Properties {
        keys = append(keys, k)
    }

    sort.Slice(keys, func(i, j int) bool {
        a, b := schema.Properties[keys[i]], schema.Properties[keys[j]]

        if a.UIOrder != b.UIOrder {
            return a.UIOrder < b.UIOrder
        }
        return keys[i] < keys[j]
    })

    requiredSet := map[string]struct{}{}
    for _, k := range schema.Required {
        requiredSet[k] = struct{}{}
    }

    makeLabel := func(key string, prop SchemaProperty) string {
        if strings.TrimSpace(prop.Title) != "" {
            return prop.Title
        }
        if strings.TrimSpace(prop.Description) != "" {
            return prop.Description
        }
        // prettify key: snake_case / kebab-case / camelCase ➜ "Camel Case"
        key = strings.ReplaceAll(key, "_", " ")
        key = strings.ReplaceAll(key, "-", " ")
        // camelCase split: insert space between lower→upper boundary
        var out []rune
        for i, r := range key {
            if i > 0 && r >= 'A' && r <= 'Z' && out[len(out)-1] >= 'a' && out[len(out)-1] <= 'z' {
                out = append(out, ' ')
            }
            out = append(out, r)
        }
        res := string(out)
        if len(res) > 0 {
            res = strings.ToUpper(res[:1]) + res[1:]
        }
        return res
    }

    // Helper replicating widget inference rules from frontend.
    inferWidget := func(key string, prop SchemaProperty) string {
        // 1. explicit override
        if prop.UIWidget != "" {
            // normalize deprecated aliases
            if prop.UIWidget == "text-area" {
                return "textarea"
            }
            if prop.UIWidget == "key-value-editor" {
                return "object"
            }
            return prop.UIWidget
        }

        // 2. format specific mapping
        switch prop.Format {
        case "uri":
            if s, ok := prop.Default.(string); !ok || !(strings.HasPrefix(strings.ToLower(s), "http")) {
                return "file"
            }
        case "password":
            return "password"
        case "date":
            return "date"
        case "date-time", "datetime":
            return "datetime"
        case "json":
            return "object"
        }

        // 3. enum mapping
        if len(prop.Enum) > 0 {
            return "select"
        }

        // 4. fallback by primitive type
        switch prop.Type {
        case "boolean":
            return "checkbox"
        case "number", "integer":
            return "number"
        case "string":
            d := strings.ToLower(prop.Description)
            if strings.HasSuffix(d, "file") || strings.HasSuffix(strings.ToLower(key), "_file") {
                return "file"
            }
            return "text"
        case "object":
            return "object"
        case "array":
            return "object"
        case "schema":
            return "schema"
        case "password":
            return "password"
        default:
            return "text"
        }
    }

    fields := make([]FormField, 0, len(keys))
    for _, k := range keys {
        prop := schema.Properties[k]

        _, isReq := requiredSet[k]

        field := FormField{
            Name:     k,
            Label:    makeLabel(k, prop),
            Type:     prop.Type,
            Required: isReq,
            Enum:     prop.Enum,
            Default:  prop.Default,
            Widget:   inferWidget(k, prop),
            Group:    prop.UIGroup,
            Order:    prop.UIOrder,
        }

        // Convert enum to options for select-like widgets – keep raw enum for now.

        fields = append(fields, field)
    }

    return fields
}
