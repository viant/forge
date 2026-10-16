// Package windowyaml converts authored YAML to backend JSON without routing
// numbers through JavaScript or float64. YAML comments/styles stay in the editor CST.
package windowyaml

import (
	"encoding/json"
	"fmt"
	"gopkg.in/yaml.v3"
	"strings"
)

func JSON(source []byte) ([]byte, error) {
	var document yaml.Node
	if err := yaml.Unmarshal(source, &document); err != nil {
		return nil, err
	}
	value, err := value(&document, 0)
	if err != nil {
		return nil, err
	}
	return json.Marshal(value)
}
func value(node *yaml.Node, depth int) (interface{}, error) {
	if depth > 128 {
		return nil, fmt.Errorf("YAML nesting/alias cycle exceeds limit")
	}
	switch node.Kind {
	case yaml.DocumentNode:
		if len(node.Content) != 1 {
			return nil, fmt.Errorf("one YAML document is required")
		}
		return value(node.Content[0], depth+1)
	case yaml.AliasNode:
		return value(node.Alias, depth+1)
	case yaml.SequenceNode:
		result := make([]interface{}, len(node.Content))
		for i, child := range node.Content {
			entry, err := value(child, depth+1)
			if err != nil {
				return nil, err
			}
			result[i] = entry
		}
		return result, nil
	case yaml.MappingNode:
		result := map[string]interface{}{}
		// Merge inherited fields first; explicit keys always win, in authored order.
		for i := 0; i < len(node.Content); i += 2 {
			if node.Content[i].Tag != "!!merge" {
				continue
			}
			merged, err := value(node.Content[i+1], depth+1)
			if err != nil {
				return nil, err
			}
			maps := []interface{}{merged}
			if sequence, ok := merged.([]interface{}); ok {
				maps = sequence
			}
			for _, entry := range maps {
				fields, ok := entry.(map[string]interface{})
				if !ok {
					return nil, fmt.Errorf("YAML merge requires mappings")
				}
				for k, v := range fields {
					if _, exists := result[k]; !exists {
						result[k] = v
					}
				}
			}
		}
		explicit := map[string]bool{}
		for i := 0; i < len(node.Content); i += 2 {
			key := node.Content[i]
			if key.Tag == "!!merge" {
				continue
			}
			if key.Kind != yaml.ScalarNode || explicit[key.Value] {
				return nil, fmt.Errorf("invalid/duplicate YAML key")
			}
			explicit[key.Value] = true
			entry, err := value(node.Content[i+1], depth+1)
			if err != nil {
				return nil, err
			}
			result[key.Value] = entry
		}
		return result, nil
	case yaml.ScalarNode:
		if node.Tag == "!!float" || node.Tag == "!!int" {
			numeric := strings.ReplaceAll(node.Value, "_", "")
			numeric = strings.TrimPrefix(numeric, "+")
			if json.Valid([]byte(numeric)) {
				return json.Number(numeric), nil
			}
		}
		var scalar interface{}
		if err := node.Decode(&scalar); err != nil {
			return nil, err
		}
		return scalar, nil
	default:
		return nil, fmt.Errorf("unsupported YAML node")
	}
}
