package reporting

import (
	"encoding/json"
	"fmt"
	"strings"
)

type reportParameterDeclaration struct {
	Path     string
	ID       string
	Multiple bool
}

// Aliases and destination paths are declared by the approved builder, rather
// than guessed from product conventions or browser parameter names.
func reportParameterDeclarations(raw json.RawMessage) (map[string]reportParameterDeclaration, error) {
	var builder struct {
		Config struct {
			Predicates []struct {
				ID        string      `json:"id"`
				Path      string      `json:"paramPath"`
				Start     string      `json:"startParamPath"`
				End       string      `json:"endParamPath"`
				Prefill   interface{} `json:"prefill"`
				Multiple  bool        `json:"multiple"`
				EmitArray bool        `json:"emitArray"`
			} `json:"predicates"`
		} `json:"reportBuilder"`
	}
	result := map[string]reportParameterDeclaration{}
	if len(raw) == 0 {
		return result, nil
	}
	if json.Unmarshal(raw, &builder) != nil {
		return nil, fmt.Errorf("invalid report parameter schema")
	}
	add := func(alias, path string, multiple bool) error {
		if alias == "" || path == "" {
			return nil
		}
		if strings.TrimSpace(alias) != alias || strings.HasPrefix(alias, "_") {
			return fmt.Errorf("invalid report parameter alias")
		}
		d := reportParameterDeclaration{Path: path, Multiple: multiple}
		if old, ok := result[alias]; ok && old != d {
			return fmt.Errorf("ambiguous report parameter schema")
		}
		result[alias] = d
		return nil
	}
	var aliases func(interface{}, string, bool) error
	aliases = func(value interface{}, path string, multiple bool) error {
		switch value := value.(type) {
		case string:
			return add(value, path, multiple)
		case []interface{}:
			for _, v := range value {
				if err := aliases(v, path, multiple); err != nil {
					return err
				}
			}
		}
		return nil
	}
	for _, p := range builder.Config.Predicates {
		if err := add(p.ID, p.Path, p.Multiple || p.EmitArray); err != nil {
			return nil, err
		}
		switch v := p.Prefill.(type) {
		case map[string]interface{}:
			if err := aliases(v["start"], p.Start, false); err != nil {
				return nil, err
			}
			if err := aliases(v["end"], p.End, false); err != nil {
				return nil, err
			}
		default:
			if err := aliases(v, p.Path, p.Multiple || p.EmitArray); err != nil {
				return nil, err
			}
		}
		for alias, d := range result {
			if d.ID == "" && (d.Path == p.Path || d.Path == p.Start || d.Path == p.End) {
				d.ID = p.ID
				result[alias] = d
			}
		}
	}
	return result, nil
}
func setReportParameterPath(args map[string]interface{}, path string, value interface{}) error {
	parts := strings.Split(path, ".")
	if len(parts) == 0 || parts[0] == "backend" || parts[0] == "source" || parts[0] == "service" || parts[0] == "method" {
		return fmt.Errorf("invalid report parameter destination")
	}
	target := args
	for i, part := range parts {
		if part == "" || strings.HasPrefix(part, "_") {
			return fmt.Errorf("invalid report parameter path")
		}
		for _, c := range part {
			if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_') {
				return fmt.Errorf("invalid report parameter path")
			}
		}
		if i == len(parts)-1 {
			target[part] = value
			break
		}
		next, ok := target[part].(map[string]interface{})
		if target[part] != nil && !ok {
			return fmt.Errorf("report parameter path conflicts")
		}
		if !ok {
			next = map[string]interface{}{}
			target[part] = next
		}
		target = next
	}
	return nil
}

type reportExecutionDatasetScope struct {
	Mode              string                 `json:"mode"`
	Exclude           []string               `json:"exclude"`
	Local             map[string]interface{} `json:"local"`
	RelativeDateRange *struct {
		StartPath string `json:"startParamPath"`
		EndPath   string `json:"endParamPath"`
	} `json:"relativeDateRange"`
}

func (scope *reportExecutionDatasetScope) preserves(declaration reportParameterDeclaration) bool {
	if scope == nil {
		return false
	}
	if scope.Mode == "override" {
		return true
	}
	for _, id := range scope.Exclude {
		if id == declaration.ID {
			return true
		}
	}
	if scope.RelativeDateRange != nil && (declaration.Path == scope.RelativeDateRange.StartPath || declaration.Path == scope.RelativeDateRange.EndPath) {
		return true
	}
	_, local := scope.Local[declaration.ID]
	return local
}
