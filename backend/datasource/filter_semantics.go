// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"strconv"
	"strings"

	"github.com/viant/forge/backend/types"
)

func normalizeFilterSemantics(inputs map[string]interface{}, ds *types.DataSource) map[string]interface{} {
	if len(inputs) == 0 {
		return inputs
	}
	if ds == nil || len(ds.FilterSet) == 0 {
		return inputs
	}

	out := make(map[string]interface{}, len(inputs))
	for k, v := range inputs {
		out[k] = v
	}

	operators := map[string]string{}
	valueTypes := map[string]string{}
	for _, set := range ds.FilterSet {
		for _, item := range set.Template {
			field := strings.TrimSpace(item.ID)
			op := strings.TrimSpace(strings.ToLower(item.Operator))
			if field == "" {
				continue
			}
			if op != "" {
				operators[field] = op
			}
			typ := strings.TrimSpace(strings.ToLower(item.Type))
			if typ != "" {
				valueTypes[field] = typ
			}
		}
	}

	for field, typ := range valueTypes {
		value, ok := out[field]
		if !ok {
			continue
		}
		if text, ok := value.(string); ok && strings.TrimSpace(text) == "" {
			delete(out, field)
			continue
		}
		switch typ {
		case "int", "integer", "number":
			if coerced, ok := coerceInt(value); ok {
				out[field] = coerced
			}
		case "string[]", "strings":
			if coerced, ok := coerceStringSlice(value); ok {
				out[field] = coerced
			}
		case "int[]", "integer[]", "number[]", "ints":
			if coerced, ok := coerceIntSlice(value); ok {
				out[field] = coerced
			}
		}
	}

	for field, op := range operators {
		if op != "contains" {
			continue
		}
		value, ok := out[field]
		if !ok {
			continue
		}
		text, ok := value.(string)
		if !ok {
			continue
		}
		text = strings.TrimSpace(text)
		if text == "" {
			delete(out, field)
			continue
		}
		if strings.Contains(text, "%") {
			continue
		}
		out[field] = "%" + text + "%"
	}
	return out
}

func coerceInt(value interface{}) (int, bool) {
	switch actual := value.(type) {
	case int:
		return actual, true
	case int8:
		return int(actual), true
	case int16:
		return int(actual), true
	case int32:
		return int(actual), true
	case int64:
		return int(actual), true
	case float32:
		return int(actual), true
	case float64:
		return int(actual), true
	case string:
		text := strings.TrimSpace(actual)
		if text == "" {
			return 0, false
		}
		parsed, err := strconv.Atoi(text)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func coerceIntSlice(value interface{}) ([]int, bool) {
	switch actual := value.(type) {
	case []int:
		return actual, true
	case []interface{}:
		result := make([]int, 0, len(actual))
		for _, item := range actual {
			parsed, ok := coerceInt(item)
			if !ok {
				return nil, false
			}
			result = append(result, parsed)
		}
		return result, true
	case string:
		text := strings.TrimSpace(actual)
		if text == "" {
			return nil, false
		}
		parts := strings.Split(text, ",")
		result := make([]int, 0, len(parts))
		for _, part := range parts {
			parsed, ok := coerceInt(part)
			if !ok {
				return nil, false
			}
			result = append(result, parsed)
		}
		return result, true
	default:
		if parsed, ok := coerceInt(actual); ok {
			return []int{parsed}, true
		}
		return nil, false
	}
}

// Preserve already typed values; comma-separated form inputs become string arrays.
func coerceStringSlice(value interface{}) ([]string, bool) {
	switch actual := value.(type) {
	case []string:
		return actual, true
	case []interface{}:
		result := make([]string, 0, len(actual))
		for _, item := range actual {
			text, ok := item.(string)
			if !ok {
				return nil, false
			}
			result = append(result, text)
		}
		return result, true
	case string:
		parts := strings.Split(actual, ",")
		result := make([]string, 0, len(parts))
		for _, part := range parts {
			text := strings.TrimSpace(part)
			if text != "" {
				result = append(result, text)
			}
		}
		return result, true
	default:
		return nil, false
	}
}
