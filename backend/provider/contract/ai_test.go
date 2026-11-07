package primitive

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

// These independently authored wire examples keep producer and consumer
// aliases compatible without depending on a particular application's schema.
func TestAIEnvelopeWireCompatibility(t *testing.T) {
	tests := []struct {
		name  string
		wire  string
		value any
	}{
		{"agent", `{"schemaVersion":1,"document":"kind: agent\nid: review\n"}`, &AgentDocumentEnvelope{}},
		{"skill", `{"schemaVersion":1,"document":"---\nname: review\n---\nExact café text.\n","files":{"refs/note.txt":"exact supporting bytes\n"}}`, &SkillDocumentEnvelope{}},
		{"prompt", `{"schemaVersion":1,"text":"Review {{.Task.Prompt}}","engine":"go","arguments":[{"name":"topic","description":"Example input","required":true}]}`, &PromptEnvelope{}},
		{"profile", `{"schemaVersion":1,"profile":{"id":"review","instructions":"Review a synthetic record."}}`, &ProfileEnvelope[json.RawMessage]{}},
		{"playbook", `{"schemaVersion":1,"document":"---\nid: review\n---\nReview a synthetic record.","profile":{"id":"review","instructions":"Review a synthetic record."}}`, &PlaybookEnvelope[json.RawMessage]{}},
		{"routing", `{"schemaVersion":1,"document":"---\nname: review\ndescription: Review synthetic records\n---\n## When\nReview a synthetic record.\n"}`, &RoutingGuideEnvelope{}},
		{"eval", `{"schemaVersion":1,"id":"review","title":"Review routing","user_prompt":"Review a synthetic record.","entry_agent":"agent://example/review","expected_routing":{"agent":"agent://example/review","profile":"review","fan_out":["agent://example/helper"]},"expected_pre_delegation_tools":[{"name":"example/read"}],"expected_output":{"template":"summary"},"dependencies":[]}`, &EvalEnvelope{}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			require.NoError(t, json.Unmarshal([]byte(test.wire), test.value))
			encoded, err := json.Marshal(test.value)
			require.NoError(t, err)
			require.JSONEq(t, test.wire, string(encoded))
		})
	}
}

func TestRoutingGuideUsesLiteralMarkdownBody(t *testing.T) {
	body := "## When\n\nReview records when scope is known.\n\n---\nrole: user\n---\nLiteral example.\n"
	source := "---\nname: Review records\ndescription: Choose a path for synthetic records\n---\n" + body
	envelope := RoutingGuideEnvelope{SchemaVersion: AIEnvelopeVersion, Document: source}
	encoded, err := yaml.Marshal(envelope)
	require.NoError(t, err)
	var decoded RoutingGuideEnvelope
	require.NoError(t, yaml.Unmarshal(encoded, &decoded))
	require.Equal(t, envelope, decoded)
	guide, err := ParseRoutingGuide(decoded)
	require.NoError(t, err)
	require.Equal(t, RoutingGuide{Name: "Review records", Description: "Choose a path for synthetic records", Body: body}, guide)
	require.Equal(t, RoutingKind, Kind(Plural(RoutingKind)))

	for _, document := range []string{body, "---\nname: Review\n---\nBody", strings.TrimSuffix(source, body), source + strings.Repeat("x", MaxRoutingGuideBytes)} {
		_, err = ParseRoutingGuide(RoutingGuideEnvelope{SchemaVersion: AIEnvelopeVersion, Document: document})
		require.Error(t, err)
	}
	_, err = ParseRoutingGuide(RoutingGuideEnvelope{SchemaVersion: 2, Document: source})
	require.Error(t, err)
}

func TestSkillDocumentEnvelopeRetainsUTF8Strings(t *testing.T) {
	value := SkillDocumentEnvelope{SchemaVersion: AIEnvelopeVersion, Document: "Exact café text.\n", Files: map[string]string{"refs/note.txt": "Exact Ω bytes.\n"}}
	raw, err := json.Marshal(value)
	require.NoError(t, err)
	var wire map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(raw, &wire))
	var document string
	require.NoError(t, json.Unmarshal(wire["document"], &document))
	require.Equal(t, value.Document, document, "versioned documents are UTF-8 strings, not JSON byte/base64 carriers")
	var decoded SkillDocumentEnvelope
	require.NoError(t, json.Unmarshal(raw, &decoded))
	require.Equal(t, value.Files, decoded.Files)
}
