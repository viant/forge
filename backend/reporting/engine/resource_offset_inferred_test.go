package reporting

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	dssvc "github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
)

type inferredOffsetStore struct{ source *dsproto.DataSource }

func (s inferredOffsetStore) Get(id string) (*dsproto.DataSource, bool) {
	return s.source, s.source.ID == id
}

type inferredOffsetExecutor struct{ calls int }

func (e *inferredOffsetExecutor) Execute(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	e.calls++
	offset, err := reportPagingInteger(args["skip"])
	if err != nil {
		return "", err
	}
	limit, err := reportPagingInteger(args["take"])
	if err != nil {
		return "", err
	}
	rows := []map[string]interface{}{}
	for i := offset; i < offset+limit && i < 5; i++ {
		rows = append(rows, map[string]interface{}{"id": i})
	}
	// The producer has no continuation field; the datasource service owns it.
	raw, err := json.Marshal(map[string]interface{}{"data": rows})
	return string(raw), err
}

func TestReportConsumesDatasourceInferredOffsetCompleteness(t *testing.T) {
	ctx := context.Background()
	source := &dsproto.DataSource{ID: "rows", Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "example", Method: "read"}, DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}, Paging: &types.PagingConfig{Enabled: true, Mode: "offset", Size: 2, Parameters: &types.PagingParameters{Page: "skip", Size: "take"}}}}
	executor := &inferredOffsetExecutor{}
	datasources := dssvc.New(dssvc.Options{Store: inferredOffsetStore{source}, Executor: executor, DisableCache: true})
	result, err := fetchCompleteResourceDataset(ctx, source, map[string]interface{}{"skip": 0, "take": 2}, func() error { return nil }, func(exact *dsproto.DataSource, args map[string]interface{}) (*dsproto.FetchResult, error) {
		page, err := datasources.Fetch(ctx, exact.ID, args, dssvc.FetchOptions{BypassCache: true})
		if err != nil {
			return nil, err
		}
		return normalizeReportPageResult(page, exact, json.RawMessage(`{"shape":"records","rowPath":"rows"}`))
	})
	if err != nil {
		t.Fatal(err)
	}
	if executor.calls != 3 || len(result.Rows) != 5 || fmt.Sprint(result.Rows[4]["id"]) != "4" || result.DataInfo["hasMore"] != false {
		t.Fatalf("incomplete report: calls=%d result=%+v", executor.calls, result)
	}
	if source.Paging.DataInfoSelectors != nil {
		t.Fatal("authored descriptor was mutated")
	}
}

func TestInferredReportPagingStillRejectsMissingOrNonBooleanCompleteness(t *testing.T) {
	for _, mode := range []string{"offset", "page"} {
		source := &dsproto.DataSource{DataSource: types.DataSource{Paging: &types.PagingConfig{Enabled: true, Mode: mode}}}
		for _, info := range []map[string]interface{}{nil, {"hasMore": "false"}} {
			if result, err := normalizeReportPageResult(&dsproto.FetchResult{DataInfo: info}, source, nil); err == nil || result != nil {
				t.Fatalf("unknown %s completeness accepted", mode)
			}
		}
	}
	source := cursorReportDescriptor()
	source.Paging.DataInfoSelectors = nil
	if selector := reportHasMoreSelector(source); selector != "" {
		t.Fatal("cursor inferred an unauthored continuation path")
	}
}
