package reporting

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/viant/forge/backend/reporting/materializer"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestCompileStageErrorActualPipeline(t *testing.T) {
	for _, tc := range []struct{ name, raw, stage string }{
		{"envelope", `{"unexpected":true}`, CompileStageEnvelope},
		{"lower", `{"schemaVersion":1,"format":"forge.authoredReport","reportDocument":{},"builderDefinition":{}}`, CompileStageLower},
	} {
		t.Run(tc.name, func(t *testing.T) {
			uri, _ := identity.ParseResourceURI("report://example/demo")
			resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return json.RawMessage(tc.raw), nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
				return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "synthetic", ValidUntil: time.Now().Add(time.Minute)}, nil
			})}
			service := New(Options{Compiler: NewReportSpecCompiler(nil), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
			_, err := service.Compile(context.Background(), &CompileRequest{Resource: &identity.ResourceRef{URI: uri.String()}})
			var stage *CompileStageError
			if !errors.As(err, &stage) || stage.Stage != tc.stage {
				t.Fatalf("stage=%+v error=%v", stage, err)
			}
		})
	}
	service := New(Options{Compiler: NewReportSpecCompiler(nil)})
	_, err := service.Compile(context.Background(), &CompileRequest{Document: json.RawMessage(`{"private":"not a canonical spec"}`)})
	var stage *CompileStageError
	if !errors.As(err, &stage) || stage.Stage != CompileStageCompiler {
		t.Fatalf("compiler stage=%+v error=%v", stage, err)
	}
}
func TestCompileStageErrorPreservesCauseAndAdmission(t *testing.T) {
	for _, cause := range []error{context.Canceled, context.DeadlineExceeded, identity.ErrResourceDenied} {
		err := compileStageError(CompileStageLower, cause)
		if !errors.Is(err, cause) {
			t.Fatal("cause lost")
		}
		var stage *CompileStageError
		if errors.As(err, &stage) {
			t.Fatalf("authority/cancellation mislabeled: %v", err)
		}
	}
	cause := errors.New("private compiler detail")
	if !errors.Is(compileStageError(CompileStageCompiler, cause), cause) {
		t.Fatal("compiler cause lost")
	}
	readerFailure := errors.New("synthetic reader transport unavailable")
	service := New(Options{Compiler: NewReportSpecCompiler(nil)})
	service.SetResourceReaderFactory(func(context.Context, string) (ResourceReader, error) { return nil, readerFailure })
	_, err := service.Compile(context.Background(), &CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/demo"}})
	var stage *CompileStageError
	if !errors.Is(err, readerFailure) || errors.As(err, &stage) {
		t.Fatalf("reader failure mislabeled: %v", err)
	}
}

func TestCompileStageErrorPreservesAuthoredFingerprintCause(t *testing.T) {
	ctx := context.Background()
	builder := json.RawMessage(`{"id":"builder","reportBuilder":{"document":{"title":"Original"}}}`)
	rows := json.RawMessage(`{"id":"rows","backend":{"kind":"inline","rows":[]}}`)
	document := json.RawMessage(`{"title":"Synthetic"}`)
	envelope := registry.ReportEnvelope{SchemaVersion: 1, Format: registry.AuthoredReportFormat, BuilderRef: "builder", BuilderDefinition: json.RawMessage(`{"id":"builder","reportBuilder":{"document":{"title":"Changed"}}}`), ReportDocument: document, State: json.RawMessage(`{}`), DataSources: map[string]json.RawMessage{"rows": rows}, Dependencies: []registry.ReportDependency{{Kind: "report", ID: "report://example/report", ContentFingerprint: identity.ContentFingerprint(document)}, {Kind: "builder", ID: "builder", ContentFingerprint: identity.ContentFingerprint(builder)}, {Kind: "datasource", ID: "rows", ContentFingerprint: identity.ContentFingerprint(rows)}}}
	raw, err := json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	uri, _ := identity.ParseResourceURI("report://example/report")
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "synthetic", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(nil), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	_, err = service.Compile(ctx, &CompileRequest{Resource: &identity.ResourceRef{URI: uri.String()}})
	var stage *CompileStageError
	var mismatch *materializer.AuthoredDependencyFingerprintError
	if !errors.As(err, &stage) || stage.Stage != CompileStageLower || !errors.As(err, &mismatch) || mismatch.AuthoredDependencyKind() != "builder" {
		t.Fatalf("typed fingerprint cause lost at actual compiler boundary: %v", err)
	}
}
