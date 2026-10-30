package reporting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"
	"unicode/utf16"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	identity "github.com/viant/forge/backend/resource"
)

func tableProjectionFixture(t *testing.T) (*Service, *ExecuteResourceRequest, *[]string, *bool) {
	t.Helper()
	// Independent synthetic report: the dashboard needs complete totals, while
	// the selected table uses a separate complete dataset and scoped calculation.
	raw := json.RawMessage(`{"schemaVersion":1,"reportDocument":{"title":"Observations"},"reportSpec":{"version":1,"kind":"reportSpec","source":{"kind":"report","containerId":"sample","stateKey":"sample","dataSourceRef":"records"},"title":"Observations","parameters":{"viewMode":"table","groupBy":"","pageSize":2,"orderField":"","orderDir":"asc"},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["metric","details"]},"refinements":[],"calculatedFields":[{"id":"doubled","key":"doubled","kind":"rowCalc","label":"Doubled","dataType":"number","datasetRef":"detail","dependencies":["amount"],"expr":"amount * 2"}],"datasets":[{"id":"primary","dataSourceRef":"records","request":{"offset":0,"limit":2},"resultContract":{"shape":"rows","rowPath":"rows","hasMorePath":"dataInfo.hasMore"}},{"id":"detail","dataSourceRef":"records","request":{"offset":0,"limit":2},"resultContract":{"shape":"rows","rowPath":"rows","hasMorePath":"dataInfo.hasMore"}}],"blocks":[{"id":"metric","kind":"kpiBlock","title":"Total","datasetRef":"primary","valueField":"amount","valueLabel":"Total","runtime":{"requireCompleteDataset":true}},{"id":"details","kind":"tableBlock","title":"Details","datasetRef":"detail","runtime":{"requireCompleteDataset":true},"columns":[{"key":"amount","label":"Amount"},{"key":"doubled","label":"Doubled"}]}]},"dataSources":{"records":{"id":"records","cardinality":"collection","paging":{"enabled":true,"mode":"offset","parameters":{"page":"offset","size":"limit"},"dataInfoSelectors":{"hasMore":"hasMore"}},"backend":{"kind":"mcp_tool","service":"synthetic","method":"read"}}}}`)
	uri, _ := identity.ParseResourceURI("report://example/observations")
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, c []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		return identity.ResourceDecision{Candidate: c[0], AuthorityBinding: "synthetic-account", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	calls := []string{}
	more := false
	service.SetResourceDatasetExecutor(func(_ context.Context, _ identity.ResolvedResource, _ *dsproto.DataSource, _ map[string]interface{}) (*dsproto.FetchResult, error) {
		calls = append(calls, "fetch")
		return &dsproto.FetchResult{Rows: []map[string]interface{}{{"amount": float64(7)}}, DataInfo: map[string]interface{}{"hasMore": more}}, nil
	})
	return service, &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, FillOnly: true, DatasetFetchMode: DatasetFetchPage}, &calls, &more
}

func TestSelectedTableMaterializesWithoutUnrelatedCompleteKPI(t *testing.T) {
	service, request, calls, more := tableProjectionFixture(t)
	id := "details"
	request.TableBlockID = &id
	result, err := service.ExecuteResource(t.Context(), request)
	if err != nil {
		t.Fatal(err)
	}
	if len(*calls) != 1 || len(result.Datasets) != 1 || result.Datasets["detail"] == nil {
		t.Fatal("selected table fetched unrelated datasets")
	}
	fill, err := reportfill.DecodeDatasourceJSON(result.ReportFill)
	if err != nil {
		t.Fatal(err)
	}
	if len(fill.Blocks) != 1 || fill.Blocks[0].ID != "details" || len(fill.Datasets) != 1 {
		t.Fatal("unselected dashboard materialized")
	}
	if got := fill.Datasets[0].Rows[0]["doubled"]; got != float64(14) {
		t.Fatalf("selected scoped calculation lost: %v", got)
	}
	if strings.Contains(string(result.ReportSpec), `"id":"metric"`) || result.Resource.URI != request.Resource.URI {
		t.Fatal("selected presentation or admitted resource identity changed")
	}
	// Use the same published JSON/UTF-16 FNV identity contract as export
	// validation. The general export decoder does not accept engine resultContract
	// metadata yet; that independent decoder limitation must not hide a bad pair.
	var hash uint32 = 2166136261
	for _, unit := range utf16.Encode([]rune(string(result.ReportSpec))) {
		hash ^= uint32(unit)
		hash *= 16777619
	}
	if fill.SpecHash != fmt.Sprintf("fnv1a:%08x", hash) {
		t.Fatalf("selected spec/fill pair is incoherent: %s", fill.SpecHash)
	}

	// Projecting an invocation must not mutate the admitted full source or pin.
	fullRequest := *request
	fullRequest.TableBlockID = nil
	full, err := service.ExecuteResource(t.Context(), &fullRequest)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(full.ReportSpec), `"id":"metric"`) || len(full.Datasets) != 2 || full.Resource.ResourceCandidate != result.Resource.ResourceCandidate {
		t.Fatal("selected execution mutated full report ownership")
	}

	*more = true
	if out, err := service.ExecuteResource(t.Context(), request); out != nil || err == nil || !strings.Contains(err.Error(), "requires explicitly complete dataset") {
		t.Fatalf("selected table completeness bypassed: %v", err)
	}
}

func TestTableProjectionLeavesFullAndDatasetOnlyExecutionUnchanged(t *testing.T) {
	service, request, _, _ := tableProjectionFixture(t)
	result, err := service.ExecuteResource(t.Context(), request)
	if err != nil || len(result.Datasets) != 2 {
		t.Fatalf("full preview changed: %v", err)
	}
	request.DatasetIDs = []string{"detail"}
	if out, err := service.ExecuteResource(t.Context(), request); out != nil || err == nil || !strings.Contains(err.Error(), "requires explicitly complete dataset") {
		t.Fatalf("dataset-only guard changed: %v", err)
	}
	request.DatasetIDs = nil
	unknown := "unknown"
	request.TableBlockID = &unknown
	if out, err := service.ExecuteResource(t.Context(), request); out != nil || !errors.Is(err, identity.ErrResourceDenied) {
		t.Fatalf("unknown table accepted: %v", err)
	}
}

func TestTableProjectionRetainsDeclaredDatasetDependencyClosure(t *testing.T) {
	// Reference metadata can live below table/calculation/source objects. Keep
	// its transitive closure even when the primary table names just one dataset.
	raw := json.RawMessage(`{"blocks":[{"id":"table","kind":"tableBlock","datasetRef":"detail","runtime":{"datasetRefs":["baseline"]}},{"id":"unrelated","kind":"kpiBlock","datasetRef":"other"}],"datasets":[{"id":"detail","request":{"identity":9007199254740993}},{"id":"baseline","source":{"datasetRef":"reference"}},{"id":"reference"},{"id":"other"}],"calculatedFields":[{"id":"local","datasetRef":"detail","dependencies":["amount"]},{"id":"otherCalc","datasetRef":"other"}]}`)
	plan, err := planTableExecution(raw, "table")
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.datasets) != 3 || !plan.datasets["detail"] || !plan.datasets["baseline"] || !plan.datasets["reference"] {
		t.Fatalf("dependency closure lost: %v", plan.datasets)
	}
	projected, err := plan.materializationSpec(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(projected), `9007199254740993`) {
		t.Fatalf("projection rounded integer metadata: %s", projected)
	}
	if strings.Contains(string(projected), "otherCalc") || strings.Contains(string(projected), "unrelated") {
		t.Fatal("unrelated presentation/calculation retained")
	}
}
