package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestAuthoredDependencyClosureMissingIsTypedWithoutRepairingPins(t *testing.T) {
	for _, missing := range []string{"all", "builder", "report", "datasource"} {
		t.Run(missing, func(t *testing.T) {
			envelope := fingerprintEnvelope()
			if err := validateEnvelope(envelope); err != nil {
				t.Fatal(err)
			}
			dependencies := envelope.Dependencies[:0]
			for _, dependency := range envelope.Dependencies {
				if missing != "all" && dependency.Kind != missing {
					dependencies = append(dependencies, dependency)
				}
			}
			envelope.Dependencies = dependencies
			raw, err := json.Marshal(envelope)
			if err != nil {
				t.Fatal(err)
			}
			original := bytes.Clone(raw)
			result, err := Lower(context.Background(), raw)
			var closure *AuthoredDependencyClosureError
			if result != nil || !errors.As(err, &closure) || !closure.AuthoredDependencyClosureMissing() {
				t.Fatalf("missing closure must fail before lowering: %v", err)
			}
			if !bytes.Equal(original, raw) || err.Error() != "incomplete authored report dependency closure" {
				t.Fatal("source was rewritten or diagnostic contains authored details")
			}
		})
	}
}

func TestAuthoredDependencyClosureDoesNotRelabelFingerprintMismatch(t *testing.T) {
	envelope := fingerprintEnvelope()
	envelope.BuilderDefinition = json.RawMessage(`{"id":"builder","reportBuilder":{"document":{"title":"Changed"}}}`)
	err := validateEnvelope(envelope)
	var closure *AuthoredDependencyClosureError
	var fingerprint *AuthoredDependencyFingerprintError
	if errors.As(err, &closure) || !errors.As(err, &fingerprint) {
		t.Fatalf("fingerprint rejection lost its separate strict category: %v", err)
	}
}
