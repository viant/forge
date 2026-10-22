package reporting

import (
	"encoding/json"
	dsproto "github.com/viant/forge/backend/datasource/contract"
)

// Bind approved predicate aliases before lowering date-dependent datasets. This
// is an invocation-local copy after resource/dependency admission; the source,
// pin and descriptors remain unchanged. Dataset dispatch still binds and admits
// every execution argument through its ordinary path.
func bindAuthoredCompileParameters(raw json.RawMessage, parameters map[string]interface{}) (map[string]interface{}, error) {
	if len(parameters) == 0 {
		return nil, nil
	}
	var envelope map[string]interface{}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, err
	}
	builder, ok := envelope["builderDefinition"].(map[string]interface{})
	if !ok {
		return nil, nil
	}
	builderRaw, err := json.Marshal(builder)
	if err != nil {
		return nil, err
	}
	declarations, err := reportParameterDeclarations(builderRaw)
	if err != nil {
		return nil, err
	}
	approved := map[string]interface{}{}
	for key, value := range parameters {
		if _, ok := declarations[key]; ok {
			approved[key] = value
		}
	}
	if len(approved) == 0 {
		return nil, nil
	}
	config, ok := builder["reportBuilder"].(map[string]interface{})
	if !ok {
		return nil, nil
	}
	request, _ := config["request"].(map[string]interface{})
	if request == nil {
		request = map[string]interface{}{}
		config["request"] = request
	}
	base, _ := request["baseParameters"].(map[string]interface{})
	bound, err := reportDatasetArguments(base, approved, &dsproto.DataSource{}, builderRaw, nil)
	if err != nil {
		return nil, err
	}
	request["baseParameters"] = bound
	return bound, nil
}
