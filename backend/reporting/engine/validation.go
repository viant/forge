// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package reporting

import (
	"bytes"
	"encoding/json"
	"fmt"

	"strings"
)

func decodeCanonicalDocument(document json.RawMessage, artifactKind string) (map[string]json.RawMessage, error) {
	if len(bytes.TrimSpace(document)) == 0 {
		return nil, fmt.Errorf("invalid %s: document is required", artifactKind)
	}
	var root map[string]json.RawMessage
	if err := json.Unmarshal(document, &root); err != nil {
		return nil, fmt.Errorf("invalid %s document: %w", artifactKind, err)
	}
	return root, nil
}

func requireCanonicalFields(root map[string]json.RawMessage, artifactKind string, fields []string) error {
	for _, field := range fields {
		if len(root[field]) == 0 {
			return fmt.Errorf("invalid %s: missing %s", artifactKind, field)
		}
	}
	return nil
}

func validateCanonicalSource(raw json.RawMessage, artifactKind string) error {
	if err := requireJSONObjectForKind(raw, artifactKind, "source"); err != nil {
		return err
	}
	root, err := decodeCanonicalDocument(raw, artifactKind)
	if err != nil {
		return fmt.Errorf("invalid %s: source must be an object", artifactKind)
	}
	if err := requireCanonicalFields(root, artifactKind, []string{
		"kind",
		"containerId",
		"stateKey",
		"dataSourceRef",
	}); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["kind"], artifactKind, "source.kind", false, new(string)); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["containerId"], artifactKind, "source.containerId", false, new(string)); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["stateKey"], artifactKind, "source.stateKey", false, new(string)); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["dataSourceRef"], artifactKind, "source.dataSourceRef", false, new(string)); err != nil {
		return err
	}
	return nil
}

func validateCanonicalParameters(raw json.RawMessage, artifactKind string) error {
	if err := requireJSONObjectForKind(raw, artifactKind, "parameters"); err != nil {
		return err
	}
	root, err := decodeCanonicalDocument(raw, artifactKind)
	if err != nil {
		return fmt.Errorf("invalid %s: parameters must be an object", artifactKind)
	}
	if err := requireCanonicalFields(root, artifactKind, []string{
		"viewMode",
		"groupBy",
		"pageSize",
		"orderField",
		"orderDir",
	}); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["viewMode"], artifactKind, "parameters.viewMode", false, new(string)); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["groupBy"], artifactKind, "parameters.groupBy", true, new(string)); err != nil {
		return err
	}
	if _, err := requireIntegerAtLeast(root["pageSize"], artifactKind, "parameters.pageSize", 1); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["orderField"], artifactKind, "parameters.orderField", true, new(string)); err != nil {
		return err
	}
	var orderDir string
	if err := requireJSONStringForKind(root["orderDir"], artifactKind, "parameters.orderDir", false, &orderDir); err != nil {
		return err
	}
	switch orderDir {
	case "asc", "desc":
	default:
		return fmt.Errorf("invalid %s: parameters.orderDir must be asc or desc", artifactKind)
	}
	return nil
}

func validateCanonicalLayoutIntent(raw json.RawMessage, artifactKind string) error {
	if err := requireJSONObjectForKind(raw, artifactKind, "layoutIntent"); err != nil {
		return err
	}
	root, err := decodeCanonicalDocument(raw, artifactKind)
	if err != nil {
		return fmt.Errorf("invalid %s: layoutIntent must be an object", artifactKind)
	}
	if err := requireCanonicalFields(root, artifactKind, []string{
		"kind",
		"resultPanePosition",
		"blockOrder",
	}); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["kind"], artifactKind, "layoutIntent.kind", false, new(string)); err != nil {
		return err
	}
	if err := requireJSONStringForKind(root["resultPanePosition"], artifactKind, "layoutIntent.resultPanePosition", false, new(string)); err != nil {
		return err
	}
	if err := requireJSONArrayForKind(root["blockOrder"], artifactKind, "layoutIntent.blockOrder", true); err != nil {
		return err
	}
	if len(root["items"]) != 0 {
		if err := requireJSONArrayForKind(root["items"], artifactKind, "layoutIntent.items", true); err != nil {
			return err
		}
	}
	return nil
}

func isJSONNull(raw json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(raw), []byte("null"))
}

func requireJSONStringForKind(raw json.RawMessage, artifactKind string, field string, allowEmpty bool, target *string) error {
	if isJSONNull(raw) {
		return fmt.Errorf("invalid %s: %s must be a string", artifactKind, field)
	}
	if err := json.Unmarshal(raw, target); err != nil {
		return fmt.Errorf("invalid %s: %s must be a string", artifactKind, field)
	}
	if !allowEmpty && strings.TrimSpace(*target) == "" {
		return fmt.Errorf("invalid %s: %s must be a non-empty string", artifactKind, field)
	}
	return nil
}

func requireJSONObjectForKind(raw json.RawMessage, artifactKind string, field string) error {
	var value map[string]json.RawMessage
	if err := json.Unmarshal(raw, &value); err != nil || value == nil {
		return fmt.Errorf("invalid %s: %s must be an object", artifactKind, field)
	}
	return nil
}

func requireJSONArrayForKind(raw json.RawMessage, artifactKind string, field string, allowEmpty bool, target ...*[]json.RawMessage) error {
	var value []json.RawMessage
	if err := json.Unmarshal(raw, &value); err != nil || value == nil {
		if allowEmpty {
			return fmt.Errorf("invalid %s: %s must be an array", artifactKind, field)
		}
		return fmt.Errorf("invalid %s: %s must be a non-empty array", artifactKind, field)
	}
	if !allowEmpty && len(value) == 0 {
		return fmt.Errorf("invalid %s: %s must be a non-empty array", artifactKind, field)
	}
	if len(target) > 0 && target[0] != nil {
		*target[0] = value
	}
	return nil
}

func requireIntegerAtLeast(raw json.RawMessage, artifactKind string, field string, minimum int) (int, error) {
	if isJSONNull(raw) {
		return 0, fmt.Errorf("invalid %s: %s must be an integer", artifactKind, field)
	}
	var value int
	if err := json.Unmarshal(raw, &value); err != nil {
		return 0, fmt.Errorf("invalid %s: %s must be an integer", artifactKind, field)
	}
	if value < minimum {
		return 0, fmt.Errorf("invalid %s: %s must be >= %d", artifactKind, field, minimum)
	}
	return value, nil
}
