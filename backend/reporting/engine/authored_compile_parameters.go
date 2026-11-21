package reporting

import (
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/viant/forge/backend/reporting/internal/invocation"
)

// Bind approved predicate aliases before lowering date-dependent datasets. This
// is an invocation-local copy after resource/dependency admission; the source,
// pin and descriptors remain unchanged. Dataset dispatch still binds and admits
// every execution argument through its ordinary path.
func bindAuthoredCompileParameters(raw json.RawMessage, parameters map[string]interface{}) (map[string]interface{}, invocation.Parameters, error) {
	if len(parameters) == 0 {
		return nil, invocation.Parameters{}, nil
	}
	var envelope map[string]interface{}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, invocation.Parameters{}, err
	}
	builder, ok := envelope["builderDefinition"].(map[string]interface{})
	if !ok {
		return nil, invocation.Parameters{}, nil
	}
	builderRaw, err := json.Marshal(builder)
	if err != nil {
		return nil, invocation.Parameters{}, err
	}
	declarations, err := reportParameterDeclarations(builderRaw)
	if err != nil {
		return nil, invocation.Parameters{}, err
	}
	approved := map[string]interface{}{}
	for key, value := range parameters {
		if _, ok := declarations[key]; ok {
			approved[key] = value
		}
	}
	if len(approved) == 0 {
		return nil, invocation.Parameters{}, nil
	}
	config, ok := builder["reportBuilder"].(map[string]interface{})
	if !ok {
		return nil, invocation.Parameters{}, nil
	}
	request, _ := config["request"].(map[string]interface{})
	if request == nil {
		request = map[string]interface{}{}
		config["request"] = request
	}
	base, _ := request["baseParameters"].(map[string]interface{})
	var scope *reportExecutionDatasetScope
	if config["scope"] != nil {
		scopeJSON, scopeErr := json.Marshal(config["scope"])
		if scopeErr != nil {
			return nil, invocation.Parameters{}, scopeErr
		}
		if scopeErr = json.Unmarshal(scopeJSON, &scope); scopeErr != nil {
			return nil, invocation.Parameters{}, scopeErr
		}
	}
	if base == nil {
		base = map[string]interface{}{}
	}
	bound, err := bindReportDatasetParameters(base, approved, declarations, scope)
	if err != nil {
		return nil, invocation.Parameters{}, err
	}
	// A shared producer path cannot encode independent control values. Keep
	// admitted control identities in existing scope state, while the scoped base
	// supplies context needed before date-dependent datasets are lowered.
	state := invocation.Parameters{Values: map[string]interface{}{}, DateRanges: map[string]map[string]interface{}{}}
	for alias, value := range approved {
		declaration := declarations[alias]
		target, key := state.Values, declaration.ID
		if declaration.ValuePath != "" {
			if state.DateRanges[declaration.ID] == nil {
				state.DateRanges[declaration.ID] = map[string]interface{}{}
			}
			target, key = state.DateRanges[declaration.ID], declaration.ValuePath
		} else if declaration.Multiple {
			if _, array := value.([]interface{}); !array {
				value = []interface{}{value}
			}
		}
		if previous, exists := target[key]; exists && !reflect.DeepEqual(previous, value) {
			return nil, invocation.Parameters{}, fmt.Errorf("conflicting report parameter aliases")
		}
		target[key] = value
	}
	return bound, state, nil
}

// Only shared destinations need completion here: compiled requests can carry a
// sibling's inherited criterion when a dataset has no scopeParamOptions. The
// lowered control state owns saved/default values; an empty omitted control owns
// no criterion. Explicit invocation values remain untouched.
type authoredScopeParameter struct {
	ID    string          `json:"id"`
	Value json.RawMessage `json:"value"`
}

func authoredDatasetParameters(parameters map[string]interface{}, declarations map[string]reportParameterDeclaration, scope []authoredScopeParameter) (map[string]interface{}, map[string]bool, error) {
	provided := providedReportParameterIDs(parameters, declarations)
	sharedIDs := map[string]bool{}
	for _, declaration := range declarations {
		if declaration.Shared {
			sharedIDs[declaration.ID] = true
		}
	}
	if len(sharedIDs) == 0 {
		return parameters, provided, nil
	}
	values := map[string]interface{}{}
	for _, parameter := range scope {
		if !sharedIDs[parameter.ID] || provided[parameter.ID] || len(parameter.Value) == 0 {
			continue
		}
		var value interface{}
		if err := decodeNativeScopeJSON(parameter.Value, &value); err != nil {
			return nil, nil, err
		}
		values[parameter.ID] = value
	}
	// Preserve an existing caller representation when it has exactly the same
	// JSON value as a default, without changing ordinary conflict validation.
	wireValues := map[string]map[string]interface{}{}
	for alias, value := range parameters {
		declaration, ok := declarations[alias]
		if !ok || !declaration.Shared {
			continue
		}
		encoded, err := json.Marshal(value)
		if err != nil {
			return nil, nil, err
		}
		if wireValues[declaration.Path] == nil {
			wireValues[declaration.Path] = map[string]interface{}{}
		}
		wireValues[declaration.Path][string(encoded)] = value
	}
	var completed map[string]interface{}
	for alias, declaration := range declarations {
		if !declaration.Shared || provided[declaration.ID] {
			continue
		}
		value := values[declaration.ID]
		if declaration.ValuePath != "" {
			object, _ := value.(map[string]interface{})
			value = object[declaration.ValuePath]
		}
		empty := value == nil
		switch v := value.(type) {
		case string:
			empty = v == ""
		case []interface{}:
			empty = len(v) == 0
		case map[string]interface{}:
			empty = len(v) == 0
		}
		if empty {
			continue
		}
		encoded, err := json.Marshal(value)
		if err != nil {
			return nil, nil, err
		}
		if callerValue, ok := wireValues[declaration.Path][string(encoded)]; ok {
			value = callerValue
		}
		if completed == nil {
			completed = map[string]interface{}{}
			for key, original := range parameters {
				completed[key] = original
			}
		}
		completed[alias] = value
	}
	if completed != nil {
		parameters = completed
		provided = providedReportParameterIDs(parameters, declarations)
	}
	return parameters, provided, nil
}
