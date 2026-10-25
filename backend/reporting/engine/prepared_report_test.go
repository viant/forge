package reporting

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"
	"time"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
)

func TestPreparedReportExecutesWithoutMetadataReads(t *testing.T) {
	raw, err := os.ReadFile("testdata/authored_report.json")
	if err != nil {
		t.Fatal(err)
	}
	uri, _ := identity.ParseResourceURI("report://steward/forecast_supply_command_center")
	reads := 0
	expiry := time.Now().Add(time.Minute)
	prepared := false
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) {
		reads++
		if prepared {
			t.Fatal("metadata read during prepared execution")
		}
		return append(json.RawMessage(nil), raw...), nil
	}}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if prepared {
			t.Fatal("policy check during prepared execution")
		}
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "test-account", ValidUntil: expiry}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(nil), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) {
		if prepared {
			t.Fatal("resolver factory during prepared execution")
		}
		return resolver, nil
	}})
	service.SetResourceDatasetExecutor(func(context.Context, identity.ResolvedResource, *dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"channelV2": "CTV", "eventDate": "2026-10-07", "avails": 10, "hhUniqs": 5}}}, nil
	})
	plan, err := service.PrepareReport(context.Background(), &CompileRequest{Resource: &identity.ResourceRef{URI: uri.String()}})
	if err != nil {
		t.Fatal(err)
	}
	prepared = true
	oldReads := reads
	original := string(plan.raw)
	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result, err := service.ExecutePreparedReport(context.Background(), plan, &ExecuteResourceRequest{FillOnly: true})
			if err != nil || result == nil || len(result.ReportFill) == 0 {
				t.Errorf("prepared execution: %v", err)
				return
			}
			result.Datasets["primary"].Rows[0]["channelV2"] = "mutated result"
		}()
	}
	wg.Wait()
	if reads != oldReads || string(plan.raw) != original {
		t.Fatal("prepared state mutated or metadata reread")
	}
}

func TestPreparedReportRequiresPreparedStateAndObservesCancellation(t *testing.T) {
	service := New(Options{})
	if result, err := service.ExecutePreparedReport(context.Background(), nil, &ExecuteResourceRequest{}); err == nil || result != nil {
		t.Fatal("missing preparation accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	// A real prepared definition must not make a canceled request dispatch data.
	calls := 0
	service.SetResourceDatasetExecutor(func(context.Context, identity.ResolvedResource, *dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
		calls++
		return nil, nil
	})
	if result, err := service.ExecutePreparedReport(ctx, &PreparedReport{}, &ExecuteResourceRequest{}); err == nil || result != nil || calls != 0 {
		t.Fatal("canceled execution dispatched")
	}
}

func TestPreparedReportRelativeDatesRemainPerInvocation(t *testing.T) {
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	service := New(Options{Now: func() time.Time { return now }})
	plan := &PreparedReport{raw: json.RawMessage(`{"schemaVersion":1,"reportSpec":{"datasets":[{"id":"primary","scope":{"mode":"override","relativeDateRange":{"preset":"last7days","startParamPath":"filters.from","endParamPath":"filters.to"}},"request":{"filters":{}}}]}}`)}
	original := string(plan.raw)
	first, err := service.compilePreparedReport(context.Background(), plan, nil)
	if err != nil {
		t.Fatal(err)
	}
	now = now.AddDate(0, 0, 1)
	second, err := service.compilePreparedReport(context.Background(), plan, nil)
	if err != nil {
		t.Fatal(err)
	}
	if string(first.ReportSpec) == string(second.ReportSpec) {
		t.Fatal("relative dates froze at preparation")
	}
	if original != string(plan.raw) {
		t.Fatal("prepared definition mutated")
	}
}
