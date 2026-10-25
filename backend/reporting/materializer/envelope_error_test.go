package materializer

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func fingerprintEnvelope() registry.ReportEnvelope {
	builder := json.RawMessage(`{"id":"builder","reportBuilder":{"document":{"title":"Original"}}}`)
	rows := json.RawMessage(`{"id":"rows","backend":{"kind":"inline","rows":[]}}`)
	document := json.RawMessage(`{"title":"Synthetic"}`)
	return registry.ReportEnvelope{SchemaVersion: 1, Format: registry.AuthoredReportFormat, BuilderRef: "builder", BuilderDefinition: builder, ReportDocument: document, State: json.RawMessage(`{}`), DataSources: map[string]json.RawMessage{"rows": rows}, Dependencies: []registry.ReportDependency{{Kind: "report", ID: "report://example/report", ContentFingerprint: identity.ContentFingerprint(document)}, {Kind: "builder", ID: "builder", ContentFingerprint: identity.ContentFingerprint(builder)}, {Kind: "datasource", ID: "rows", ContentFingerprint: identity.ContentFingerprint(rows)}}}
}

func TestAuthoredDependencyFingerprintMismatchRejectsChangedBytes(t *testing.T) {
	for _, kind := range []string{"builder", "datasource"} {
		t.Run(kind, func(t *testing.T) {
			envelope := fingerprintEnvelope()
			if err := validateEnvelope(envelope); err != nil {
				t.Fatal(err)
			}
			if kind == "builder" {
				envelope.BuilderDefinition = json.RawMessage(`{"id":"builder","reportBuilder":{"document":{"title":"Changed"}}}`)
			} else {
				envelope.DataSources["rows"] = json.RawMessage(`{"id":"rows","backend":{"kind":"inline","rows":[{"count":1}]}}`)
			}
			raw, err := json.Marshal(envelope)
			if err != nil {
				t.Fatal(err)
			}
			before := append([]byte(nil), raw...)
			originalFingerprints := append([]registry.ReportDependency(nil), envelope.Dependencies...)
			result, err := Lower(context.Background(), raw)
			var mismatch *AuthoredDependencyFingerprintError
			if result != nil || !errors.As(err, &mismatch) || mismatch.AuthoredDependencyKind() != kind {
				t.Fatalf("changed dependency was not rejected with typed category: %v", err)
			}
			if string(raw) != string(before) {
				t.Fatal("rejected source was modified")
			}
			for i, dep := range envelope.Dependencies {
				if dep.ContentFingerprint != originalFingerprints[i].ContentFingerprint {
					t.Fatal("fingerprint was recomputed")
				}
			}
			if err.Error() != "authored dependency fingerprint mismatch" {
				t.Fatal("diagnostic contains authored details")
			}
		})
	}
}

func TestAuthoredDependencyFingerprintMismatchDoesNotRelabelStructuralErrors(t *testing.T) {
	for _, mutate := range []func(*registry.ReportEnvelope){func(e *registry.ReportEnvelope) { e.Dependencies[1].ID = "other" }, func(e *registry.ReportEnvelope) { e.DataSources["rows"] = json.RawMessage(`[]`) }} {
		envelope := fingerprintEnvelope()
		mutate(&envelope)
		err := validateEnvelope(envelope)
		var mismatch *AuthoredDependencyFingerprintError
		if err == nil || errors.As(err, &mismatch) {
			t.Fatalf("structural/identity rejection mislabeled: %v", err)
		}
	}
	envelope := fingerprintEnvelope()
	secret := "private-token https://secret.invalid /private/source.json"
	envelope.BuilderRef = secret
	builder, _ := json.Marshal(map[string]any{"id": secret, "reportBuilder": map[string]any{"document": map[string]any{"title": "Changed"}}})
	envelope.BuilderDefinition = builder
	envelope.Dependencies[1].ID = secret
	err := validateEnvelope(envelope)
	var mismatch *AuthoredDependencyFingerprintError
	if !errors.As(err, &mismatch) || strings.Contains(err.Error(), secret) {
		t.Fatal("authored identity leaked or mismatch accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	raw, _ := json.Marshal(envelope)
	if _, err = Lower(ctx, raw); !errors.Is(err, context.Canceled) {
		t.Fatal("cancellation lost")
	}
}
