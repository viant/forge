package datasource

import (
	"fmt"
	"reflect"
	"regexp"
	"strings"
)

// MCPMethodVariant selects a fixed, authored method when a logical argument is
// present and nonempty. It changes neither the connection nor the arguments.
type MCPMethodVariant struct {
	Method string             `json:"method" yaml:"method"`
	When   MCPMethodCondition `json:"when" yaml:"when"`
}

type MCPMethodCondition struct {
	Parameter string `json:"parameter" yaml:"parameter"`
	NonEmpty  bool   `json:"nonEmpty" yaml:"nonEmpty"`
}

var methodParameter = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// DeclaredMCPMethods validates the declaration and returns every method that
// admission must approve, including dormant variants. No caller input is used.
func (b *Backend) DeclaredMCPMethods() ([]string, error) {
	if b == nil || b.Kind != BackendMCPTool || strings.TrimSpace(b.Service) == "" || b.Service != strings.TrimSpace(b.Service) || strings.TrimSpace(b.Method) == "" || b.Method != strings.TrimSpace(b.Method) {
		return nil, fmt.Errorf("method variants require a fixed MCP tool backend")
	}
	methods := []string{b.Method}
	seen := map[string]bool{b.Method: true}
	conditions := map[string]bool{}
	for _, v := range b.MethodVariants {
		if b.Component != nil || b.Ownership != "" || b.ServerVersion != "" || strings.TrimSpace(v.Method) == "" || v.Method != strings.TrimSpace(v.Method) || !v.When.NonEmpty || !methodParameter.MatchString(v.When.Parameter) || seen[v.Method] || conditions[v.When.Parameter] {
			return nil, fmt.Errorf("invalid or ambiguous MCP method variant")
		}
		seen[v.Method] = true
		conditions[v.When.Parameter] = true
		methods = append(methods, v.Method)
	}
	return methods, nil
}

// ResolveMCPMethod chooses exactly one declaration after argument normalization.
// A selected producer error is returned by the caller; it never selects a fallback.
func (b *Backend) ResolveMCPMethod(arguments map[string]interface{}) (string, error) {
	if _, err := b.DeclaredMCPMethods(); err != nil {
		return "", err
	}
	method := b.Method
	matched := false
	for _, v := range b.MethodVariants {
		if !nonEmptyMethodArgument(arguments[v.When.Parameter]) {
			continue
		}
		if matched {
			return "", fmt.Errorf("multiple MCP method variants match")
		}
		method = v.Method
		matched = true
	}
	return method, nil
}

func nonEmptyMethodArgument(value interface{}) bool {
	if value == nil {
		return false
	}
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text) != ""
	}
	v := reflect.ValueOf(value)
	switch v.Kind() {
	case reflect.Array, reflect.Slice, reflect.Map:
		return v.Len() > 0
	case reflect.Ptr, reflect.Interface:
		return !v.IsNil() && nonEmptyMethodArgument(v.Elem().Interface())
	}
	// Zero and false are supplied scalar values, not missing arguments.
	return true
}
