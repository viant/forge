package reporting

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

// This fixture is independently authored: two selectors share a producer field,
// while each section owns its selection and the summary excludes both.
func scopedAliasEnvelope(t *testing.T, primaryExclude []string, overlap bool) json.RawMessage {
	t.Helper()
	raw, err := os.ReadFile("../materializer/testdata/authored-envelope.json")
	require.NoError(t, err)
	var envelope registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &envelope))
	builder := map[string]interface{}{}
	require.NoError(t, json.Unmarshal([]byte(`{"kind":"forge.reporting.builder","id":"sampleBuilder","reportBuilder":{"dataSourceRef":"sampleRows","measures":[{"id":"value","key":"value","label":"Value","paramPath":"measures.value","default":true}],"predicates":[{"id":"overviewTag","kind":"value","pinned":true,"multiple":true,"paramPath":"filters.tag","default":["alpha"]},{"id":"detailTag","kind":"value","pinned":true,"multiple":true,"paramPath":"filters.tag","default":["alpha"]}],"request":{"baseParameters":{"filters":{"account":17}}},"dataSources":[{"id":"overview","dataSourceRef":"sampleRows","request":{"resultSet":"overview","measures":{"value":true}},"columnOptions":[{"key":"value","label":"Value","kind":"measure"}],"scope":{"mode":"exclude","exclude":["detailTag"]},"scopeParamOptions":[{"id":"overviewTag","kind":"value","multiple":true,"paramPath":"filters.tag"},{"id":"detailTag","kind":"value","multiple":true,"paramPath":"filters.tag"}]},{"id":"detail","dataSourceRef":"sampleRows","request":{"resultSet":"detail","measures":{"value":true}},"columnOptions":[{"key":"value","label":"Value","kind":"measure"}],"scope":{"mode":"exclude","exclude":["overviewTag"]},"scopeParamOptions":[{"id":"overviewTag","kind":"value","multiple":true,"paramPath":"filters.tag"},{"id":"detailTag","kind":"value","multiple":true,"paramPath":"filters.tag"}]}]}}`), &builder))
	config := builder["reportBuilder"].(map[string]interface{})
	if primaryExclude != nil {
		config["scope"] = map[string]interface{}{"mode": "exclude", "exclude": primaryExclude}
	}
	if overlap {
		config["dataSources"].([]interface{})[0].(map[string]interface{})["scope"] = map[string]interface{}{"mode": "inherit"}
	}
	envelope.BuilderDefinition, err = json.Marshal(builder)
	require.NoError(t, err)
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","id":"records","title":"Independent selections","blocks":[{"id":"summaryTable","kind":"tableBlock","datasetRef":"primary","columns":[{"key":"value","label":"Value"}]},{"id":"overviewTable","kind":"tableBlock","datasetRef":"overview","columns":[{"key":"value","label":"Value"}]},{"id":"detailTable","kind":"tableBlock","datasetRef":"detail","columns":[{"key":"value","label":"Value"}]}]}`)
	envelope.State = json.RawMessage(`{"selectedMeasures":["value"],"staticFilters":{"untouched":"saved"}}`)
	envelope.DataSources = map[string]json.RawMessage{"sampleRows": json.RawMessage(`{"id":"sampleRows","cardinality":"collection","backend":{"kind":"mcp_tool","service":"example","method":"rows/read"},"selectors":{"data":"rows"}}`)}
	envelope.Dependencies = []registry.ReportDependency{{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)}, {Kind: "datasource", ID: "sampleRows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["sampleRows"])}, {Kind: "report", ID: "report://example/selections", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)}}
	raw, err = json.Marshal(envelope)
	require.NoError(t, err)
	return raw
}

func scopedAliasService(t *testing.T, raw json.RawMessage) (*Service, *int) {
	t.Helper()
	uri, err := identity.ParseResourceURI("report://example/selections")
	require.NoError(t, err)
	loads := new(int)
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { *loads++; return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "fixture", ValidUntil: time.Now().Add(time.Hour)}, nil
	})}
	return New(Options{Compiler: NewReportSpecCompiler(nil), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }}), loads
}

func assertAliasScope(t *testing.T, spec json.RawMessage, left, right interface{}) {
	t.Helper()
	var decoded struct {
		Scope struct {
			Params []struct {
				ID    string
				Value interface{}
			}
		}
	}
	require.NoError(t, json.Unmarshal(spec, &decoded))
	got := map[string]interface{}{}
	for _, p := range decoded.Scope.Params {
		got[p.ID] = p.Value
	}
	require.Equal(t, left, got["overviewTag"])
	require.Equal(t, right, got["detailTag"])
}

func TestAuthoredScopedAliasesCompileAndDispatch(t *testing.T) {
	values := func(s string) []interface{} { return []interface{}{s} }
	for _, tc := range []struct {
		name        string
		left, right []interface{}
	}{
		{"defaults", values("alpha"), values("alpha")},
		{"opposed", values("beta"), values("alpha")},
		{"reverse", values("alpha"), values("beta")},
		{"clear overview", []interface{}{}, values("alpha")},
		{"clear detail", values("alpha"), []interface{}{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw := scopedAliasEnvelope(t, []string{"overviewTag", "detailTag"}, false)
			original := string(raw)
			service, loads := scopedAliasService(t, raw)
			parameters := map[string]interface{}{"overviewTag": tc.left, "detailTag": tc.right}
			compiled, err := service.Compile(t.Context(), &CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: parameters})
			require.NoError(t, err)
			assertAliasScope(t, compiled.ReportSpec, tc.left, tc.right)
			seen := map[string]interface{}{}
			var mu sync.Mutex
			service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(_ context.Context, method string, args map[string]interface{}) (string, error) {
				require.Equal(t, "example:rows/read", method)
				id, _ := args["resultSet"].(string)
				if id == "" {
					id = "primary"
				}
				mu.Lock()
				filters, _ := args["filters"].(map[string]interface{})
				seen[id] = filters["tag"]
				mu.Unlock()
				require.EqualValues(t, 17, filters["account"])
				return `{"rows":[{"value":4}]}`, nil
			}), service.AuthorizeResourceDataset))
			request := &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: parameters}
			out, err := service.ExecuteResource(t.Context(), request)
			require.NoError(t, err)
			require.Len(t, seen, 3)
			require.Nil(t, seen["primary"])
			require.Equal(t, tc.left, seen["overview"])
			require.Equal(t, tc.right, seen["detail"])
			assertAliasScope(t, out.ReportSpec, tc.left, tc.right)
			prepared, err := service.PrepareReport(t.Context(), &CompileRequest{Resource: request.Resource})
			require.NoError(t, err)
			before := *loads
			seen = map[string]interface{}{}
			out, err = service.ExecutePreparedReport(t.Context(), prepared, request)
			require.NoError(t, err)
			require.Equal(t, before, *loads, "prepared invocation must not reload metadata")
			require.Len(t, seen, 3)
			require.Equal(t, tc.left, seen["overview"])
			require.Equal(t, tc.right, seen["detail"])
			assertAliasScope(t, out.ReportSpec, tc.left, tc.right)
			require.Equal(t, original, string(raw))
		})
	}
}

func TestAuthoredScopedAliasesPrimaryAndOverlappingBindings(t *testing.T) {
	parameters := map[string]interface{}{"overviewTag": []interface{}{"beta"}, "detailTag": []interface{}{"alpha"}}
	for _, excluded := range []string{"overviewTag", "detailTag"} {
		t.Run(excluded, func(t *testing.T) {
			raw := scopedAliasEnvelope(t, []string{excluded}, false)
			service, _ := scopedAliasService(t, raw)
			out, err := service.Compile(t.Context(), &CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: parameters})
			require.NoError(t, err)
			assertAliasScope(t, out.ReportSpec, parameters["overviewTag"], parameters["detailTag"])
		})
	}
	service, _ := scopedAliasService(t, scopedAliasEnvelope(t, nil, false))
	_, err := service.Compile(t.Context(), &CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: parameters})
	require.ErrorContains(t, err, "conflicting report parameter aliases")
	service, _ = scopedAliasService(t, scopedAliasEnvelope(t, []string{"overviewTag", "detailTag"}, true))
	calls := 0
	service.SetResourceDatasetExecutor(func(context.Context, identity.ResolvedResource, *dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
		calls++
		return &dsproto.FetchResult{}, nil
	})
	_, err = service.ExecuteResource(t.Context(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: parameters})
	require.ErrorContains(t, err, "conflicting report parameter aliases")
	require.Zero(t, calls, "overlapping aliases must fail before any dataset fetch")
}

func TestAuthoredSingleAliasStillCompiles(t *testing.T) {
	raw := scopedAliasEnvelope(t, nil, false)
	var envelope registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &envelope))
	var builder map[string]interface{}
	require.NoError(t, json.Unmarshal(envelope.BuilderDefinition, &builder))
	config := builder["reportBuilder"].(map[string]interface{})
	config["predicates"] = config["predicates"].([]interface{})[:1]
	envelope.BuilderDefinition, _ = json.Marshal(builder)
	for i := range envelope.Dependencies {
		if envelope.Dependencies[i].Kind == "builder" {
			envelope.Dependencies[i].ContentFingerprint = identity.ContentFingerprint(envelope.BuilderDefinition)
		}
	}
	raw, _ = json.Marshal(envelope)
	service, _ := scopedAliasService(t, raw)
	out, err := service.Compile(t.Context(), &CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: map[string]interface{}{"overviewTag": []interface{}{"beta"}, "detailTag": []interface{}{"alpha"}}})
	require.NoError(t, err)
	require.NotEmpty(t, out.ReportSpec)
}

func TestAuthoredExcludedDatesRetainInvocationScope(t *testing.T) {
	raw := scopedAliasEnvelope(t, []string{"overviewTag", "detailTag", "dates"}, false)
	var envelope registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &envelope))
	var builder map[string]interface{}
	require.NoError(t, json.Unmarshal(envelope.BuilderDefinition, &builder))
	config := builder["reportBuilder"].(map[string]interface{})
	config["predicates"] = append(config["predicates"].([]interface{}), map[string]interface{}{"id": "dates", "kind": "dateRange", "startParamPath": "filters.from", "endParamPath": "filters.to", "prefill": map[string]interface{}{"start": "from", "end": "to"}})
	envelope.BuilderDefinition, _ = json.Marshal(builder)
	envelope.State = json.RawMessage(`{"selectedMeasures":["value"],"scopeParams":{"dates":{"preset":"last7Days","timeZone":"UTC"}}}`)
	for i := range envelope.Dependencies {
		if envelope.Dependencies[i].Kind == "builder" {
			envelope.Dependencies[i].ContentFingerprint = identity.ContentFingerprint(envelope.BuilderDefinition)
		}
	}
	raw, _ = json.Marshal(envelope)
	service, _ := scopedAliasService(t, raw)
	out, err := service.Compile(t.Context(), &CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: map[string]interface{}{"overviewTag": []interface{}{"beta"}, "detailTag": []interface{}{"alpha"}, "from": "2030-01-01", "to": "2030-01-07"}})
	require.NoError(t, err)
	var spec struct {
		Scope struct {
			Params []struct {
				ID    string
				Value interface{}
			}
		}
	}
	require.NoError(t, json.Unmarshal(out.ReportSpec, &spec))
	for _, param := range spec.Scope.Params {
		if param.ID == "dates" {
			value, ok := param.Value.(map[string]interface{})
			require.True(t, ok)
			require.Equal(t, "2030-01-01", value["start"])
			require.Equal(t, "2030-01-07", value["end"])
			require.NotContains(t, value, "preset")
			return
		}
	}
	t.Fatal("date control missing")
}

func TestAuthoredScopedScalarAliases(t *testing.T) {
	raw := scopedAliasEnvelope(t, []string{"overviewTag", "detailTag"}, false)
	var envelope registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &envelope))
	var builder map[string]interface{}
	require.NoError(t, json.Unmarshal(envelope.BuilderDefinition, &builder))
	config := builder["reportBuilder"].(map[string]interface{})
	for _, p := range config["predicates"].([]interface{}) {
		predicate := p.(map[string]interface{})
		predicate["multiple"] = false
		predicate["default"] = "alpha"
	}
	for _, d := range config["dataSources"].([]interface{}) {
		for _, p := range d.(map[string]interface{})["scopeParamOptions"].([]interface{}) {
			p.(map[string]interface{})["multiple"] = false
		}
	}
	envelope.BuilderDefinition, _ = json.Marshal(builder)
	for i := range envelope.Dependencies {
		if envelope.Dependencies[i].Kind == "builder" {
			envelope.Dependencies[i].ContentFingerprint = identity.ContentFingerprint(envelope.BuilderDefinition)
		}
	}
	raw, _ = json.Marshal(envelope)
	service, _ := scopedAliasService(t, raw)
	out, err := service.Compile(t.Context(), &CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: map[string]interface{}{"overviewTag": "beta", "detailTag": "alpha"}})
	require.NoError(t, err)
	assertAliasScope(t, out.ReportSpec, "beta", "alpha")
}

func TestAuthoredPartialScopedAliasesRetainOmittedState(t *testing.T) {
	for _, edited := range []string{"overviewTag", "detailTag"} {
		for _, value := range [][]interface{}{{"beta"}, {}} {
			for _, excluded := range [][]string{{"detailTag"}, {"overviewTag"}, {"overviewTag", "detailTag"}} {
				name := fmt.Sprintf("%s=%v primary excludes %v", edited, value, excluded)
				t.Run(name, func(t *testing.T) {
					raw := scopedAliasEnvelope(t, excluded, false)
					service, _ := scopedAliasService(t, raw)
					parameters := map[string]interface{}{edited: value}
					left, right := []interface{}{"alpha"}, []interface{}{"alpha"}
					if edited == "overviewTag" {
						left = value
					} else {
						right = value
					}
					compiled, err := service.Compile(t.Context(), &CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: parameters})
					require.NoError(t, err)
					assertAliasScope(t, compiled.ReportSpec, left, right)
					seen := map[string]interface{}{}
					var mu sync.Mutex
					service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(_ context.Context, _ string, args map[string]interface{}) (string, error) {
						id, _ := args["resultSet"].(string)
						if id == "" {
							id = "primary"
						}
						filters, _ := args["filters"].(map[string]interface{})
						mu.Lock()
						seen[id] = filters["tag"]
						mu.Unlock()
						return `{"rows":[{"value":4}]}`, nil
					}), service.AuthorizeResourceDataset))
					out, err := service.ExecuteResource(t.Context(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: parameters})
					require.NoError(t, err)
					require.Len(t, seen, 3)
					require.Equal(t, left, seen["overview"])
					require.Equal(t, right, seen["detail"])
					assertAliasScope(t, out.ReportSpec, left, right)
					if len(excluded) == 2 {
						require.Nil(t, seen["primary"])
					} else if excluded[0] == "detailTag" {
						require.Equal(t, left, seen["primary"])
					} else {
						require.Equal(t, right, seen["primary"])
					}
				})
			}
		}
	}
}

func TestAuthoredPartialScopedAliasRetainsSavedClear(t *testing.T) {
	raw := scopedAliasEnvelope(t, []string{"detailTag"}, false)
	var envelope registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &envelope))
	envelope.State = json.RawMessage(`{"selectedMeasures":["value"],"staticFilters":{"detailTag":[]}}`)
	raw, err := json.Marshal(envelope)
	require.NoError(t, err)
	service, _ := scopedAliasService(t, raw)
	parameters := map[string]interface{}{"overviewTag": []interface{}{"beta"}}
	compiled, err := service.Compile(t.Context(), &CompileRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: parameters})
	require.NoError(t, err)
	assertAliasScope(t, compiled.ReportSpec, []interface{}{"beta"}, []interface{}{})
	var mu sync.Mutex
	seen := map[string]interface{}{}
	service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(_ context.Context, _ string, args map[string]interface{}) (string, error) {
		id, _ := args["resultSet"].(string)
		filters, _ := args["filters"].(map[string]interface{})
		mu.Lock()
		seen[id] = filters["tag"]
		mu.Unlock()
		return `{"rows":[{"value":4}]}`, nil
	}), service.AuthorizeResourceDataset))
	out, err := service.ExecuteResource(t.Context(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: "report://example/selections"}, Parameters: parameters})
	require.NoError(t, err)
	require.Empty(t, seen["detail"], "an omitted saved clear must not borrow the edited sibling")
	assertAliasScope(t, out.ReportSpec, []interface{}{"beta"}, []interface{}{})
}
