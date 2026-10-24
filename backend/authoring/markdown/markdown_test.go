package markdown

import (
	"strings"
	"testing"
)

func TestParseMarkdownFrontmatterRoleHeadersAndFences(t *testing.T) {
	raw := "---\r\nid: review\r\nname: Review\r\n---\r\n---\r\nrole: system\r\n---\r\n# Instructions\r\nFollow the policy.\r\n```md\r\n---\r\nrole: user\r\n---\r\ninside fence\r\n```\r\n---\r\nordinary horizontal rule\r\n---\r\n---\r\nrole: user\r\n---\r\n# Request\r\nSummarize findings.\r\n---\r\nrole: assistant\r\nuri: prompts/answer.md\r\n---\r\n"
	doc, err := ParseMarkdown([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	if string(doc.Metadata) != "id: review\nname: Review" || len(doc.Messages) != 3 {
		t.Fatalf("wrong frontmatter or section count: %+v", doc)
	}
	if doc.Messages[0].Role != "system" || !strings.Contains(doc.Messages[0].Text, "# Instructions") || !strings.Contains(doc.Messages[0].Text, "---\nrole: user\n---\ninside fence") || !strings.Contains(doc.Messages[0].Text, "---\nordinary horizontal rule\n---") {
		t.Fatalf("fences, horizontal rules or headings changed the system section: %+v", doc.Messages[0])
	}
	if doc.Messages[1] != (MarkdownMessage{Role: "user", Text: "# Request\nSummarize findings."}) || doc.Messages[2] != (MarkdownMessage{Role: "assistant", URI: "prompts/answer.md"}) {
		t.Fatalf("role ordering or URI-only message changed: %+v", doc.Messages)
	}
}

func TestParseMarkdownUnsectionedBodyAndHeaderConflicts(t *testing.T) {
	doc, err := ParseMarkdown([]byte("# Overview\n\nUse evidence.\n"))
	if err != nil || len(doc.Messages) != 1 || doc.Messages[0].Role != "system" || doc.Messages[0].Text != "# Overview\n\nUse evidence.\n" {
		t.Fatalf("unsectioned body must be system text: %+v %v", doc, err)
	}
	if _, err := ParseMarkdown([]byte("---\nid: missing\n# Instructions\ntext")); err == nil {
		t.Fatal("unterminated frontmatter accepted")
	}
	if _, err := ParseMarkdown([]byte("---\nid: conflict\n---\n---\nrole: user\ntext: inline\n---\nbody")); err == nil {
		t.Fatal("header text and Markdown body conflict was accepted")
	}
}

func TestParseMarkdownFirstBlockCanBeAUserMessage(t *testing.T) {
	doc, err := ParseMarkdown([]byte("---\nrole: user\n---\n# Request\ntext\n"))
	if err != nil || len(doc.Metadata) != 0 || len(doc.Messages) != 1 || doc.Messages[0].Role != "user" || doc.Messages[0].Text != "# Request\ntext\n" {
		t.Fatalf("first role header was treated as document metadata: %+v %v", doc, err)
	}
	if _, err := ParseMarkdown([]byte("---\nrole: developer\n---\ntext")); err == nil {
		t.Fatal("unknown first role was silently promoted to system text")
	}
}

func TestMarshalMarkdownRoundTripsAllMessageFieldsAndWhitespace(t *testing.T) {
	original := []MarkdownMessage{
		{Role: "system", Engine: "velty", Text: "# Instructions\nKeep evidence."},
		{Role: "user", Text: "  leading and trailing  \n"},
		{Role: "assistant", URI: "prompts/answer.md", Text: "fallback retained"},
		{Role: "user", Text: "---\nrole: system\n---\nordinary source text"},
		{Role: "system"},
	}
	encoded, err := MarshalMarkdown([]byte("id: review\nname: Review\n"), original)
	if err != nil {
		t.Fatal(err)
	}
	doc, err := ParseMarkdown(encoded)
	if err != nil || string(doc.Metadata) != "id: review\nname: Review" || len(doc.Messages) != len(original) {
		t.Fatalf("Markdown round trip failed: %+v %v", doc, err)
	}
	for index := range original {
		if doc.Messages[index] != original[index] {
			t.Fatalf("message %d changed: got=%+v want=%+v", index, doc.Messages[index], original[index])
		}
	}
}

func TestMarshalMarkdownKeepsOrdinaryTrailingNewlinesReadable(t *testing.T) {
	messages := []MarkdownMessage{
		{Role: "system", Text: "# Instructions\n\nKeep the evidence.\n"},
		{Role: "user", Text: "# Request\n\nSummarize it.\n\n"},
	}
	encoded, err := MarshalMarkdown([]byte("kind: playbook\nid: performance_analysis\n"), messages)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "text: ") || !strings.Contains(string(encoded), "---\n# Instructions\n\nKeep the evidence.\n") {
		t.Fatalf("ordinary Markdown was hidden in a YAML header: %s", encoded)
	}
	parsed, err := ParseMarkdown(encoded)
	if err != nil || !sameMessages(parsed.Messages, messages) {
		t.Fatalf("ordinary trailing newlines changed: %+v %v", parsed.Messages, err)
	}
}

func TestMarshalMarkdownUsesHeaderOnlyForAmbiguousBodies(t *testing.T) {
	for _, body := range []string{"   \n", "line\r\nnext", "before\n---\nrole: user\n---\nafter"} {
		messages := []MarkdownMessage{{Role: "system", Text: body}}
		encoded, err := MarshalMarkdown([]byte("id: review\n"), messages)
		if err != nil {
			t.Fatalf("body %q: %v", body, err)
		}
		if !strings.Contains(string(encoded), "text: ") {
			t.Fatalf("ambiguous body %q was not quoted: %s", body, encoded)
		}
		parsed, err := ParseMarkdown(encoded)
		if err != nil || !sameMessages(parsed.Messages, messages) {
			t.Fatalf("ambiguous body %q changed: %+v %v", body, parsed.Messages, err)
		}
	}
}

func TestMarshalMarkdownOnlyQuotesTheAmbiguousMessage(t *testing.T) {
	messages := []MarkdownMessage{
		{Role: "system", Text: "# Readable instructions\nKeep this as Markdown.\n"},
		{Role: "user", Text: "before\n---\nrole: assistant\n---\nafter"},
	}
	encoded, err := MarshalMarkdown([]byte("id: review\n"), messages)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(encoded), "---\n# Readable instructions\nKeep this as Markdown.\n") || strings.Count(string(encoded), "text: ") != 1 {
		t.Fatalf("an unrelated readable section was quoted: %s", encoded)
	}
	parsed, err := ParseMarkdown(encoded)
	if err != nil || !sameMessages(parsed.Messages, messages) {
		t.Fatalf("mixed body round trip failed: %+v %v", parsed.Messages, err)
	}
}
