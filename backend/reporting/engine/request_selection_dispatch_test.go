package reporting

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/viant/forge/backend/reporting/registry"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	identity "github.com/viant/forge/backend/resource"
)

// Independently authored synthetic report: one producer exposes a named result
// through its existing method. The typed report boundary must retain selection.
func TestTypedReportRequestSelectionReachesDatasourceTransport(t *testing.T) {
	input := []byte(`{"version":1,"kind":"reportSpec","source":{"kind":"report","containerId":"sample","stateKey":"sample","dataSourceRef":"rows"},"title":"Synthetic named result","parameters":{"viewMode":"table","groupBy":"","pageSize":10,"orderField":"","orderDir":"asc"},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["detail"]},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"rows","request":{"resultSet":"detailRows","summary":false,"measures":{"amount":true},"limit":10,"offset":0}}],"blocks":[{"id":"detail","kind":"tableBlock","title":"Details","datasetRef":"primary","columns":[{"key":"amount","label":"Amount"}]}]}`)
	var typed reportspec.ReportSpec
	if err := json.Unmarshal(input, &typed); err != nil {
		t.Fatal(err)
	}
	if _, err := reportspec.DecodeJSON(input); err != nil {
		t.Fatalf("schema-admitted request rejected by typed decoder: %v", err)
	}
	roundtrip, err := json.Marshal(typed)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(registry.ReportEnvelope{
		SchemaVersion: 1,
		ReportSpec:    roundtrip,
		DataSources:   map[string]json.RawMessage{"rows": json.RawMessage(`{"id":"rows","cardinality":"collection","backend":{"kind":"mcp_tool","service":"sample-producer","method":"read"}}`)},
	})
	if err != nil {
		t.Fatal(err)
	}
	uri, err := identity.ParseResourceURI("report://example/named-result")
	if err != nil {
		t.Fatal(err)
	}
	resolver := &identity.ResourceResolver{
		Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }},
		Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
			return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "sample-account", ValidUntil: time.Now().Add(time.Minute)}, nil
		}),
	}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	calls := 0
	service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(_ context.Context, method string, args map[string]interface{}) (string, error) {
		calls++
		if method != "sample-producer:read" || args["resultSet"] != "detailRows" {
			t.Fatalf("named result selection lost at transport: method=%s args=%v", method, args)
		}
		if summary, present := args["summary"]; !present || summary != false {
			t.Fatalf("explicit summary:false lost at transport: %v", args)
		}
		return `{"data":[{"amount":12}]}`, nil
	}), service.AuthorizeResourceDataset))
	result, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, FillOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 || result == nil || len(result.Datasets["primary"].Rows) != 1 || len(result.ReportFill) == 0 {
		t.Fatalf("missing execution result: calls=%d result=%+v", calls, result)
	}
}
