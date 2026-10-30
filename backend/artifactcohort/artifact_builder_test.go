package artifactcohort

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	primitive "github.com/viant/forge/backend/provider/contract"
)

func checkTypedCapture[T any](t *testing.T, kind string, value T) {
	t.Helper()
	root := RootRef{URI: kind + "://example/guide", Kind: kind, Version: 1}
	got, err := (ArtifactBuilder[T]{}).Build(context.Background(), root, value)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	p := NewPublisher()
	published, _, err := p.Publish(context.Background(), root, raw, func(context.Context, json.RawMessage) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if got.Root != published.Root || string(got.Payload) != string(published.Payload) {
		t.Fatal("typed capture differs from ordinary publication")
	}
}

func TestTypedCaptureUsesExistingArtifactWireForAllAIKinds(t *testing.T) {
	checkTypedCapture(t, "skill", primitive.SkillDocumentEnvelope{SchemaVersion: 1, Document: "---\nname: guide\ndescription: Example guide\n---\nRead notes.", Files: map[string]string{"notes.md": "Example <note>."}})
	checkTypedCapture(t, "playbook", primitive.PlaybookEnvelope[map[string]any]{SchemaVersion: 1, Profile: map[string]any{"id": "guide"}})
	checkTypedCapture(t, "agent", primitive.AgentDocumentEnvelope{SchemaVersion: 1, Document: "name: example"})
	checkTypedCapture(t, "prompt", primitive.PromptEnvelope{SchemaVersion: 1, Text: "Example {{.Input}}", Engine: "go"})
	checkTypedCapture(t, "eval", primitive.EvalEnvelope{SchemaVersion: 1, ID: "example", UserPrompt: "Example question"})
	checkTypedCapture(t, "toolfeed", map[string]any{"schemaVersion": 1, "name": "example"})
}

func TestTypedCaptureHooksAreOptionalAndErrorsArePreserved(t *testing.T) {
	ctx := context.Background()
	root := RootRef{URI: "prompt://example/guide", Kind: "prompt", Version: 1}
	sentinel := errors.New("custom rejected")
	_, err := (ArtifactBuilder[string]{Validate: func(context.Context, string) error { return sentinel }}).Build(ctx, root, "example")
	if !errors.Is(err, sentinel) {
		t.Fatalf("validator error=%v", err)
	}
	_, err = (ArtifactBuilder[string]{Encode: func(context.Context, string) (json.RawMessage, error) { return nil, sentinel }}).Build(ctx, root, "example")
	if !errors.Is(err, sentinel) {
		t.Fatalf("encoder error=%v", err)
	}
	raw := json.RawMessage(`{ "schemaVersion": 1, "text": "<example>" }`)
	got, err := (ArtifactBuilder[string]{Encode: func(context.Context, string) (json.RawMessage, error) { return raw, nil }}).Build(ctx, root, "ignored")
	if err != nil {
		t.Fatal(err)
	}
	raw[0] = '!'
	if ValidateArtifact(got) != nil {
		t.Fatal("capture retained mutable source bytes")
	}
	root.Hash = Hash([]byte("different"))
	if _, err = (ArtifactBuilder[map[string]string]{}).Build(ctx, root, map[string]string{"text": "example"}); err == nil {
		t.Fatal("accepted wrong snapshot identity")
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err = (ArtifactBuilder[string]{}).Build(canceled, root, "example"); err == nil {
		t.Fatal("ignored cancellation")
	}
}
