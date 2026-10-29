package reporting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"reflect"
	"strings"
	"time"

	reportspec "github.com/viant/forge/backend/reporting/spec"
	identity "github.com/viant/forge/backend/resource"
)

// Bind only controls declared by the admitted native source. The returned spec
// and parameter map belong to this invocation; the held source remains immutable.
func bindNativeScopeParameters(raw json.RawMessage, parameters map[string]interface{}) (json.RawMessage, map[string]interface{}, error) {
	var root map[string]json.RawMessage
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, nil, err
	}
	var scope reportspec.Scope
	if len(root["scope"]) == 0 {
		return raw, parameters, nil
	}
	if err := decodeNativeScopeJSON(root["scope"], &scope); err != nil {
		return nil, nil, err
	}
	var datasets []map[string]interface{}
	if err := decodeNativeScopeJSON(root["datasets"], &datasets); err != nil {
		return nil, nil, err
	}
	byID := map[string]map[string]interface{}{}
	for _, dataset := range datasets {
		if id, ok := dataset["id"].(string); ok {
			byID[id] = dataset
		}
	}
	remaining := make(map[string]interface{}, len(parameters))
	for key, value := range parameters {
		remaining[key] = value
	}
	seen, changed := map[string]bool{}, false
	for index := range scope.Params {
		param := &scope.Params[index]
		value, supplied := parameters[param.ID]
		if !supplied || !nativeScopeEditable(*param) {
			continue
		}
		if param.ID == "" || seen[param.ID] {
			return nil, nil, nativeScopeError("ambiguous control identity")
		}
		seen[param.ID] = true
		if err := validateNativeScopeValue(*param, value); err != nil {
			return nil, nil, err
		}
		param.Value = value
		for _, binding := range param.FilterBindings {
			dataset := byID[binding.DatasetRef]
			if dataset == nil || !safeNativeScopePath(binding.Path) || binding.ValuePath != "" && !safeNativeScopePath(binding.ValuePath) {
				return nil, nil, nativeScopeError("invalid filter binding")
			}
			selected := value
			for _, part := range strings.Split(binding.ValuePath, ".") {
				if binding.ValuePath == "" || value == nil {
					break
				}
				object, ok := selected.(map[string]interface{})
				if !ok {
					return nil, nil, nativeScopeError("missing bound control value")
				}
				selected, ok = object[part]
				if !ok {
					return nil, nil, nativeScopeError("missing bound control value")
				}
			}
			request, ok := dataset["request"].(map[string]interface{})
			if !ok {
				return nil, nil, nativeScopeError("missing dataset request")
			}
			if err := setNativeScopeFilterValue(request, binding.Path, selected); err != nil {
				return nil, nil, nativeScopeError("conflicting filter binding")
			}
			request["offset"] = 0
		}
		delete(remaining, param.ID)
		changed = true
	}
	if !changed {
		return raw, parameters, nil
	}
	var err error
	if root["scope"], err = json.Marshal(scope); err != nil {
		return nil, nil, err
	}
	if root["datasets"], err = json.Marshal(datasets); err != nil {
		return nil, nil, err
	}
	bound, err := json.Marshal(root)
	return bound, remaining, err
}

func nativeScopeEditable(param reportspec.ScopeParam) bool {
	if !safeNativeScopePath(param.ID) || strings.Contains(param.ID, ".") || !(param.ID[0] >= 'a' && param.ID[0] <= 'z' || param.ID[0] >= 'A' && param.ID[0] <= 'Z') {
		return false
	}
	switch param.ID {
	case "backend", "source", "service", "method", "filters", "options":
		return false
	}
	switch param.Kind {
	case "select":
		return len(param.Options) > 0
	case "integer", "number", "text", "dateRange":
		return true
	}
	return false
}

func safeNativeScopePath(path string) bool {
	if path == "" {
		return false
	}
	for _, part := range strings.Split(path, ".") {
		if part == "" || part == "constructor" || part == "prototype" || part == "__proto__" {
			return false
		}
		for index, char := range part {
			if !(char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char == '_' || index > 0 && char >= '0' && char <= '9') {
				return false
			}
		}
	}
	return true
}

// Scope bindings use the canonical native filter-path contract, including
// source fields beginning with underscores. They never address transport keys.
func setNativeScopeFilterValue(request map[string]interface{}, path string, value interface{}) error {
	if !safeNativeScopePath(path) {
		return nativeScopeError("invalid filter path")
	}
	filters, ok := request["filters"].(map[string]interface{})
	if !ok && request["filters"] != nil {
		return nativeScopeError("conflicting filters")
	}
	if filters == nil {
		filters = map[string]interface{}{}
		request["filters"] = filters
	}
	parts, target := strings.Split(path, "."), filters
	for index, part := range parts {
		if index == len(parts)-1 {
			target[part] = value
			return nil
		}
		next, ok := target[part].(map[string]interface{})
		if !ok && target[part] != nil {
			return nativeScopeError("conflicting filter path")
		}
		if next == nil {
			next = map[string]interface{}{}
			target[part] = next
		}
		target = next
	}
	return nil
}

func nativeScopeError(message string) error {
	return fmt.Errorf("%w: native report control %s", identity.ErrResource, message)
}

func decodeNativeScopeJSON(raw json.RawMessage, target interface{}) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	return decoder.Decode(target)
}

func sameNativeScopeValue(expected, actual interface{}) bool {
	left, leftNumeric := expected.(json.Number)
	right, rightNumeric := actual.(json.Number)
	if leftNumeric || rightNumeric {
		if !leftNumeric || !rightNumeric {
			return false
		}
		l, lok := new(big.Rat).SetString(string(left))
		r, rok := new(big.Rat).SetString(string(right))
		return lok && rok && l.Cmp(r) == 0
	}
	return reflect.DeepEqual(expected, actual)
}

func validateNativeScopeValue(param reportspec.ScopeParam, value interface{}) error {
	param.Value = value
	if err := reportspec.ValidateScopeParamValue(param); err != nil {
		return nativeScopeError("value is outside its declared type")
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nativeScopeError("value is invalid")
	}
	var normalized interface{}
	if decodeNativeScopeJSON(encoded, &normalized) != nil {
		return nativeScopeError("value is invalid")
	}
	if normalized == nil && !param.Required {
		return nil
	}
	switch param.Kind {
	case "select":
		values := []interface{}{normalized}
		if param.Multiple {
			var ok bool
			values, ok = normalized.([]interface{})
			if !ok {
				return nativeScopeError("requires a choice list")
			}
		}
		for _, selected := range values {
			found := false
			for _, option := range param.Options {
				raw, _ := json.Marshal(option.Value)
				var expected interface{}
				_ = decodeNativeScopeJSON(raw, &expected)
				if sameNativeScopeValue(expected, selected) {
					found = true
					break
				}
			}
			if !found {
				return nativeScopeError("choice is unavailable")
			}
		}
	case "integer", "number":
		number, ok := normalized.(json.Number)
		rational, valid := new(big.Rat).SetString(string(number))
		if !ok || !valid || param.Kind == "integer" && !rational.IsInt() {
			return nativeScopeError("requires its declared numeric type")
		}
	case "text":
		if _, ok := normalized.(string); !ok {
			return nativeScopeError("requires text")
		}
	case "dateRange":
		period, ok := normalized.(map[string]interface{})
		if !ok {
			return nativeScopeError("requires a date range")
		}
		from, fromOK := period["start"].(string)
		to, toOK := period["end"].(string)
		if !fromOK || !toOK {
			return nativeScopeError("requires date endpoints")
		}
		for _, date := range []string{from, to} {
			parsed, e := time.Parse("2006-01-02", date)
			if e != nil || parsed.Format("2006-01-02") != date {
				return nativeScopeError("requires valid date endpoints")
			}
		}
		if from > to {
			return nativeScopeError("date endpoints are reversed")
		}
	}
	return nil
}
