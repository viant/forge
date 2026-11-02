package reportspec

import (
	"bytes"
	"encoding/json"
	"fmt"
)

// DatasetScope retains the open metadata admitted by both reporting schemas.
// Scope and date-window evaluation remain with the authored-report producer.
type DatasetScope struct {
	Mode                      string                     `json:"mode,omitempty"`
	InheritContext            *bool                      `json:"inheritContext,omitempty"`
	Local                     map[string]any             `json:"local,omitempty"`
	Exclude                   []string                   `json:"exclude,omitempty"`
	RelativeDateRange         *DatasetRelativeDateRange  `json:"relativeDateRange,omitempty"`
	Extensions                map[string]json.RawMessage `json:"-"`
	relativeDateRangeRaw      string
	relativeDateRangeOriginal *DatasetRelativeDateRange
}

type DatasetRelativeDateRange struct {
	Preset          string `json:"preset,omitempty"`
	StartExpression string `json:"startExpression,omitempty"`
	EndExpression   string `json:"endExpression,omitempty"`
	Format          string `json:"format,omitempty"`
	StartParamPath  string `json:"startParamPath"`
	EndParamPath    string `json:"endParamPath"`
}

func (s *DatasetScope) UnmarshalJSON(data []byte) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	if fields == nil {
		return fmt.Errorf("dataset scope must be an object")
	}
	_, modePresent := fields["mode"]
	excludeRaw, excludePresent := fields["exclude"]
	next := DatasetScope{}
	for key, destination := range map[string]any{"mode": &next.Mode, "inheritContext": &next.InheritContext, "local": &next.Local, "exclude": &next.Exclude} {
		if raw, ok := fields[key]; ok {
			if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
				return fmt.Errorf("dataset scope.%s must not be null", key)
			}
			if err := json.Unmarshal(raw, destination); err != nil {
				return fmt.Errorf("dataset scope.%s: %w", key, err)
			}
			delete(fields, key)
		}
	}
	if next.Mode != "" {
		switch next.Mode {
		case "inherit", "append", "override", "exclude":
		default:
			return fmt.Errorf("dataset scope.mode %q is not supported", next.Mode)
		}
	} else if modePresent {
		return fmt.Errorf("dataset scope.mode must be inherit, append, override or exclude")
	}
	if excludePresent {
		var entries []json.RawMessage
		if err := json.Unmarshal(excludeRaw, &entries); err != nil {
			return err
		}
		for _, entry := range entries {
			if bytes.Equal(bytes.TrimSpace(entry), []byte("null")) {
				return fmt.Errorf("dataset scope.exclude entries must be strings")
			}
		}
	}
	seen := map[string]bool{}
	for _, value := range next.Exclude {
		if seen[value] {
			return fmt.Errorf("dataset scope.exclude must contain unique entries")
		}
		seen[value] = true
	}
	if raw, ok := fields["relativeDateRange"]; ok {
		// This is an open extension, not a separately declared schema object.
		next.relativeDateRangeRaw = string(raw)
		var relativeFields map[string]json.RawMessage
		if json.Unmarshal(raw, &relativeFields) == nil && relativeFields != nil {
			next.RelativeDateRange = &DatasetRelativeDateRange{}
			for key, destination := range next.RelativeDateRange.fields() {
				_ = json.Unmarshal(relativeFields[key], destination)
			}
			original := *next.RelativeDateRange
			next.relativeDateRangeOriginal = &original
		}
		delete(fields, "relativeDateRange")
	}
	next.Extensions = fields
	*s = next
	return nil
}

func (s DatasetScope) MarshalJSON() ([]byte, error) {
	fields := map[string]json.RawMessage{}
	for key, value := range s.Extensions {
		fields[key] = value
	}
	values := map[string]any{}
	if s.Mode != "" {
		values["mode"] = s.Mode
	}
	if s.InheritContext != nil {
		values["inheritContext"] = s.InheritContext
	}
	if s.Local != nil {
		values["local"] = s.Local
	}
	if s.Exclude != nil {
		values["exclude"] = s.Exclude
	}
	if s.RelativeDateRange != nil {
		raw, err := s.marshalRelativeDateRange()
		if err != nil {
			return nil, err
		}
		values["relativeDateRange"] = json.RawMessage(raw)
	} else if s.relativeDateRangeRaw != "" && s.relativeDateRangeOriginal == nil {
		values["relativeDateRange"] = json.RawMessage(s.relativeDateRangeRaw)
	}
	for key, value := range values {
		raw, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}
		fields[key] = raw
	}
	return json.Marshal(fields)
}

func (r DatasetRelativeDateRange) values() [6]string {
	return [6]string{r.Preset, r.StartExpression, r.EndExpression, r.Format, r.StartParamPath, r.EndParamPath}
}

// fields provides typed access without adding representation state to the
// legacy comparable six-string relative-date value.
func (r *DatasetRelativeDateRange) fields() map[string]*string {
	return map[string]*string{"preset": &r.Preset, "startExpression": &r.StartExpression, "endExpression": &r.EndExpression, "format": &r.Format, "startParamPath": &r.StartParamPath, "endParamPath": &r.EndParamPath}
}

// Relative dates remain an open extension. The containing scope owns the raw
// metadata so equivalent constructed and decoded relative-date values stay equal.
func (s DatasetScope) marshalRelativeDateRange() ([]byte, error) {
	if len(s.relativeDateRangeRaw) == 0 || s.relativeDateRangeOriginal == nil {
		return json.Marshal(s.RelativeDateRange)
	}
	current := s.RelativeDateRange.values()
	if current == s.relativeDateRangeOriginal.values() {
		return []byte(s.relativeDateRangeRaw), nil
	}
	var fields map[string]json.RawMessage
	_ = json.Unmarshal([]byte(s.relativeDateRangeRaw), &fields)
	if fields == nil {
		fields = map[string]json.RawMessage{}
	}
	for i, key := range []string{"preset", "startExpression", "endExpression", "format", "startParamPath", "endParamPath"} {
		if current[i] != s.relativeDateRangeOriginal.values()[i] {
			fields[key], _ = json.Marshal(current[i])
		}
	}
	return json.Marshal(fields)
}
