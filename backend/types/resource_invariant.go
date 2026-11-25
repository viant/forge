package types

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"strconv"
	"strings"
)

// ResourceInvariant checks a relationship within one canonical object.
// Path is relative to that object and identifies the field to report.
type ResourceInvariant struct {
	When    map[string]any `json:"when,omitempty" yaml:"when,omitempty"`
	Assert  map[string]any `json:"assert" yaml:"assert"`
	Path    string         `json:"path,omitempty" yaml:"path,omitempty"`
	Message string         `json:"message" yaml:"message"`
}

func validateResourceInvariants(schemas map[string]ResourceSchema, properties map[string]ResourceFieldSchema, rules []ResourceInvariant, owner string) error {
	for i, rule := range rules {
		at := fmt.Sprintf("%s.invariants[%d]", owner, i)
		if strings.TrimSpace(rule.Message) == "" {
			return fmt.Errorf("%s requires a message", at)
		}
		if rule.Path != "" && !declaredInvariantField(rule.Path, properties, schemas) {
			return fmt.Errorf("%s.path references undeclared field %q", at, rule.Path)
		}
		if rule.When != nil {
			if err := validateInvariantCondition(rule.When, properties, schemas, at+".when"); err != nil {
				return err
			}
		}
		if err := validateInvariantCondition(rule.Assert, properties, schemas, at+".assert"); err != nil {
			return err
		}
	}
	return nil
}

func declaredInvariantField(selector string, properties map[string]ResourceFieldSchema, schemas map[string]ResourceSchema) bool {
	if !validResourceSelector(selector) {
		return false
	}
	field := ResourceFieldSchema{Type: "object", Properties: properties}
	for _, part := range strings.Split(selector, ".") {
		if field.Ref != "" {
			field = ResourceFieldSchema{Type: "object", Properties: schemas[field.Ref].Properties}
		}
		if strings.EqualFold(field.Type, "array") {
			n, err := strconv.ParseUint(part, 10, 32)
			if err != nil || strconv.FormatUint(n, 10) != part || field.Items == nil {
				return false
			}
			field = *field.Items
			continue
		}
		next, ok := field.Properties[part]
		if !ok {
			return false
		}
		field = next
	}
	return true
}

func validateInvariantCondition(condition map[string]any, properties map[string]ResourceFieldSchema, schemas map[string]ResourceSchema, at string) error {
	for _, group := range []string{"all", "any", "not"} {
		raw, ok := condition[group]
		if !ok {
			continue
		}
		if len(condition) != 1 {
			return fmt.Errorf("%s.%s cannot be combined with another condition key", at, group)
		}
		if group == "not" {
			child, _ := raw.(map[string]any)
			return validateInvariantCondition(child, properties, schemas, at+".not")
		}
		children := reflect.ValueOf(raw)
		if !children.IsValid() || children.Kind() != reflect.Slice || children.Len() == 0 {
			return fmt.Errorf("%s.%s requires a non-empty array of conditions", at, group)
		}
		for i := 0; i < children.Len(); i++ {
			child, _ := children.Index(i).Interface().(map[string]any)
			if err := validateInvariantCondition(child, properties, schemas, fmt.Sprintf("%s.%s[%d]", at, group, i)); err != nil {
				return err
			}
		}
		return nil
	}

	field, _ := condition["field"].(string)
	if !declaredInvariantField(field, properties, schemas) {
		return fmt.Errorf("%s references undeclared field %q", at, field)
	}
	if source, ok := condition["source"]; ok && source != "form" {
		return fmt.Errorf("%s only accepts the canonical form scope", at)
	}
	operators, bounds := 0, 0
	for key, operand := range condition {
		switch key {
		case "field", "source":
			continue
		case "gtField", "gteField", "ltField", "lteField":
			peer, ok := operand.(string)
			if !ok || !declaredInvariantField(peer, properties, schemas) {
				return fmt.Errorf("%s.%s references an undeclared peer field", at, key)
			}
			if _, both := condition[strings.TrimSuffix(key, "Field")]; both {
				return fmt.Errorf("%s.%s conflicts with a literal bound", at, key)
			}
			bounds++
		case "gt", "gte", "lt", "lte":
			if !finiteInvariantNumber(operand) {
				return fmt.Errorf("%s.%s requires a finite numeric bound", at, key)
			}
			bounds++
		case "exists", "empty", "notEmpty":
			if _, ok := operand.(bool); !ok {
				return fmt.Errorf("%s.%s requires a boolean", at, key)
			}
		case "equals", "notEquals":
			if !invariantScalar(operand) {
				return fmt.Errorf("%s.%s requires a scalar operand", at, key)
			}
		case "in":
			values := reflect.ValueOf(operand)
			if !values.IsValid() || values.Kind() != reflect.Slice || values.Len() == 0 {
				return fmt.Errorf("%s.in requires a non-empty scalar array", at)
			}
			for i := 0; i < values.Len(); i++ {
				if !invariantScalar(values.Index(i).Interface()) {
					return fmt.Errorf("%s.in[%d] requires a scalar operand", at, i)
				}
			}
		default:
			return fmt.Errorf("%s has unsupported condition key %q", at, key)
		}
		operators++
	}
	if operators == 0 || (operators > 1 && operators != bounds) {
		return fmt.Errorf("%s requires one predicate or a combination of numeric bounds", at)
	}
	return nil
}

func invariantScalar(v any) bool {
	switch v.(type) {
	case nil, string, bool:
		return true
	}
	return finiteInvariantNumber(v)
}

func finiteInvariantNumber(v any) bool {
	if value, ok := v.(json.Number); ok {
		n, err := value.Float64()
		return err == nil && !math.IsNaN(n) && !math.IsInf(n, 0)
	}
	n := reflect.ValueOf(v)
	switch n.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return true
	case reflect.Float32, reflect.Float64:
		return !math.IsInf(n.Float(), 0) && !math.IsNaN(n.Float())
	}
	return false
}
