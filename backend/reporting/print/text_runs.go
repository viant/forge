package reportprint

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

// TextRun applies emphasis within one text element. Empty FontWeight inherits
// the element style; "normal" explicitly resets it. Newlines remain text.
type TextRun struct {
	Text       string `json:"text"`
	FontWeight string `json:"fontWeight,omitempty"`
}

func (e *Element) UnmarshalJSON(data []byte) error {
	type wire Element
	var value wire
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	if raw, found := fields["textRuns"]; found && bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return fmt.Errorf("textRuns must be an array, not null")
	}
	*e = Element(value)
	return nil
}

func (run *TextRun) UnmarshalJSON(data []byte) error {
	type wire TextRun
	var value wire
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	for _, key := range []string{"text", "fontWeight"} {
		if raw, found := fields[key]; found && bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			return fmt.Errorf("textRuns.%s must be a string, not null", key)
		}
	}
	if strings.Contains(value.Text, "\r") {
		return fmt.Errorf("textRuns require normalized LF line breaks; carriage returns are unsupported")
	}
	if value.Text == "" {
		return fmt.Errorf("textRuns.text must be nonempty")
	}
	*run = TextRun(value)
	return nil
}
