// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package permittedview

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"strconv"
	"strings"

	forgetypes "github.com/viant/forge/backend/types"
)

func Bind(window *forgetypes.Window, windowID, conversationID string, parameters map[string]any) (*BoundView, error) {
	return BindResource(window, windowID, conversationID, parameters, nil)
}

// BindResource extracts the requested resource identifier. Caller input is not
// permission evidence; Runtime.Apply obtains and validates the resolver snapshot.
func BindResource(window *forgetypes.Window, windowID, conversationID string, parameters, resource map[string]any) (*BoundView, error) {
	if window == nil {
		return nil, fmt.Errorf("permitted view: window is required")
	}
	result := &BoundView{
		WindowID: strings.TrimSpace(windowID), ConversationID: strings.TrimSpace(conversationID),
		Window: window, WindowForm: cloneMap(parameters), ResourceData: cloneMap(resource),
	}
	if window.Authorization == nil {
		return result, nil
	}
	spec := window.Authorization
	result.SchemaVersion = SchemaVersion(spec)
	if result.SchemaVersion != 1 && result.SchemaVersion != 2 {
		return nil, fmt.Errorf("permitted view: unsupported authorization schema version %d", result.SchemaVersion)
	}
	result.ResourceType = strings.ToLower(strings.TrimSpace(spec.ResourceType))
	if spec.Resource != nil {
		if value := strings.ToLower(strings.TrimSpace(spec.Resource.Type)); value != "" {
			result.ResourceType = value
		}
		source := strings.ToLower(strings.TrimSpace(spec.Resource.ID.Source))
		if source == "" {
			source = "windowform"
		}
		if source != "windowform" && source != "resource" {
			return nil, fmt.Errorf("permitted view: unsupported authorization resource source %q", source)
		}
		selectorRoot := parameters
		if source == "resource" {
			selectorRoot = resource
		}
		value, ok := selectValue(selectorRoot, spec.Resource.ID.Selector)
		// Window activation normally preserves declared array parameters, but
		// direct activation cards may carry a singleton resource id as a scalar.
		// Treat an explicit trailing `.0` selector as that scalar singleton; other
		// indices and unresolved paths remain fail-closed.
		if !ok && strings.HasSuffix(strings.TrimSpace(spec.Resource.ID.Selector), ".0") {
			selector := strings.TrimSuffix(strings.TrimSpace(spec.Resource.ID.Selector), ".0")
			if candidate, found := selectValue(selectorRoot, selector); found {
				kind := reflect.ValueOf(candidate)
				if kind.IsValid() && kind.Kind() != reflect.Slice && kind.Kind() != reflect.Array && kind.Kind() != reflect.Map {
					value, ok = candidate, true
				}
			}
		}
		if !ok {
			return nil, fmt.Errorf("permitted view: authorization resource selector %q was not resolved", spec.Resource.ID.Selector)
		}
		if result.SchemaVersion == 2 {
			id, ok := value.(string)
			if !ok || id == "" || strings.TrimSpace(id) != id {
				return nil, fmt.Errorf("permitted view: authorization resource selector %q requires an exact string ID in v2", spec.Resource.ID.Selector)
			}
			result.ResourceIDString = id
		} else {
			id, err := intValue(value)
			if err != nil || id <= 0 {
				return nil, fmt.Errorf("permitted view: authorization resource selector %q must resolve a positive integer", spec.Resource.ID.Selector)
			}
			result.ResourceID = id
		}
	}
	return result, nil
}

// Forge's schemaVersion field is additive. Reflection keeps Core buildable
// against its pinned pre-v2 Forge module while local multi-module builds use
// the new field. An older Forge decoder drops v2 metadata and cannot enable it.
func authorizationSchemaVersion(spec *forgetypes.AuthorizationSpec) int {
	if spec == nil {
		return 0
	}
	value := reflect.ValueOf(spec).Elem().FieldByName("SchemaVersion")
	if value.IsValid() && value.Kind() == reflect.Int {
		return int(value.Int())
	}
	return 0
}

// SchemaVersion returns the explicit v2 contract or the legacy v1 default.
func SchemaVersion(spec *forgetypes.AuthorizationSpec) int {
	version := authorizationSchemaVersion(spec)
	if version == 0 {
		return 1
	}
	return version
}

func ResolveRequest(bound *BoundView) (*Request, error) {
	if bound == nil || bound.Window == nil || bound.Window.Authorization == nil {
		return nil, nil
	}
	spec := bound.Window.Authorization
	if bound.ResourceType == "" {
		return nil, fmt.Errorf("permitted view: authorization resource type is required")
	}
	request := &Request{
		SchemaVersion:               bound.SchemaVersion,
		ResourceType:                bound.ResourceType,
		RequestedCapabilities:       append([]string(nil), spec.RequestedCapabilities...),
		RequestedGlobalCapabilities: append([]string(nil), spec.RequestedGlobalCapabilities...),
		IncludePrincipal:            true,
	}
	if bound.ResourceID > 0 {
		request.ResourceIDs = []int{bound.ResourceID}
	}
	if bound.ResourceIDString != "" {
		request.StringResourceIDs = []string{bound.ResourceIDString}
	}
	return request, nil
}

func selectValue(root any, selector string) (any, bool) {
	current := root
	for _, part := range strings.Split(strings.TrimSpace(selector), ".") {
		if part == "" {
			continue
		}
		switch actual := current.(type) {
		case map[string]any:
			var ok bool
			current, ok = actual[part]
			if !ok {
				return nil, false
			}
		case []any:
			index, err := strconv.Atoi(part)
			if err != nil || index < 0 || index >= len(actual) {
				return nil, false
			}
			current = actual[index]
		case []int:
			index, err := strconv.Atoi(part)
			if err != nil || index < 0 || index >= len(actual) {
				return nil, false
			}
			current = actual[index]
		default:
			value := reflect.ValueOf(current)
			if value.Kind() != reflect.Slice && value.Kind() != reflect.Array {
				return nil, false
			}
			index, err := strconv.Atoi(part)
			if err != nil || index < 0 || index >= value.Len() {
				return nil, false
			}
			current = value.Index(index).Interface()
		}
	}
	return current, true
}

func intValue(value any) (int, error) {
	maxInt := int64(^uint(0) >> 1)
	minInt := -maxInt - 1
	const maxSafeID = int64(1<<53 - 1)
	switch actual := value.(type) {
	case int:
		if int64(actual) > maxSafeID || int64(actual) < -maxSafeID {
			return 0, fmt.Errorf("unsafe integer value")
		}
		return actual, nil
	case int64:
		if actual > maxInt || actual < minInt || actual > maxSafeID || actual < -maxSafeID {
			return 0, fmt.Errorf("unsafe integer value")
		}
		return int(actual), nil
	case float64:
		if math.IsNaN(actual) || math.IsInf(actual, 0) || math.Trunc(actual) != actual || math.Abs(actual) > 1<<53-1 || actual > float64(maxInt) || actual < float64(minInt) {
			return 0, fmt.Errorf("unsafe integer value")
		}
		return int(actual), nil
	case json.Number:
		return exactJSONInteger(actual)
	case jsonNumber:
		parsed, err := strconv.Atoi(string(actual))
		if err == nil && (int64(parsed) > maxSafeID || int64(parsed) < -maxSafeID) {
			return 0, fmt.Errorf("unsafe integer value")
		}
		return parsed, err
	case string:
		parsed, err := strconv.ParseInt(actual, 10, 64)
		if err != nil || parsed > maxSafeID || parsed < -maxSafeID || parsed > maxInt || parsed < minInt {
			return 0, fmt.Errorf("unsafe integer value")
		}
		return int(parsed), nil
	default:
		return 0, fmt.Errorf("unsupported integer value %T", value)
	}
}

// exactJSONInteger normalizes integral decimal/exponent syntax without float
// rounding or unbounded big-number allocation. The existing v1 int64 path still
// owns MaxSafeID and machine-range constraints.
func exactJSONInteger(number json.Number) (int, error) {
	text := number.String()
	if len(text) == 0 || len(text) > 256 || !json.Valid([]byte(text)) {
		return 0, fmt.Errorf("unsafe integer value")
	}
	negative := strings.HasPrefix(text, "-")
	if negative {
		text = text[1:]
	}
	exponent := int64(0)
	if index := strings.IndexAny(text, "eE"); index >= 0 {
		var err error
		exponent, err = strconv.ParseInt(text[index+1:], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("unsafe integer value")
		}
		text = text[:index]
	}
	fraction := 0
	if index := strings.IndexByte(text, '.'); index >= 0 {
		fraction = len(text) - index - 1
		text = text[:index] + text[index+1:]
	}
	for _, digit := range text {
		if digit < '0' || digit > '9' {
			return 0, fmt.Errorf("unsafe integer value")
		}
	}
	digits := strings.TrimLeft(text, "0")
	if digits == "" {
		return 0, nil
	}
	// Input length bounds every mantissa allocation. Large exponents cannot
	// describe a representable nonzero v1 integer and are rejected before scaling.
	if exponent > 1024 || exponent < -1024 {
		return 0, fmt.Errorf("unsafe integer value")
	}
	scale := exponent - int64(fraction)
	if scale >= 0 {
		if int64(len(digits))+scale > 16 {
			return 0, fmt.Errorf("unsafe integer value")
		}
		digits += strings.Repeat("0", int(scale))
	} else {
		drop := -scale
		if drop >= int64(len(digits)) {
			return 0, fmt.Errorf("unsafe integer value")
		}
		tail := digits[len(digits)-int(drop):]
		if strings.Trim(tail, "0") != "" {
			return 0, fmt.Errorf("unsafe integer value")
		}
		digits = digits[:len(digits)-int(drop)]
	}
	if negative {
		digits = "-" + digits
	}
	parsed, err := strconv.ParseInt(digits, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("unsafe integer value")
	}
	return intValue(parsed)
}

type jsonNumber string

func cloneMap(value map[string]any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	result := make(map[string]any, len(value))
	for key, item := range value {
		result[key] = item
	}
	return result
}
