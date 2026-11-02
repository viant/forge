package reportfill

import (
	"bytes"
	"encoding/json"
	"fmt"
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
	_, decoded.seriesFieldPresent = fields["seriesField"]
	_, decoded.summaryPresent = fields["summary"]
	*g = ResolvedGeo(decoded)
	return nil
}

func (s *ResolvedGeoSymbol) UnmarshalJSON(raw []byte) error {
	type plain ResolvedGeoSymbol
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var decoded plain
	if err := decoder.Decode(&decoded); err != nil {
		return err
	}
	if err := rejectTrailingJSON(decoder, "geo symbol"); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return err
	}
	for _, key := range []string{"rawValue", "displayValue", "label", "radius"} {
		value, present := fields[key]
		if !present || key != "rawValue" && string(value) == "null" {
			return fmt.Errorf("geo symbol.%s is required", key)
		}
	}
	*s = ResolvedGeoSymbol(decoded)
	return nil
}

func (r *ResolvedGeoRegion) UnmarshalJSON(raw []byte) error {
	type plain ResolvedGeoRegion
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var decoded plain
	if err := decoder.Decode(&decoded); err != nil {
		return err
	}
	if err := rejectTrailingJSON(decoder, "geo region"); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return err
	}
	_, decoded.markIDPresent = fields["markId"]
	*r = ResolvedGeoRegion(decoded)
	return nil
}
