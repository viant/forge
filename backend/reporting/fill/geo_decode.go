package reportfill

import (
	"bytes"
	"encoding/json"
)

// The official renderer always emits labelField; an explicit empty value uses
// each region's key as its label. A missing field still rejects malformed fills.
func (g *ResolvedGeo) UnmarshalJSON(raw []byte) error {
	type plain ResolvedGeo
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var decoded plain
	if err := decoder.Decode(&decoded); err != nil {
		return err
	}
	if err := rejectTrailingJSON(decoder, "resolvedGeo"); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return err
	}
	value, present := fields["labelField"]
	decoded.labelFieldPresent = present && string(value) != "null"
	*g = ResolvedGeo(decoded)
	return nil
}
