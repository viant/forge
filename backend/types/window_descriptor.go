package types

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

	identity "github.com/viant/agently-core/protocol/resource"
)

// CanonicalWindowDescriptor makes new bundle descriptor hashes independent of
// object-key ordering introduced by native MCP argument maps. It preserves
// numeric precision; historical singleton bytes retain their original hashes.
func CanonicalWindowDescriptor(raw json.RawMessage) (json.RawMessage, error) {
	strict := json.NewDecoder(bytes.NewReader(raw))
	strict.UseNumber()
	if err := uniqueWindowJSON(strict, 0); err != nil {
		return nil, err
	}
	if _, err := strict.Token(); err != io.EOF {
		return nil, fmt.Errorf("invalid trailing descriptor JSON")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var object map[string]interface{}
	if decoder.Decode(&object) != nil || object == nil || decoder.Decode(new(any)) != io.EOF {
		return nil, fmt.Errorf("window descriptor must be a JSON object")
	}
	return json.Marshal(object)
}

func uniqueWindowJSON(decoder *json.Decoder, depth int) error {
	if depth > 128 {
		return fmt.Errorf("descriptor JSON nesting exceeds limit")
	}
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	delimiter, container := token.(json.Delim)
	if !container {
		return nil
	}
	switch delimiter {
	case '{':
		seen := map[string]bool{}
		for decoder.More() {
			token, err := decoder.Token()
			if err != nil {
				return err
			}
			key, ok := token.(string)
			if !ok || seen[key] {
				return fmt.Errorf("duplicate/invalid descriptor key")
			}
			seen[key] = true
			if err := uniqueWindowJSON(decoder, depth+1); err != nil {
				return err
			}
		}
		end, err := decoder.Token()
		if err != nil || end != json.Delim('}') {
			return fmt.Errorf("invalid descriptor object")
		}
	case '[':
		for decoder.More() {
			if err := uniqueWindowJSON(decoder, depth+1); err != nil {
				return err
			}
		}
		end, err := decoder.Token()
		if err != nil || end != json.Delim(']') {
			return fmt.Errorf("invalid descriptor array")
		}
	default:
		return fmt.Errorf("invalid descriptor JSON")
	}
	return nil
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
