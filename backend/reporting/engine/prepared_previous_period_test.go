package reporting

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func preparedComparisonSource(t *testing.T, scopeMode ...string) json.RawMessage {
	t.Helper()
	raw, err := os.ReadFile("../materializer/testdata/authored-envelope.json")
	require.NoError(t, err)
	var source registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &source))
	source.BuilderDefinition = json.RawMessage(`{"kind":"forge.reporting.builder","id":"sampleBuilder","reportBuilder":{"dataSourceRef":"sampleRows","measures":[{"key":"spend","id":"spend","label":"Spend","paramPath":"measures.spend","default":true}],"predicates":[{"id":"dates","kind":"dateRange","startParamPath":"filters.from","endParamPath":"filters.to","prefill":{"start":"from","end":"to"}}],"dataSources":[{"id":"prior","dataSourceRef":"sampleRows","request":{"filters":{},"measures":{"spend":true}},"scope":{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}}}]}}`)
	source.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Comparison","blocks":[{"id":"current","kind":"kpiBlock","datasetRef":"primary","valueField":"spend","secondaryDatasetRef":"prior","secondaryField":"spend","secondaryCalculation":"relativeChange"}]}`)
	source.State = json.RawMessage(`{"selectedMeasures":["spend"]}`)
	source.DataSources = map[string]json.RawMessage{"sampleRows": json.RawMessage(`{"id":"sampleRows","backend":{"kind":"inline","rows":[]}}`)}
	if len(scopeMode) > 0 {
		source.BuilderDefinition = bytes.Replace(source.BuilderDefinition, []byte(`"mode":"override"`), []byte(`"mode":"`+scopeMode[0]+`"`), 1)
	}
	source.Dependencies = []registry.ReportDependency{
		{Kind: "builder", ID: source.BuilderRef, ContentFingerprint: identity.ContentFingerprint(source.BuilderDefinition)},
		{Kind: "datasource", ID: "sampleRows", ContentFingerprint: identity.ContentFingerprint(source.DataSources["sampleRows"])},
		{Kind: "report", ID: "report://example/comparison", ContentFingerprint: identity.ContentFingerprint(source.ReportDocument)},
	}
	raw, err = json.Marshal(source)
	require.NoError(t, err)
	return raw
}

func TestPrepareReportDefersPreviousPeriodUntilInvocation(t *testing.T) {
	raw := preparedComparisonSource(t)
	uri, err := identity.ParseResourceURI("report://example/comparison")
	require.NoError(t, err)
	reads := 0
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { reads++; return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "sample-account", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(nil), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	seen := map[string]string{}
	var mu sync.Mutex
	service.SetResourceDatasetExecutor(func(_ context.Context, _ identity.ResolvedResource, _ *dsproto.DataSource, args map[string]interface{}) (*dsproto.FetchResult, error) {
		mu.Lock()
		seen[reportRequestPath(args, "filters.from")] = reportRequestPath(args, "filters.to")
		mu.Unlock()
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"spend": 80}}}, nil
	})
	plan, err := service.PrepareReport(context.Background(), &CompileRequest{Resource: &identity.ResourceRef{URI: uri.String()}})
	require.NoError(t, err)
	require.Empty(t, seen, "preparation must not dispatch data")
	require.JSONEq(t, string(raw), string(plan.raw))
	datedPlan, err := service.PrepareReport(context.Background(), &CompileRequest{Resource: &identity.ResourceRef{URI: uri.String()}, Parameters: map[string]interface{}{"from": "2025-01-01", "to": "2025-01-30"}})
	require.NoError(t, err)
	require.JSONEq(t, string(raw), string(datedPlan.raw), "prepare must not freeze supplied dates")
	original := raw
	raw = preparedComparisonSource(t, "inherit")
	_, err = service.PrepareReport(context.Background(), &CompileRequest{Resource: &identity.ResourceRef{URI: uri.String()}})
	require.ErrorContains(t, err, "Previous period requires dataset scope mode 'override'")
	raw = original
	// Preparation must not populate a reusable execution specification or weaken
	// the ordinary compile path for the same selected resource and signature.
	_, err = service.Compile(context.Background(), &CompileRequest{Resource: &identity.ResourceRef{URI: uri.String()}})
	require.ErrorContains(t, err, "bounded civil date range")
	readsBeforeExecution := reads
	for _, parameters := range []map[string]interface{}{nil, {"from": "2026-08-01"}, {"from": "2026-02-30", "to": "2026-03-01"}} {
		_, err = service.ExecutePreparedReport(context.Background(), plan, &ExecuteResourceRequest{Parameters: parameters, FillOnly: true})
		require.Error(t, err)
		require.Empty(t, seen, "unbounded or invalid invocation dispatched data")
	}
	for index, window := range []struct{ from, to, priorFrom, priorTo string }{
		{"2026-08-01", "2026-08-30", "2026-07-02", "2026-07-31"},
		{"2026-10-01", "2026-10-07", "2026-09-24", "2026-09-30"},
	} {
		selectedPlan := plan
		if index == 1 {
			selectedPlan = datedPlan
		}
		result, err := service.ExecutePreparedReport(context.Background(), selectedPlan, &ExecuteResourceRequest{Parameters: map[string]interface{}{"from": window.from, "to": window.to}, FillOnly: true})
		require.NoError(t, err)
		require.NotEmpty(t, result.ReportFill)
		require.Equal(t, map[string]string{window.from: window.to, window.priorFrom: window.priorTo}, seen)
		seen = map[string]string{}
	}
	require.Equal(t, readsBeforeExecution, reads, "prepared execution reread metadata")
	require.JSONEq(t, string(raw), string(plan.raw), "invocations changed the prepared source")
}
