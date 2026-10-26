package reportfill

import (
	"bytes"
	"encoding/json"
)

// Preserve an explicit expanded state through fill/print serialization while
// retaining the renderer's collapsed default for an omitted table setting.
func (b Block) MarshalJSON() ([]byte, error) {
	type plain Block
	var collapsed *bool
	if b.Kind == "tableBlock" || b.DefaultCollapsed {
		collapsed = &b.DefaultCollapsed
	}
	return json.Marshal(struct {
		plain
		DefaultCollapsed *bool `json:"defaultCollapsed,omitempty"`
	}{plain: plain(b), DefaultCollapsed: collapsed})
}

func (b *Block) UnmarshalJSON(data []byte) error {
	type plain Block
	var header struct {
		Kind string `json:"kind"`
	}
	if err := json.Unmarshal(data, &header); err != nil {
		return err
	}
	if header.Kind != "tableBlock" {
		return json.Unmarshal(data, (*plain)(b))
	}
	var value plain
	var wire = struct {
		*plain
		DefaultCollapsed *bool `json:"defaultCollapsed,omitempty"`
	}{plain: &value}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&wire); err != nil {
		return err
	}
	*b = Block(value)
	b.DefaultCollapsed = tableDefaultCollapsed(b.Kind == "tableBlock" && b.Collapsible, wire.DefaultCollapsed)
	return nil
}

func tableDefaultCollapsed(collapsible bool, value *bool) bool {
	if value != nil {
		return *value
	}
	return collapsible
}
