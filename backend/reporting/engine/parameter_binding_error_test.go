package reporting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
)

func bindingFixtureDescriptor(t *testing.T) *dsproto.DataSource {
	t.Helper()
	var descriptor dsproto.DataSource
	if err := json.Unmarshal([]byte(`{"id":"rows","parameters":[{"name":"limit","type":"int"},{"name":"advertiserId","type":"int"},{"name":"studyNames","type":"string"}],"backend":{"kind":"inline","rows":[]}}`), &descriptor); err != nil {
		t.Fatal(err)
	}
	return &descriptor
}

const bindingFixtureBuilder = `{"reportBuilder":{"predicates":[{"id":"advertiserId","paramPath":"filters.advertiserId"},{"id":"studyNames","paramPath":"filters.studyNames","multiple":true,"prefill":"studies"}]}}`

func TestReportParameterBindingUsesEffectiveDeclarations(t *testing.T) {
	base := map[string]interface{}{"offset": 0, "filters": map[string]interface{}{"advertiserId": 7}}
	args, err := reportDatasetArguments(base, map[string]interface{}{"advertiserId": 0, "studyNames": []interface{}{"one"}, "limit": false}, bindingFixtureDescriptor(t), json.RawMessage(bindingFixtureBuilder), nil)
	if err != nil {
		t.Fatal(err)
	}
	if args["limit"] != false || args["filters"].(map[string]interface{})["advertiserId"] != 0 {
		t.Fatalf("binding changed false/zero: %v", args)
	}
	_, err = reportDatasetArguments(base, map[string]interface{}{"cuts": []interface{}{"private-token"}}, bindingFixtureDescriptor(t), json.RawMessage(bindingFixtureBuilder), nil)
	if !errors.Is(err, ErrReportParameterBinding) {
		t.Fatalf("missing typed binding error: %v", err)
	}
	var typed *ReportParameterBindingError
	if !errors.As(err, &typed) {
		t.Fatal("missing typed diagnostic")
	}
	d := typed.ReportParameterBindingDiagnostic()
	if d.Path != `parameters["cuts"]` || d.Code != "undeclared_report_parameter" {
		t.Fatal(d)
	}
	for _, key := range []string{"advertiserId", "studyNames", "studies", "limit", "offset"} {
		if !strings.Contains(d.Message, `"`+key+`"`) {
			t.Fatalf("missing effective declaration %s: %s", key, d.Message)
		}
	}
	if strings.Contains(d.Message, "filters") || strings.Contains(d.Message, "private-token") {
		t.Fatal("private destination/value exposed")
	}
	aliasArgs, err := reportDatasetArguments(base, map[string]interface{}{"studies": []interface{}{}}, bindingFixtureDescriptor(t), json.RawMessage(bindingFixtureBuilder), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(aliasArgs["filters"].(map[string]interface{})["studyNames"].([]interface{})) != 0 {
		t.Fatal("empty array changed")
	}
}
func TestReportParameterBindingPreservesReservedAndWideningRejections(t *testing.T) {
	for _, key := range []string{"_private", "backend", "source", "service", "method", "filters", "options"} {
		_, err := reportDatasetArguments(nil, map[string]interface{}{key: "private-token"}, bindingFixtureDescriptor(t), json.RawMessage(bindingFixtureBuilder), nil)
		if err == nil || errors.Is(err, ErrReportParameterBinding) {
			t.Fatalf("reserved key %s was relabeled: %v", key, err)
		}
	}
	for _, params := range []map[string]interface{}{
		{"studyNames": []interface{}{"one"}, "studies": []interface{}{"two"}},
		{"dimensions": map[string]interface{}{"unapproved": true}},
	} {
		_, err := reportDatasetArguments(map[string]interface{}{"dimensions": map[string]interface{}{"approved": true}}, params, bindingFixtureDescriptor(t), json.RawMessage(bindingFixtureBuilder), nil)
		if err == nil || errors.Is(err, ErrReportParameterBinding) {
			t.Fatalf("existing alias/widening rejection relabeled: %v", err)
		}
	}
}
func TestReportParameterBindingDiagnosticsBoundAndRedactInputs(t *testing.T) {
	allowed := map[string]bool{"/private/source?token=secret": true, "backend": true}
	for i := 0; i < 100; i++ {
		allowed[fmt.Sprintf("input%03d", i)] = true
	}
	first := newReportParameterBindingError("/private/source?token=secret", allowed, nil).(*ReportParameterBindingError).ReportParameterBindingDiagnostic()
	second := newReportParameterBindingError("/private/source?token=secret", allowed, nil).(*ReportParameterBindingError).ReportParameterBindingDiagnostic()
	if first != second || first.Path != "parameters" || len(first.Message) > 1024 {
		t.Fatal("unstable/unbounded diagnostic")
	}
	if !strings.Contains(first.Message, "...") || strings.Contains(first.Message, "private") || strings.Contains(first.Message, "secret") || strings.Contains(first.Message, "backend") {
		t.Fatal(first)
	}
	if first.Cause != "" {
		t.Fatal("diagnostic retained private cause")
	}
}

const bindingFixtureSpec = `{"version":1,"kind":"reportSpec","source":{"kind":"report","containerId":"demo","stateKey":"demo","dataSourceRef":"rows"},"title":"Demo","parameters":{"viewMode":"table","groupBy":"","pageSize":10,"orderField":"","orderDir":"asc"},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["summary"]},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"rows","request":{}}],"blocks":[{"id":"summary","kind":"markdownBlock","datasetRef":"primary","markdown":"Demo"}]}`

func TestReportParameterBindingActualExecutionRejectsBeforeFetch(t *testing.T) {
	raw, err := json.Marshal(map[string]interface{}{"schemaVersion": 1, "reportDocument": map[string]interface{}{"title": "Demo"}, "reportSpec": json.RawMessage(bindingFixtureSpec), "dataSources": map[string]interface{}{"rows": bindingFixtureDescriptor(t)}})
	if err != nil {
		t.Fatal(err)
	}
	uri, _ := identity.ParseResourceURI("report://example/demo")
	allowed := true
	expiry := time.Now().Add(time.Minute)
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "synthetic-account", ValidUntil: expiry}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	calls := 0
	service.SetResourceDatasetExecutor(func(context.Context, identity.ResolvedResource, *dsproto.DataSource, map[string]interface{}) (*dsproto.FetchResult, error) {
		calls++
		return nil, errors.New("unexpected private execution")
	})
	request := &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, Parameters: map[string]interface{}{"advertiserId": 7, "studyNames": []interface{}{"one"}, "cuts": []interface{}{"All"}}}
	_, err = service.ExecuteResource(context.Background(), request)
	if !errors.Is(err, ErrReportParameterBinding) || calls != 0 {
		t.Fatalf("binding did not stop before dispatch: %v calls=%d", err, calls)
	}
	allowed = false
	_, err = service.ExecuteResource(context.Background(), request)
	if !errors.Is(err, identity.ErrResourceDenied) || errors.Is(err, ErrReportParameterBinding) || calls != 0 {
		t.Fatalf("denial changed: %v calls=%d", err, calls)
	}
	allowed = true
	expiry = time.Now().Add(-time.Second)
	_, err = service.ExecuteResource(context.Background(), request)
	if !errors.Is(err, identity.ErrResourceDenied) || errors.Is(err, ErrReportParameterBinding) || calls != 0 {
		t.Fatalf("lease failure changed: %v calls=%d", err, calls)
	}
}
