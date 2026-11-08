package primitive

import (
	"encoding/json"
	"testing"
)

func TestKnowledgeEnvelopePreservesAuthoredFilesAndSourceIdentity(t *testing.T) {
	document := "---\ntitle: Example\nsourceArticleId: 42\nsourceUrl: https://example.test/articles/42\n---\n\n# Example\nExact  spacing.\n"
	value := KnowledgeEnvelope{SchemaVersion: AIEnvelopeVersion, Name: "guide", Files: map[string]string{"guides/example.md": document}, Metadata: KnowledgeMetadata{Extractor: "yaml-frontmatter", Fields: map[string]string{"source.url": "sourceUrl"}}, Sources: []KnowledgeSource{{ID: "reference", Revision: "v1", Paths: []string{"guides/example.md"}}}}
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	var decoded KnowledgeEnvelope
	if err = json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Files["guides/example.md"] != document || decoded.Sources[0].Revision != "v1" || decoded.Metadata.Fields["source.url"] != "sourceUrl" {
		t.Fatal("knowledge roundtrip changed authored content or source identity")
	}
}
