package types

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

	identity "github.com/viant/forge/backend/resource"
)

// CanonicalWindowDescriptor makes new bundle descriptor hashes independent of
// object-key ordering introduced by native MCP argument maps. It preserves
// numeric precision; historical singleton bytes retain their original hashes.
func CanonicalWindowDescriptor(raw json.RawMessage) (json.RawMessage, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	value, err := decodeUniqueWindowJSON(decoder, 0)
	if err != nil {
		return nil, err
	}
	if _, err := decoder.Token(); err != io.EOF {
		return nil, fmt.Errorf("invalid trailing descriptor JSON")
	}
	object, ok := value.(map[string]interface{})
	if !ok || object == nil {
		return nil, fmt.Errorf("window descriptor must be a JSON object")
	}
	return json.Marshal(object)
}

// Build the canonical value during duplicate-key validation rather than
// tokenizing the complete descriptor and then decoding it a second time.
func decodeUniqueWindowJSON(decoder *json.Decoder, depth int) (interface{}, error) {
	if depth > 128 {
		return nil, fmt.Errorf("descriptor JSON nesting exceeds limit")
	}
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	delimiter, container := token.(json.Delim)
	if !container {
		return token, nil
	}
	switch delimiter {
	case '{':
		object := map[string]interface{}{}
		for decoder.More() {
			token, err := decoder.Token()
			if err != nil {
				return nil, err
			}
			key, ok := token.(string)
			if !ok {
				return nil, fmt.Errorf("invalid descriptor key")
			}
			if _, exists := object[key]; exists {
				return nil, fmt.Errorf("duplicate descriptor key")
			}
			value, err := decodeUniqueWindowJSON(decoder, depth+1)
			if err != nil {
				return nil, err
			}
			object[key] = value
		}
		end, err := decoder.Token()
		if err != nil || end != json.Delim('}') {
			return nil, fmt.Errorf("invalid descriptor object")
		}
		return object, nil
	case '[':
		values := []interface{}{}
		for decoder.More() {
			value, err := decodeUniqueWindowJSON(decoder, depth+1)
			if err != nil {
				return nil, err
			}
			values = append(values, value)
		}
		end, err := decoder.Token()
		if err != nil || end != json.Delim(']') {
			return nil, fmt.Errorf("invalid descriptor array")
		}
		return values, nil
	default:
		return nil, fmt.Errorf("invalid descriptor JSON")
	}
}
func WindowDescriptorFingerprint(raw json.RawMessage) (string, error) {
	canonical, err := CanonicalWindowDescriptor(raw)
	if err != nil {
		return "", err
	}
	return identity.ContentFingerprint(canonical), nil
}
func WindowVariantFingerprint(variant WindowResourceVariant) (string, error) {
	copy := variant
	if variant.Window != nil {
		window := *variant.Window
		window.SelectionBinding = nil
		copy.Window = &window
	}
	copy.DataSources = make(map[string]json.RawMessage, len(variant.DataSources))
	for id, raw := range variant.DataSources {
		canonical, err := CanonicalWindowDescriptor(raw)
		if err != nil {
			return "", err
		}
		copy.DataSources[id] = canonical
	}
	raw, err := json.Marshal(copy)
	if err != nil {
		return "", err
	}
	return identity.ContentFingerprint(raw), nil
}
