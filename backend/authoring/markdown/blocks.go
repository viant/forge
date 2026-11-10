package markdown

import (
	"fmt"
	"strings"
)

// ExtractFences removes only explicitly named top-level fences. It shares the
// role-document fence lexer, preserving ordinary and nested literal examples.
func ExtractFences(body string, names ...string) (string, map[string][]byte, error) {
	allowed := map[string]bool{}
	for _, name := range names {
		allowed[name] = true
	}
	blocks := map[string][]byte{}
	lines := strings.Split(body, "\n")
	var output []string
	var fence byte
	length := 0
	for i := 0; i < len(lines); i++ {
		line := lines[i]
		next, nextLength := nextFence(line, fence, length)
		if fence != 0 || next == 0 {
			output = append(output, line)
			fence, length = next, nextLength
			continue
		}
		info := strings.TrimSpace(strings.TrimLeft(line, " ")[nextLength:])
		if !allowed[info] {
			output = append(output, line)
			fence, length = next, nextLength
			continue
		}
		if _, exists := blocks[info]; exists {
			return "", nil, fmt.Errorf("duplicate named fence %q", info)
		}
		end := i + 1
		for ; end < len(lines); end++ {
			if closed, _ := nextFence(lines[end], next, nextLength); closed == 0 {
				break
			}
		}
		if end == len(lines) {
			return "", nil, fmt.Errorf("unterminated %s fence", info)
		}
		blocks[info] = []byte(strings.Join(lines[i+1:end], "\n"))
		i = end
	}
	return strings.Join(output, "\n"), blocks, nil
}

// TransformText visits prose outside fenced and inline code. Transformations
// never interpret code samples or reprocess the bytes returned by transform.
func TransformText(text string, transform func(string) (string, error)) (string, error) {
	lines := strings.Split(text, "\n")
	var output, prose []string
	flush := func() error {
		if len(prose) == 0 {
			return nil
		}
		value, err := transformInlineText(strings.Join(prose, "\n"), transform)
		if err != nil {
			return err
		}
		output = append(output, value)
		prose = nil
		return nil
	}
	var fence byte
	length := 0
	for _, line := range lines {
		next, nextLength := nextFence(line, fence, length)
		literal := fence != 0 || next != 0
		fence, length = next, nextLength
		if literal {
			if err := flush(); err != nil {
				return "", err
			}
			output = append(output, line)
		} else {
			prose = append(prose, line)
		}
	}
	if err := flush(); err != nil {
		return "", err
	}
	return strings.Join(output, "\n"), nil
}

func transformInlineText(line string, transform func(string) (string, error)) (string, error) {
	var output strings.Builder
	for remaining := line; remaining != ""; {
		start := strings.IndexByte(remaining, '`')
		if start < 0 {
			value, err := transform(remaining)
			if err != nil {
				return "", err
			}
			output.WriteString(value)
			break
		}
		value, err := transform(remaining[:start])
		if err != nil {
			return "", err
		}
		output.WriteString(value)
		n := 1
		for start+n < len(remaining) && remaining[start+n] == '`' {
			n++
		}
		delimiter := remaining[start : start+n]
		end := strings.Index(remaining[start+n:], delimiter)
		if end < 0 {
			output.WriteString(remaining[start:])
			break
		}
		end += start + 2*n
		output.WriteString(remaining[start:end])
		remaining = remaining[end:]
	}
	return output.String(), nil
}
