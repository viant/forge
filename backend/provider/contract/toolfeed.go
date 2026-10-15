// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

const ToolfeedKind = "toolfeed"
const ToolfeedFormatVersion int64 = 1
const ToolfeedSchemaURI = "schema://agently/toolfeed/v1"

// ToolfeedDefinition is authored configuration, separate from live agently.feed
// activity and conversation instances. ID is the existing runtime feed ID;
// canonical resource identity is supplied by the containing ResourceState.URI.
// UI and data sources retain their native definition vocabulary.
type ToolfeedDefinition struct {
	ID            string                     `json:"id" yaml:"id"`
	Title         string                     `json:"title,omitempty" yaml:"title,omitempty"`
	DeveloperOnly bool                       `json:"developerOnly,omitempty" yaml:"developerOnly,omitempty"`
	Presentation  *ToolfeedPresentation      `json:"presentation,omitempty" yaml:"presentation,omitempty"`
	Match         ToolfeedMatch              `json:"match" yaml:"match"`
	Activation    ToolfeedActivation         `json:"activation,omitempty" yaml:"activation,omitempty"`
	DataSource    map[string]json.RawMessage `json:"dataSource,omitempty" yaml:"dataSource,omitempty"`
	UI            json.RawMessage            `json:"ui,omitempty" yaml:"ui,omitempty"`
}
type ToolfeedPresentation struct {
	Icon              string   `json:"icon,omitempty" yaml:"icon,omitempty"`
	Accent            string   `json:"accent,omitempty" yaml:"accent,omitempty"`
	SuppressReportIDs []string `json:"suppressReportIds,omitempty" yaml:"suppressReportIds,omitempty"`
	Target            string   `json:"target,omitempty" yaml:"target,omitempty"`
}
type ToolfeedMatch struct {
	Service string `json:"service" yaml:"service"`
	Method  string `json:"method" yaml:"method"`
}
type ToolfeedActivation struct {
	Kind    string `json:"kind,omitempty" yaml:"kind,omitempty"`
	Scope   string `json:"scope,omitempty" yaml:"scope,omitempty"`
	Service string `json:"service,omitempty" yaml:"service,omitempty"`
	Method  string `json:"method,omitempty" yaml:"method,omitempty"`
}

// DecodeToolfeedDefinition rejects unknown contract fields, including live feed
// payloads. Validation does not execute activation or grant datasource access.
func DecodeToolfeedDefinition(version int64, raw json.RawMessage) (*ToolfeedDefinition, error) {
	if version != ToolfeedFormatVersion {
		return nil, fmt.Errorf("unsupported toolfeed format")
	}
	var value ToolfeedDefinition
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}
	if decoder.Decode(new(any)) != io.EOF {
		return nil, fmt.Errorf("trailing toolfeed definition")
	}
	if strings.TrimSpace(value.ID) == "" || strings.TrimSpace(value.ID) != value.ID {
		return nil, fmt.Errorf("toolfeed runtime ID required")
	}
	object := func(raw json.RawMessage) bool {
		var v map[string]json.RawMessage
		return json.Unmarshal(raw, &v) == nil && v != nil
	}
	if len(value.UI) > 0 && !object(value.UI) {
		return nil, fmt.Errorf("toolfeed UI must be an object")
	}
	for name, source := range value.DataSource {
		if strings.TrimSpace(name) == "" || strings.TrimSpace(name) != name || !object(source) {
			return nil, fmt.Errorf("invalid toolfeed datasource")
		}
		var fields map[string]json.RawMessage
		_ = json.Unmarshal(source, &fields)
		if rawRef, exists := fields["dataSourceRef"]; exists {
			var ref string
			if json.Unmarshal(rawRef, &ref) != nil {
				return nil, fmt.Errorf("invalid toolfeed datasource reference")
			}
			if ref != "" {
				if _, found := value.DataSource[ref]; !found || ref == name {
					return nil, fmt.Errorf("unknown or self-referencing toolfeed datasource")
				}
			}
		}
	}
	return &value, nil
}
