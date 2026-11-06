package types

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"unicode"
)

// ResolveDataSourceDependencies applies the native datasource dependency
// contract used by src/components/dataSourceDependencies.js. Required inputs
// default to required; declared defaults and constants populate values/filter.
// The authored descriptor stays raw so default:null remains distinct from an
// absent default. This is activation only, never authorization or execution.
func ResolveDataSourceDependencies(descriptor json.RawMessage, values, filter map[string]any) (bool, error) {
	var declarations struct {
		Parameters []struct {
			Name     string          `json:"name"`
			From     string          `json:"from"`
			Location json.RawMessage `json:"location"`
			Default  json.RawMessage `json:"default"`
			Required *bool           `json:"required"`
		} `json:"parameters"`
		RequiredAny []string `json:"requiredAnyParameters"`
	}
	if err := json.Unmarshal(descriptor, &declarations); err != nil {
		return false, err
	}
	if len(declarations.Parameters) == 0 {
		return true, nil
	}
	decode := func(raw json.RawMessage) (any, error) {
		var value any
		if len(raw) == 0 {
			return nil, nil
		}
		d := json.NewDecoder(bytes.NewReader(raw))
		d.UseNumber()
		err := d.Decode(&value)
		return value, err
	}
	for _, parameter := range declarations.Parameters {
		if parameter.From == "const" {
			value, err := decode(parameter.Location)
			if err != nil {
				return false, err
			}
			if err = assignDependencyPath(filter, parameter.Name, value); err != nil {
				return false, err
			}
			continue
		}
		optional := parameter.Required != nil && !*parameter.Required
		if parameter.Name == "..." {
			if optional {
				continue
			}
			present := false
			for _, value := range values {
				if meaningfulDependencyValue(value) {
					present = true
					break
				}
			}
			if !present {
				return false, nil
			}
			continue
		}
		if value, exists := dependencyPathValue(values, parameter.Name); exists && meaningfulDependencyValue(value) {
			continue
		}
		if len(parameter.Default) > 0 {
			value, err := decode(parameter.Default)
			if err != nil {
				return false, err
			}
			if err = assignDependencyPath(values, parameter.Name, value); err != nil {
				return false, err
			}
			continue
		}
		if optional {
			continue
		}
		return false, nil
	}
	requiredAny := false
	for _, name := range declarations.RequiredAny {
		name = strings.TrimFunc(name, func(r rune) bool { return unicode.IsSpace(r) || r == '\ufeff' })
		if name == "" {
			continue
		}
		requiredAny = true
		if value, exists := dependencyPathValue(values, name); exists && meaningfulDependencyValue(value) {
			return true, nil
		}
	}
	return !requiredAny, nil
}

func meaningfulDependencyValue(value any) bool {
	if value == nil {
		return false
	}
	switch actual := value.(type) {
	case string:
		return strings.TrimFunc(actual, func(r rune) bool { return unicode.IsSpace(r) || r == '\ufeff' }) != ""
	}
	reflected := reflect.ValueOf(value)
	switch reflected.Kind() {
	case reflect.Slice, reflect.Array:
		for i := 0; i < reflected.Len(); i++ {
			if meaningfulDependencyValue(reflected.Index(i).Interface()) {
				return true
			}
		}
		return false
	case reflect.Map, reflect.Pointer, reflect.Interface:
		return !reflected.IsNil()
	}
	return true
}

func dependencyPathParts(path string) []string {
	return strings.FieldsFunc(path, func(r rune) bool { return r == '.' })
}
func dependencyPathValue(values map[string]any, path string) (any, bool) {
	parts := dependencyPathParts(path)
	if len(parts) == 0 {
		return nil, false
	}
	var current any = values
	for _, part := range parts {
		if current == nil {
			return nil, false
		}
		value := reflect.ValueOf(current)
		switch value.Kind() {
		case reflect.Map:
			if value.Type().Key().Kind() != reflect.String {
				return nil, false
			}
			selected := value.MapIndex(reflect.ValueOf(part).Convert(value.Type().Key()))
			if !selected.IsValid() {
				return nil, false
			}
			current = selected.Interface()
		case reflect.Slice, reflect.Array:
			index, err := strconv.Atoi(part)
			if err != nil || index < 0 || strconv.Itoa(index) != part || index >= value.Len() {
				return nil, false
			}
			current = value.Index(index).Interface()
		default:
			return nil, false
		}
	}
	return current, true
}
func assignDependencyPath(values map[string]any, path string, value any) error {
	for _, part := range strings.FieldsFunc(path, func(r rune) bool { return r == '.' || r == ':' || r == '/' }) {
		switch strings.TrimPrefix(part, "[]") {
		case "__proto__", "constructor", "prototype":
			return fmt.Errorf("unsafe dependency assignment path %q", path)
		}
	}
	parts := dependencyPathParts(path)
	if len(parts) == 0 || values == nil {
		return nil
	}
	_, err := assignDependencyValue(values, parts, value)
	return err
}

func assignDependencyValue(container any, parts []string, value any) (any, error) {
	part := parts[0]
	switch current := container.(type) {
	case []any:
		index, err := strconv.Atoi(part)
		if err != nil || index < 0 || strconv.Itoa(index) != part {
			return nil, fmt.Errorf("dependency array assignment requires an index: %q", part)
		}
		for len(current) <= index {
			current = append(current, nil)
		}
		if len(parts) == 1 {
			current[index] = value
			return current, nil
		}
		next, err := assignDependencyValue(current[index], parts[1:], value)
		if err != nil {
			return nil, err
		}
		current[index] = next
		return current, nil
	case map[string]any:
		if current == nil {
			current = map[string]any{}
		}
		if len(parts) == 1 {
			current[part] = value
			return current, nil
		}
		next, err := assignDependencyValue(current[part], parts[1:], value)
		if err != nil {
			return nil, err
		}
		current[part] = next
		return current, nil
	default:
		return assignDependencyValue(map[string]any{}, parts, value)
	}
}
