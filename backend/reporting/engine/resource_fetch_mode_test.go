package reporting

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	identity "github.com/viant/forge/backend/resource"
)

func TestResourceFetchModeKeepsPreviewPageAndCompletesExport(t *testing.T) {
	raw := json.RawMessage(`{"schemaVersion":1,"reportDocument":{"title":"Paged evidence"},"reportSpec":{"version":1,"kind":"reportSpec","source":{"kind":"report","containerId":"owned","stateKey":"owned","dataSourceRef":"rows"},"title":"Paged evidence","parameters":{"viewMode":"table","groupBy":"","pageSize":2,"orderField":"","orderDir":"asc"},"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["evidence"]},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"rows","resultContract":{"shape":"tabular","rowPath":"rows.0","hasMorePath":"rows.0.hasMore"},"request":{"offset":0,"limit":2,"filters":{"scope":"owned"}}}],"blocks":[{"id":"evidence","kind":"tableBlock","title":"Evidence","datasetRef":"primary","columns":[{"key":"name","label":"Name"}]}]},"dataSources":{"rows":{"id":"rows","cardinality":"collection","selectors":{"data":"data.0","dataInfo":"data.0"},"paging":{"enabled":true,"mode":"offset","parameters":{"page":"offset","size":"limit"},"dataInfoSelectors":{"hasMore":"hasMore"}},"backend":{"kind":"mcp_tool","service":"owned","method":"read"}}}}`)
	uri, _ := identity.ParseResourceURI("report://example/paged")
	allowed := true
	resolver := &identity.ResourceResolver{Source: &identity.LocalResource{URI: uri, Load: func(context.Context) (json.RawMessage, error) { return raw, nil }}, Policy: reportPolicyFunc(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
		if !allowed {
			return identity.ResourceDecision{}, identity.ErrResourceDenied
		}
		return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "owned-account", ValidUntil: time.Now().Add(time.Minute)}, nil
	})}
	service := New(Options{Compiler: NewReportSpecCompiler(time.Now), ResourceResolver: func(context.Context, string) (*identity.ResourceResolver, error) { return resolver, nil }})
	calls := 0
	batchSize := int64(2)
	revokeOnLastPage := false
	service.SetResourceDatasetExecutor(NewResourceDatasetExecutor(reportFixtureTransport(func(_ context.Context, method string, args map[string]interface{}) (string, error) {
		calls++
		if method != "owned:read" || args["filters"].(map[string]interface{})["scope"] != "owned" {
			t.Fatal("changed descriptor or scope")
		}
		offset, err := reportPagingInteger(args["offset"])
		if err != nil {
			t.Fatal(err)
		}
		limit, err := reportPagingInteger(args["limit"])
		if err != nil || limit != batchSize {
			t.Fatalf("unexpected transport page size: %v %v", args["limit"], err)
		}
		if offset != 0 && offset != 2 {
			t.Fatal("unexpected continuation", offset)
		}
		if offset == 2 && revokeOnLastPage {
			allowed = false
		}
		rows := `[["row-0"],["row-1"]]`
		if offset == 2 {
			rows = `[["row-2"]]`
		}
		if limit == 3 {
			rows = `[["row-0"],["row-1"],["row-2"]]`
		}
		return fmt.Sprintf(`{"data":[{"columns":[{"name":"name"}],"rows":%s,"hasMore":%t}]}`, rows, offset == 0 && limit == 2), nil
	}), service.AuthorizeResourceDataset))
	for _, mode := range []DatasetFetchMode{DatasetFetchPage, DatasetFetchComplete, ""} {
		calls = 0
		result, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, DatasetFetchMode: mode})
		if err != nil {
			t.Fatal(mode, err)
		}
		want, wantCalls := 3, 2
		if mode == DatasetFetchPage {
			want, wantCalls = 2, 1
		}
		if calls != wantCalls || len(result.Datasets["primary"].Rows) != want {
			t.Fatalf("mode=%q calls=%d rows=%d", mode, calls, len(result.Datasets["primary"].Rows))
		}
		var fill struct {
			Datasets []struct {
				Provenance struct {
					HasMore   bool `json:"hasMore"`
					Truncated bool `json:"truncated"`
				} `json:"provenance"`
			} `json:"datasets"`
		}
		if err := json.Unmarshal(result.ReportFill, &fill); err != nil {
			t.Fatal(err)
		}
		if got := fill.Datasets[0].Provenance; got.HasMore != (mode == DatasetFetchPage) || got.Truncated != (mode == DatasetFetchPage) {
			t.Fatalf("completeness lost for %q: %+v", mode, got)
		}
	}
	// Authored batching changes complete-fetch transport only, not preview size
	// or the stored source/request. The effective spec records the actual batch.
	raw = json.RawMessage(strings.Replace(string(raw), `"enabled":true,"mode":"offset"`, `"enabled":true,"mode":"offset","size":3`, 1))
	for _, mode := range []DatasetFetchMode{DatasetFetchPage, DatasetFetchComplete} {
		calls = 0
		batchSize = 2
		if mode == DatasetFetchComplete {
			batchSize = 3
		}
		result, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, DatasetFetchMode: mode})
		if err != nil {
			t.Fatal(err)
		}
		if calls != 1 || len(result.Datasets["primary"].Rows) != int(batchSize) {
			t.Fatal("batching changed rows or made redundant calls", calls, result.Datasets)
		}
		var spec struct {
			Datasets []struct {
				Request map[string]interface{} `json:"request"`
			} `json:"datasets"`
		}
		if err := json.Unmarshal(result.ReportSpec, &spec); err != nil {
			t.Fatal(err)
		}
		if spec.Datasets[0].Request["limit"] != float64(batchSize) {
			t.Fatal("effective request lost actual batch size")
		}
	}
	var envelope map[string]interface{}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		t.Fatal(err)
	}
	descriptor := envelope["dataSources"].(map[string]interface{})["rows"].(map[string]interface{})
	descriptor["backend"].(map[string]interface{})["pinned"] = map[string]interface{}{"limit": 2}
	raw, _ = json.Marshal(envelope)
	calls, batchSize = 0, 2
	if result, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, DatasetFetchMode: DatasetFetchComplete}); err != nil || len(result.Datasets["primary"].Rows) != 3 || calls != 2 {
		t.Fatal("complete batching replaced a pinned producer limit", err, calls)
	}
	descriptor["paging"].(map[string]interface{})["size"] = maxResourceDatasetRows + 1
	raw, _ = json.Marshal(envelope)
	calls = 0
	if result, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, DatasetFetchMode: DatasetFetchComplete}); err == nil || result != nil || calls != 0 {
		t.Fatal("excessive authored batch dispatched")
	}
	descriptor["paging"].(map[string]interface{})["size"] = 0
	raw, _ = json.Marshal(envelope)
	batchSize = 2
	calls = 0
	if out, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, DatasetFetchMode: "unknown"}); err == nil || out != nil || calls != 0 {
		t.Fatal("invalid mode dispatched")
	}
	revokeOnLastPage = true
	if out, err := service.ExecuteResource(context.Background(), &ExecuteResourceRequest{Resource: &identity.ResourceRef{URI: uri.String()}, DatasetFetchMode: DatasetFetchComplete}); err == nil || out != nil {
		t.Fatal("export escaped revocation on final page")
	}
}
