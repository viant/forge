package markdown

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"gopkg.in/yaml.v3"
)

// MarkdownMessage is an ordered authored prompt section. Field optionally
// selects an agent prompt slot; intent/playbook messages leave it empty.
type MarkdownMessage struct {
	Role   string
	Field  string
	Engine string
	Text   string
	URI    string
}

// Message is the neutral authored role message consumed by application adapters.
type Message = MarkdownMessage

// MarkdownDocument separates ordinary YAML frontmatter from prompt messages.
// All Markdown headings remain literal content; only explicit YAML role headers
// split messages.
type MarkdownDocument struct {
	Metadata []byte
	Messages []MarkdownMessage
}

// Document is the neutral frontmatter plus ordered message result.
type Document = MarkdownDocument

func Parse(raw []byte) (Document, error) { return ParseMarkdown(raw) }

func Marshal(metadata []byte, messages []Message) ([]byte, error) {
	return MarshalMarkdown(metadata, messages)
}

// ParseMarkdown accepts document frontmatter followed by message blocks of the
// form --- / role: system|user|assistant / --- / Markdown body. Unsectioned
// body is a system message. Horizontal rules and fenced delimiters stay text.
func ParseMarkdown(raw []byte) (MarkdownDocument, error) {
	if len(raw) > 1<<20 {
		return MarkdownDocument{}, fmt.Errorf("markdown definition exceeds 1 MiB")
	}
	text := strings.TrimPrefix(strings.ReplaceAll(string(raw), "\r\n", "\n"), "\ufeff")
	lines := strings.Split(text, "\n")
	doc := MarkdownDocument{}
	start := 0
	if len(lines) > 0 && lines[0] == "---" {
		end := delimiterAfter(lines, 1)
		if end < 0 {
			return MarkdownDocument{}, fmt.Errorf("unterminated YAML frontmatter")
		}
		first := []byte(strings.Join(lines[1:end], "\n"))
		if _, isHeader, err := decodeRoleHeader(first); err != nil {
			return MarkdownDocument{}, err
		} else if !isHeader {
			doc.Metadata = first
			start = end + 1
		}
	}
	current := MarkdownMessage{Role: "system"}
	explicit := false
	var body []string
	flush := func() error {
		value := strings.Join(body, "\n")
		if current.Text != "" && strings.TrimSpace(value) != "" {
			return fmt.Errorf("message header text conflicts with Markdown body")
		}
		if strings.TrimSpace(value) != "" {
			current.Text = value
		}
		if explicit || current.Text != "" || current.URI != "" {
			doc.Messages = append(doc.Messages, current)
		}
		body = nil
		return nil
	}
	var fence byte
	var fenceLength int
	for index := start; index < len(lines); index++ {
		line := lines[index]
		if fence == 0 && line == "---" {
			end := delimiterAfter(lines, index+1)
			if end >= 0 {
				if header, ok, err := decodeRoleHeader([]byte(strings.Join(lines[index+1:end], "\n"))); err != nil {
					return MarkdownDocument{}, err
				} else if ok {
					if err := flush(); err != nil {
						return MarkdownDocument{}, err
					}
					current = header
					explicit = true
					index = end
					continue
				}
			}
		}
		fence, fenceLength = nextFence(line, fence, fenceLength)
		body = append(body, line)
	}
	if err := flush(); err != nil {
		return MarkdownDocument{}, err
	}
	return doc, nil
}

// MarshalMarkdown writes complete YAML metadata and ordered role blocks. It
// leaves ordinary text in readable Markdown bodies; whitespace-sensitive or
// delimiter-like text uses a YAML header scalar for exact round trips.
func MarshalMarkdown(metadata []byte, messages []MarkdownMessage) ([]byte, error) {
	var output strings.Builder
	output.WriteString("---\n")
	output.WriteString(strings.TrimRight(string(metadata), "\n"))
	output.WriteString("\n---\n")
	for index, message := range messages {
		role := strings.ToLower(strings.TrimSpace(message.Role))
		if role != "system" && role != "user" && role != "assistant" {
			return nil, fmt.Errorf("unsupported message role %q", message.Role)
		}
		header := struct {
			Role   string `yaml:"role"`
			Field  string `yaml:"field,omitempty"`
			Engine string `yaml:"engine,omitempty"`
			URI    string `yaml:"uri,omitempty"`
			Text   string `yaml:"text,omitempty"`
		}{Role: role, Field: message.Field, Engine: message.Engine, URI: message.URI}
		body := message.Text
		if message.URI != "" && message.Text != "" || strings.TrimSpace(body) != body || strings.Contains(body, "\n---\nrole:") || strings.HasPrefix(body, "---\nrole:") {
			header.Text = body
			body = ""
		}
		headerText := header.Text
		header.Text = ""
		encoded, err := yaml.Marshal(header)
		if err != nil {
			return nil, err
		}
		output.WriteString("---\n")
		output.Write(encoded)
		if headerText != "" {
			quoted, err := json.Marshal(headerText)
			if err != nil {
				return nil, err
			}
			output.WriteString("text: ")
			output.Write(quoted)
			output.WriteByte('\n')
		}
		output.WriteString("---\n")
		output.WriteString(body)
		if index < len(messages)-1 {
			output.WriteByte('\n')
		}
	}
	return []byte(output.String()), nil
}

func delimiterAfter(lines []string, start int) int {
	for index := start; index < len(lines); index++ {
		if lines[index] == "---" {
			return index
		}
	}
	return -1
}

func decodeRoleHeader(raw []byte) (MarkdownMessage, bool, error) {
	var probe map[string]any
	if err := yaml.Unmarshal(raw, &probe); err != nil || probe == nil {
		return MarkdownMessage{}, false, nil // ordinary Markdown horizontal rule
	}
	role, present := probe["role"]
	if !present {
		return MarkdownMessage{}, false, nil
	}
	roleText, ok := role.(string)
	if !ok {
		return MarkdownMessage{}, false, fmt.Errorf("message role must be text")
	}
	roleText = strings.ToLower(strings.TrimSpace(roleText))
	if roleText != "system" && roleText != "user" && roleText != "assistant" {
		return MarkdownMessage{}, false, fmt.Errorf("unsupported message role %q", roleText)
	}
	var header struct {
		Role   string `yaml:"role"`
		Field  string `yaml:"field"`
		Engine string `yaml:"engine"`
		Text   string `yaml:"text"`
		URI    string `yaml:"uri"`
	}
	decoder := yaml.NewDecoder(bytes.NewReader(raw))
	decoder.KnownFields(true)
	if err := decoder.Decode(&header); err != nil {
		return MarkdownMessage{}, false, fmt.Errorf("invalid message header: %w", err)
	}
	if decoder.Decode(new(any)) != io.EOF {
		return MarkdownMessage{}, false, fmt.Errorf("message header requires one YAML mapping")
	}
	return MarkdownMessage{Role: roleText, Field: strings.TrimSpace(header.Field), Engine: strings.TrimSpace(header.Engine), Text: header.Text, URI: strings.TrimSpace(header.URI)}, true, nil
}

func nextFence(line string, fence byte, length int) (byte, int) {
	trimmed := strings.TrimLeft(line, " ")
	if len(line)-len(trimmed) > 3 || len(trimmed) < 3 || trimmed[0] != '`' && trimmed[0] != '~' {
		return fence, length
	}
	count := 0
	for count < len(trimmed) && trimmed[count] == trimmed[0] {
		count++
	}
	if fence == 0 && count >= 3 {
		return trimmed[0], count
	}
	if fence == trimmed[0] && count >= length && strings.TrimSpace(trimmed[count:]) == "" {
		return 0, 0
	}
	return fence, length
}
