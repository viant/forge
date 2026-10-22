package reporting

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/viant/forge/backend/reporting/materializer"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
	authsvc "github.com/viant/mcp/client/auth/link"
)

func TestResourcePresentationUsesApprovedScopeAndRejectsUnknownFieldsBeforeDispatch(t *testing.T) {
	spec, err := os.ReadFile("../materializer/testdata/presentation-report.json")
	if err != nil {
		t.Fatal(err)
	}
	var parsed struct {
		Blocks []struct {
			ID   string `json:"id"`
			Kind string `json:"kind"`
		} `json:"blocks"`
	}
	if err = json.Unmarshal(spec, &parsed); err != nil {
		t.Fatal(err)
	}
	chartID := ""
	for _, block := range parsed.Blocks {
		if block.Kind == "chartBlock" {
			chartID = block.ID
		}
	}
	descriptor := json.RawMessage(`{"id":"approved","backend":{"kind":"mcp_tool","service":"approved","method":"Read"},"selectors":{"data":"data"}}`)
	definition := registry.ReportEnvelope{SchemaVersion: 1, ReportSpec: spec, DataSources: map[string]json.RawMessage{"approved": descriptor}}
	content, err := json.Marshal(definition)
	if err != nil {
		t.Fatal(err)
	}
	uri, _ := identity.ParseResourceURI("report://example/metric-choice")
	allowed := true
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return content, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "verified-account", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	calls := 0
	service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(ctx context.Context, name string, args map[string]interface{}) (string, error) {
		calls++
		if name != "approved:Read" || authsvc.EffectiveUserID(ctx) != "fixture-user" {
			t.Fatal("wrong provider identity", name)
		}
		filters, _ := args["filters"].(map[string]interface{})
		if filters["accountId"] != float64(42) || filters["from"] != "2026-01-01" || filters["to"] != "2026-01-02" {
			t.Fatal("scope changed", filters)
		}
		return `{"data":[{"day":"one","spend":10,"count":1000,"rate":0.01},{"day":"two","spend":20,"count":2000,"rate":0.02}]}`, nil
	}), service.AuthorizeResourceDataset))
	ctx := authsvc.InjectUser(context.Background(), "fixture-user")
	choice := map[string]materializer.ChartMetricSelection{chartID: {PrimaryField: "count", SecondaryField: "rate"}}
	request := &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, ChartMetricSelections: choice}
	out, err := service.ExecuteResource(ctx, request)
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 || !strings.Contains(string(out.ReportPrint), "2.00%") || !strings.Contains(string(out.ReportPrint), "Impressions") {
		t.Fatal("selected presentation not materialized", calls)
	}
	before := calls
	request.ChartMetricSelections = map[string]materializer.ChartMetricSelection{chartID: {PrimaryField: "secret", SecondaryField: "rate"}}
	if result, err := service.ExecuteResource(ctx, request); err == nil || result != nil || calls != before {
		t.Fatal("unapproved field reached datasource")
	}
	allowed = false
	request.ChartMetricSelections = choice
	if result, err := service.ExecuteResource(ctx, request); err == nil || result != nil || calls != before {
		t.Fatal("presentation bypassed resource authority")
	}
}
