package fenced

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

// Parse extracts forge-report and forge-data JSON fences from markdown.
func Parse(content string) ([]Fence, error) {
	var result []Fence
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		if !strings.HasPrefix(line, "```") {
			continue
		}
		kind := strings.TrimSpace(strings.TrimPrefix(line, "```"))
		if kind != ReportFence && kind != DataFence {
			continue
		}
		start := i
		var body strings.Builder
		for i++; i < len(lines) && strings.TrimSpace(lines[i]) != "```"; i++ {
			if body.Len() > 0 {
				body.WriteByte('\n')
			}
			body.WriteString(lines[i])
		}
		if i >= len(lines) {
			return nil, fmt.Errorf("%s fence at line %d is not closed", kind, start+1)
		}
		raw := bytes.TrimSpace([]byte(body.String()))
		if len(raw) == 0 {
			return nil, fmt.Errorf("%s fence at line %d is empty", kind, start+1)
		}
		var object map[string]json.RawMessage
		if err := json.Unmarshal(raw, &object); err != nil {
			return nil, fmt.Errorf("invalid %s fence at line %d: %w", kind, start+1, err)
		}
		result = append(result, Fence{Kind: kind, Index: start, Payload: append(json.RawMessage(nil), raw...)})
	}
	return result, nil
}
