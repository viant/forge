package reporting

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/materializer"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestAuthoredPreviousPeriodBindsSelectedDatesBeforeLowering(t *testing.T) {
	raw, err := os.ReadFile("../materializer/testdata/authored-envelope.json")
	require.NoError(t, err)
	var envelope map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &envelope))
	builder := json.RawMessage(`{"kind":"forge.reporting.builder","id":"stewardPerformance","reportBuilder":{"dataSourceRef":"steward-orders","measures":[{"key":"spend","id":"spend","label":"Spend","paramPath":"measures.spend","default":true}],"predicates":[{"id":"dateRange","startParamPath":"filters.from","endParamPath":"filters.to","prefill":{"start":"from","end":"to"}}],"dataSources":[{"id":"prior","dataSourceRef":"steward-orders","request":{"filters":{},"measures":{"spend":true}},"scope":{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}}}]}}`)
	require.NoError(t, json.Unmarshal(builder, new(any)))
	envelope["builderDefinition"] = builder
	envelope["reportDocument"] = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Comparison","blocks":[{"id":"current","kind":"kpiBlock","datasetRef":"primary","valueField":"spend","secondaryDatasetRef":"prior","secondaryField":"spend","secondaryCalculation":"relativeChange"}]}`)
	envelope["state"] = map[string]interface{}{"selectedMeasures": []string{"spend"}}
	raw, err = json.Marshal(envelope)
	require.NoError(t, err)
	var trusted registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &trusted))
	trusted.DataSources = map[string]json.RawMessage{"steward-orders": json.RawMessage(`{"id":"steward-orders","backend":{"kind":"inline","rows":[]}}`)}
	trusted.Dependencies = []registry.ReportDependency{{Kind: "builder", ID: trusted.BuilderRef, ContentFingerprint: identity.ContentFingerprint(trusted.BuilderDefinition)}, {Kind: "datasource", ID: "steward-orders", ContentFingerprint: identity.ContentFingerprint(trusted.DataSources["steward-orders"])}, {Kind: "report", ID: "report://example/comparison", ContentFingerprint: identity.ContentFingerprint(trusted.ReportDocument)}}
	raw, err = json.Marshal(trusted)
	require.NoError(t, err)
	original := string(raw)
	_, err = materializer.Lower(context.Background(), raw)
	require.ErrorContains(t, err, "bounded civil date range")
	for _, window := range []struct{ from, to, priorFrom, priorTo string }{
		{"2026-09-21", "2026-10-20", "2026-08-22", "2026-09-20"},
		{"2026-10-01", "2026-10-07", "2026-09-24", "2026-09-30"},
	} {
		bound, err := bindAuthoredCompileParameters(raw, map[string]interface{}{"from": window.from, "to": window.to})
		require.NoError(t, err)
		spec, err := materializer.LowerWithRequestBase(context.Background(), raw, bound)
		require.NoError(t, err)
		compiled, err := NewReportSpecCompiler(nil).Compile(context.Background(), &CompileRequest{Document: spec})
		require.NoError(t, err)
		var out struct {
			Datasets []struct {
				ID      string                 `json:"id"`
				Request map[string]interface{} `json:"request"`
			} `json:"datasets"`
		}
		require.NoError(t, json.Unmarshal(compiled.ReportSpec, &out))
		require.Len(t, out.Datasets, 2)
		for _, dataset := range out.Datasets {
			if dataset.ID == "prior" {
				require.Equal(t, window.priorFrom, reportRequestPath(dataset.Request, "filters.from"))
				require.Equal(t, window.priorTo, reportRequestPath(dataset.Request, "filters.to"))
			}
		}
	}
	require.Equal(t, original, string(raw), "invocations must not change the approved source")
	uri, err := identity.ParseResourceURI("report://example/comparison")
	require.NoError(t, err)
	allowed := true
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "verified-account", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(nil), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	seen := map[string]string{}
	var seenMu sync.Mutex
	service.SetResourceDatasetExecutor(func(_ context.Context, _ identity.ResolvedResource, _ *dsproto.DataSource, args map[string]interface{}) (*dsproto.FetchResult, error) {
		from := reportRequestPath(args, "filters.from")
		to := reportRequestPath(args, "filters.to")
		seenMu.Lock()
		seen[from] = to
		seenMu.Unlock()
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"spend": 80}}}, nil
	})
	request := &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, Parameters: map[string]interface{}{"from": "2026-10-01", "to": "2026-10-07"}}
	out, err := service.ExecuteResource(context.Background(), request)
	require.NoError(t, err)
	require.NotEmpty(t, out.ReportFill)
	require.Equal(t, map[string]string{"2026-10-01": "2026-10-07", "2026-09-24": "2026-09-30"}, seen)
	allowed = false
	seen = map[string]string{}
	_, err = service.ExecuteResource(context.Background(), request)
	require.Error(t, err)
	require.Empty(t, seen)
	invalid, err := bindAuthoredCompileParameters(raw, map[string]interface{}{"from": "invalid", "to": "2026-10-20"})
	require.NoError(t, err)
	_, err = materializer.LowerWithRequestBase(context.Background(), raw, invalid)
	require.ErrorContains(t, err, "bounded civil date range")
}

func TestAuthoredSelectedMetricDrivesScopeAndPrintWithoutChangingSource(t *testing.T) {
	raw, err := os.ReadFile("../materializer/testdata/authored-envelope.json")
	require.NoError(t, err)
	var envelope registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &envelope))
	envelope.BuilderDefinition = json.RawMessage(`{"kind":"forge.reporting.builder","id":"stewardPerformance","reportBuilder":{"dataSourceRef":"steward-orders","measures":[{"key":"spend","id":"spend","label":"Spend","paramPath":"measures.spend","default":true}],"predicates":[{"id":"rankingMetric","kind":"select","paramPath":"options.rankingMetric","default":"Spend","options":[{"value":"Spend","label":"Spend"},{"value":"CPM","label":"CPM"}]}]}}`)
	// The real Publisher option is not a pinned predicate; its named datasets
	// declare the global scope parameter used by conditional chart blocks.
	var builder map[string]interface{}
	require.NoError(t, json.Unmarshal(envelope.BuilderDefinition, &builder))
	builder["reportBuilder"].(map[string]interface{})["dataSources"] = []interface{}{map[string]interface{}{
		"id": "details", "dataSourceRef": "steward-orders", "scopeParamOptions": []interface{}{map[string]interface{}{
			"id": "rankingMetric", "kind": "select", "paramPath": "options.rankingMetric",
		}},
	}}
	envelope.BuilderDefinition, err = json.Marshal(builder)
	require.NoError(t, err)

	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Selected metric","blocks":[{"id":"spendView","kind":"markdownBlock","markdown":"Spend-only view","runtime":{"visibleWhen":{"source":"filters","field":"rankingMetric","equals":"Spend"}}},{"id":"cpmView","kind":"markdownBlock","markdown":"CPM-only view","runtime":{"visibleWhen":{"source":"filters","field":"rankingMetric","equals":"CPM"}}}]}`)
	envelope.State = json.RawMessage(`{"selectedMeasures":["spend"],"scopeParams":{"rankingMetric":"Spend"}}`)
	envelope.DataSources = map[string]json.RawMessage{"steward-orders": json.RawMessage(`{"id":"steward-orders","backend":{"kind":"inline","rows":[]}}`)}
	envelope.Dependencies = []registry.ReportDependency{{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)}, {Kind: "datasource", ID: "steward-orders", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["steward-orders"])}, {Kind: "report", ID: "report://example/metric", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)}}
	raw, err = json.Marshal(envelope)
	require.NoError(t, err)
	original := string(raw)
	for _, metric := range []string{"CPM", "Spend"} {
		bound, bindErr := bindAuthoredCompileParameters(raw, map[string]interface{}{"rankingMetric": metric, "unpublished": "ignored"})
		require.NoError(t, bindErr)
		spec, lowerErr := materializer.LowerWithRequestBase(context.Background(), raw, bound)
		require.NoError(t, lowerErr)
		var lowered struct {
			Scope struct {
				Params []struct {
					ID    string      `json:"id"`
					Value interface{} `json:"value"`
				} `json:"params"`
			} `json:"scope"`
		}
		require.NoError(t, json.Unmarshal(spec, &lowered))
		found := false
		for _, param := range lowered.Scope.Params {
			if param.ID == "rankingMetric" {
				require.Equal(t, metric, param.Value)
				found = true
			}
		}
		require.True(t, found, "selected metric must enter the canonical lowered scope")
		artifacts, materializeErr := materializer.Materialize(context.Background(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"spend":4}]}`)})
		require.NoError(t, materializeErr)
		require.Contains(t, string(artifacts.ReportPrint), metric+"-only view")
		other := "Spend"
		if metric == "Spend" {
			other = "CPM"
		}
		require.NotContains(t, string(artifacts.ReportPrint), other+"-only view")
	}
	require.Equal(t, original, string(raw), "invocation values must not mutate the pinned authored source")
}
