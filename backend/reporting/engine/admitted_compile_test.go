package reporting

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"
	"time"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
)

type countedReportReader struct {
	ResourceReader
	reads int
}

func (r *countedReportReader) ReadResolved(ctx context.Context, pin identity.ResolvedResource) (json.RawMessage, *identity.ResolvedResource, error) {
	r.reads++
	return r.ResourceReader.ReadResolved(ctx, pin)
}

type reportCompilerFunc func(context.Context, *CompileRequest) (*CompileResult, error)

func (f reportCompilerFunc) Compile(ctx context.Context, request *CompileRequest) (*CompileResult, error) {
	return f(ctx, request)
}

type reportActorKey struct{}

func TestExecuteResourceReusesOnlyInvocationAdmittedDefinition(t *testing.T) {
	original, err := os.ReadFile("testdata/authored_report.json")
	if err != nil {
		t.Fatal(err)
	}
	content := append(json.RawMessage(nil), original...)
	uri, _ := identity.ParseResourceURI("report://steward/forecast_supply_command_center")
	allowed := true
	expiry := time.Now().Add(time.Minute)
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) {
		return append(json.RawMessage(nil), content...), nil
	}}, Policy: reportPolicyFunc(func(ctx context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		actor, _ := ctx.Value(reportActorKey{}).(string)
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: actor, ValidUntil: expiry}, nil
	})}
	reader := &countedReportReader{ResourceReader: resolver}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now)})
	service.SetResourceReaderFactory(func(_ context.Context, operation string) (ResourceReader, error) {
		if operation != "report.execute" && operation != "report.compile" {
			return nil, identity.ErrResourceDenied
		}
		return reader, nil
	})
	fetched := func() {}
	service.SetResourceDatasetExecutor(func(context.Context, identity.ResolvedResource, *dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
		fetched()
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"channelV2": "CTV", "eventDate": "2026-10-07", "avails": 10, "hhUniqs": 5}}}, nil
	})
	ctxA := context.WithValue(context.Background(), reportActorKey{}, "actor-a")
	ctxB := context.WithValue(context.Background(), reportActorKey{}, "actor-b")
	request := &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, FillOnly: true}
	result, err := service.ExecuteResource(ctxA, request)
	if err != nil || result == nil || len(result.ReportFill) == 0 || reader.reads != 3 {
		t.Fatalf("selected, post-compile and post-fetch reads required; result=%v err=%v reads=%d", result != nil, err, reader.reads)
	}
	// Public Compile has no admitted source and retains both of its reads.
	reader.reads = 0
	if compiled, err := service.Compile(ctxA, &CompileRequest{Resource: request.Resource}); err != nil || compiled == nil || reader.reads != 2 {
		t.Fatalf("public compile changed resource reads: result=%v err=%v reads=%d", compiled != nil, err, reader.reads)
	}

	// Only the internal path may consume the exact raw bytes and complete lease.
	raw, selected, err := resolver.ReadResolved(ctxA, *result.Resource)
	if err != nil {
		t.Fatal(err)
	}
	reader.reads = 0
	compile := func(ctx context.Context, admitted admittedCompileDefinition) (*CompileResult, error) {
		return service.compileWithAdmitted(ctx, &CompileRequest{ResolvedResource: selected}, &admitted)
	}
	for _, change := range []func(*admittedCompileDefinition){
		func(a *admittedCompileDefinition) { a.pin.AuthorityBinding = "other" },
		func(a *admittedCompileDefinition) { a.pin.ValidUntil = a.pin.ValidUntil.Add(time.Second) },
		func(a *admittedCompileDefinition) { a.raw = append(a.raw, ' ') },
	} {
		admitted := admittedCompileDefinition{raw: append(json.RawMessage(nil), raw...), pin: *selected}
		change(&admitted)
		if out, err := compile(ctxA, admitted); !errors.Is(err, identity.ErrResourceDenied) || out != nil || reader.reads != 0 {
			t.Fatalf("mismatched admitted definition escaped: out=%v err=%v reads=%d", out != nil, err, reader.reads)
		}
	}
	if out, err := compile(ctxB, admittedCompileDefinition{raw: raw, pin: *selected}); !errors.Is(err, identity.ErrResourceDenied) || out != nil || reader.reads != 1 {
		t.Fatalf("different actor reused original authority: out=%v err=%v reads=%d", out != nil, err, reader.reads)
	}
	reader.reads = 0
	expiry = time.Now().Add(30 * time.Second)
	if out, err := compile(ctxA, admittedCompileDefinition{raw: raw, pin: *selected}); err != nil || out == nil || out.Resource == nil || out.Resource.ValidUntil.After(expiry) || reader.reads != 1 {
		t.Fatalf("narrowed lease lost post-compile fence: out=%v err=%v reads=%d", out != nil, err, reader.reads)
	}

	for _, tc := range []struct {
		name   string
		change func()
	}{
		{"source changes during compile", func() { content = append(content, ' ') }},
		{"policy revoked during compile", func() { allowed = false }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			content = append(json.RawMessage(nil), original...)
			allowed = true
			expiry = time.Now().Add(time.Minute)
			service.compiler = reportCompilerFunc(func(ctx context.Context, request *CompileRequest) (*CompileResult, error) {
				tc.change()
				return NewReportSpecCompiler(time.Now).Compile(ctx, request)
			})
			if out, err := service.ExecuteResource(ctxA, request); err == nil || out != nil {
				t.Fatalf("changed source or authority escaped post-compile recheck: out=%v err=%v", out != nil, err)
			}
		})
	}
	service.compiler = NewReportSpecCompiler(time.Now)
	for _, tc := range []struct {
		name   string
		change func()
	}{
		{"source changes during fetch", func() { content = append(content, ' ') }},
		{"policy revoked during fetch", func() { allowed = false }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			content = append(json.RawMessage(nil), original...)
			allowed = true
			expiry = time.Now().Add(time.Minute)
			fetched = tc.change
			if out, err := service.ExecuteResource(ctxA, request); err == nil || out != nil {
				t.Fatalf("changed source or authority escaped post-fetch fence: out=%v err=%v", out != nil, err)
			}
		})
	}
}
