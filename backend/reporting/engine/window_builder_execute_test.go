package reporting

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestWindowBuilderRetainsOriginalSourceAndExecutionFences(t *testing.T) {
	original := json.RawMessage(`{"kind":"held-window","metadataScript":"must remain data"}`)
	content := append(json.RawMessage(nil), original...)
	uri, _ := identity.ParseResourceURI("window://example/report")
	allowed := true
	expiry := time.Now().Add(time.Minute)
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return content, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "ordinary-actor", ValidUntil: expiry}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	raw, err := os.ReadFile("testdata/authored_report.json")
	if err != nil {
		t.Fatal(err)
	}
	var definition registry.ReportEnvelope
	if err = json.Unmarshal(raw, &definition); err != nil {
		t.Fatal(err)
	}
	for i := range definition.Dependencies {
		if definition.Dependencies[i].Kind == "report" {
			definition.Dependencies[i].Kind = "window"
			definition.Dependencies[i].ID = uri.String()
			definition.Dependencies[i].ContentFingerprint = identity.ContentFingerprint(original)
		}
	}
	derivations, calls := 0, 0
	derive := func(_ context.Context, pin identity.ResolvedResource, source json.RawMessage) (registry.ReportEnvelope, error) {
		derivations++
		if string(source) != string(original) || pin.ContentFingerprint != identity.ContentFingerprint(original) {
			t.Fatal("source was replaced with a derived report")
		}
		return definition, nil
	}
	during := func() {}
	service.SetResourceDatasetExecutor(func(_ context.Context, pin identity.ResolvedResource, _ *dsproto.DataSource, _ map[string]interface{}) (*dsproto.FetchResult, error) {
		calls++
		if pin.URI != uri.String() || pin.ContentFingerprint != identity.ContentFingerprint(original) {
			t.Fatal("fetch lost the original window identity")
		}
		during()
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"channelV2": "CTV", "eventDate": "2026-10-07", "avails": 10, "hhUniqs": 5}}}, nil
	})
	request := &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}}
	if _, err = service.ExecuteResource(context.Background(), request); err == nil || derivations != 0 || calls != 0 {
		t.Fatal("ordinary report entry accepted a window")
	}
	out, err := service.ExecuteWindowBuilder(context.Background(), request, derive)
	if err != nil || out == nil || out.Resource.ContentFingerprint != identity.ContentFingerprint(original) || len(out.ReportPrint) == 0 || calls == 0 {
		t.Fatalf("window execution failed: %v", err)
	}
	previousCalls := calls
	unknown := "unknown-table"
	if _, err = service.ExecuteWindowBuilder(context.Background(), &ExecuteResourceRequest{Resource: request.Resource, TableBlockID: &unknown}, derive); err == nil || calls != previousCalls {
		t.Fatal("unknown table dispatched data")
	}
	for _, change := range []func(){func() { allowed = false }, func() { content = append(content, ' ') }, func() { expiry = time.Now().Add(-time.Second) }} {
		allowed = true
		content = append(json.RawMessage(nil), original...)
		expiry = time.Now().Add(time.Minute)
		during = change
		if out, err = service.ExecuteWindowBuilder(context.Background(), request, derive); err == nil || out != nil {
			t.Fatal("window export released after source authority changed")
		}
	}
	before := derivations
	allowed = false
	if _, err = service.ExecuteWindowBuilder(context.Background(), request, derive); err == nil || derivations != before {
		t.Fatal("denied source reached derivation")
	}
}
