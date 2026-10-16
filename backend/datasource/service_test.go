// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/types"
)

// stubExecutor mirrors the JS mock in lookups-test.mjs.
// Backing data:
//
//	id   name            region
//	123  Acme Corp       NA
//	456  Acme Labs       NA
//	789  Globex          EMEA
//	321  Initech         NA
//	654  Umbrella Group  APAC
type stubExecutor struct {
	calls atomic.Int64
	fail  bool
}

func (s *stubExecutor) Execute(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	s.calls.Add(1)
	if s.fail {
		return "", errors.New("stub: forced failure")
	}
	if name != "platform:account_search" {
		return "", errors.New("stub: unexpected tool name " + name)
	}
	q, _ := args["q"].(string)
	rows := []map[string]interface{}{
		{"id": 123, "name": "Acme Corp", "region": "NA"},
		{"id": 456, "name": "Acme Labs", "region": "NA"},
		{"id": 789, "name": "Globex", "region": "EMEA"},
		{"id": 321, "name": "Initech", "region": "NA"},
		{"id": 654, "name": "Umbrella Group", "region": "APAC"},
	}
	filtered := rows[:0]
	for _, r := range rows {
		nm, _ := r["name"].(string)
		if q == "" || contains(nm, q) {
			filtered = append(filtered, r)
		}
	}
	limit := 50
	if v, ok := args["limit"].(int); ok {
		limit = v
	} else if v, ok := args["limit"].(float64); ok {
		limit = int(v)
	}
	if len(filtered) > limit {
		filtered = filtered[:limit]
	}
	payload := map[string]interface{}{
		"results": filtered,
		"total":   len(filtered),
	}
	buf, _ := json.Marshal(payload)
	return string(buf), nil
}

func contains(haystack, needle string) bool {
	// Case-insensitive substring match mirroring the JS stub.
	h := toLower(haystack)
	n := toLower(needle)
	for i := 0; i+len(n) <= len(h); i++ {
		if h[i:i+len(n)] == n {
			return true
		}
	}
	return false
}

func toLower(s string) string {
	b := []byte(s)
	for i := range b {
		if b[i] >= 'A' && b[i] <= 'Z' {
			b[i] += 32
		}
	}
	return string(b)
}

func newAdvertiserDS() *dsproto.DataSource {
	ds := &dsproto.DataSource{
		ID: "account",
		Backend: &dsproto.Backend{
			Kind:    dsproto.BackendMCPTool,
			Service: "platform",
			Method:  "account_search",
			Pinned:  map[string]interface{}{"limit": 50},
		},
		Cache: &dsproto.CachePolicy{
			Scope:      dsproto.ScopeUser,
			TTL:        1 * time.Second,
			MaxEntries: 100,
			Key:        []string{"q"},
		},
	}
	ds.DataSource = types.DataSource{
		Selectors: &types.Selectors{Data: "results"},
	}
	return ds
}

func setup(t *testing.T) (*datasource.Service, *stubExecutor, *datasource.MemoryStore) {
	t.Helper()
	store := datasource.NewMemoryStore()
	store.Put(newAdvertiserDS())
	exec := &stubExecutor{}
	svc := datasource.New(datasource.Options{
		Store:    store,
		Executor: exec,
	})
	return svc, exec, store
}

func aliceCtx() context.Context {
	return datasource.WithIdentity(context.Background(), "alice@viantinc.com", "conv-1")
}
func bobCtx() context.Context {
	return datasource.WithIdentity(context.Background(), "bob@viantinc.com", "conv-2")
}

// T1 — Fetch miss: 1 MCP call, rows projected from selectors.data.
func TestFetch_Miss_RunsBackendAndProjects(t *testing.T) {
	svc, exec, _ := setup(t)
	res, err := svc.Fetch(aliceCtx(), "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if n := exec.calls.Load(); n != 1 {
		t.Fatalf("want 1 MCP call, got %d", n)
	}
	if res.Cache == nil || res.Cache.Hit {
		t.Fatalf("want cache miss")
	}
	if got := len(res.Rows); got != 2 {
		t.Fatalf("want 2 rows, got %d", got)
	}
	if name, _ := res.Rows[0]["name"].(string); name != "Acme Corp" {
		t.Fatalf("projection broken: got %v", res.Rows[0])
	}
}

func TestFetchTimingSeparatesBackendFromCachedRead(t *testing.T) {
	svc, _, _ := setup(t)
	var events []observe.Event
	ctx := observe.WithObserver(aliceCtx(), observe.ObserverFunc(func(event observe.Event) {
		events = append(events, event)
	}))
	for range 2 {
		_, err := svc.Fetch(ctx, "account", map[string]interface{}{"q": "sensitive-query"}, datasource.FetchOptions{})
		if err != nil {
			t.Fatal(err)
		}
	}
	counts := map[observe.Phase]int{}
	for _, event := range events {
		counts[event.Phase]++
		if event.Outcome != observe.OK || event.Kind != "datasource" {
			t.Fatalf("unexpected timing event: %+v", event)
		}
	}
	if counts[observe.Phase("datasource.service.fetch")] != 2 || counts[observe.Phase("datasource.service.backend")] != 1 {
		t.Fatalf("timing phases = %+v", counts)
	}
	raw, err := json.Marshal(events)
	if err != nil || strings.Contains(string(raw), "sensitive-query") {
		t.Fatalf("timings exposed inputs or could not encode: %v", err)
	}
}

// T2 — Fetch hit: no additional MCP call.
func TestFetch_Hit_NoExtraMCPCall(t *testing.T) {
	svc, exec, _ := setup(t)
	ctx := aliceCtx()
	svc.Fetch(ctx, "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	res, err := svc.Fetch(ctx, "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if n := exec.calls.Load(); n != 1 {
		t.Fatalf("cache hit should not call MCP again, got %d", n)
	}
	if !res.Cache.Hit {
		t.Fatalf("want cache hit flag")
	}
}

func TestFetchReauthorizesBeforeServingCachedResult(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(newAdvertiserDS())
	exec := &stubExecutor{}
	allowed := true
	checks := 0
	svc := datasource.New(datasource.Options{Store: store, Executor: exec, Authorize: func(_ context.Context, id string, _ map[string]interface{}) error {
		checks++
		if id != "account" {
			t.Fatalf("unexpected datasource %q", id)
		}
		if !allowed {
			return errors.New("revoked")
		}
		return nil
	}})
	inputs := map[string]interface{}{"q": "acm"}
	if _, err := svc.Fetch(aliceCtx(), "account", inputs, datasource.FetchOptions{}); err != nil {
		t.Fatal(err)
	}
	allowed = false
	if _, err := svc.Fetch(aliceCtx(), "account", inputs, datasource.FetchOptions{}); err == nil {
		t.Fatal("cached result survived revocation")
	}
	if checks != 2 || exec.calls.Load() != 1 {
		t.Fatalf("checks=%d backend calls=%d", checks, exec.calls.Load())
	}
}

func TestAccountBoundModeDoesNotReuseUserScopedDatasourceResults(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(newAdvertiserDS())
	exec := &stubExecutor{}
	checks := 0
	svc := datasource.New(datasource.Options{Store: store, Executor: exec, DisableCache: true, Authorize: func(context.Context, string, map[string]interface{}) error { checks++; return nil }})
	ctx := aliceCtx() // one user can select different verified accounts over time
	for i := 0; i < 2; i++ {
		result, err := svc.Fetch(ctx, "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
		if err != nil || result.Cache != nil {
			t.Fatalf("protected fetch=%+v err=%v", result, err)
		}
	}
	if checks != 2 || exec.calls.Load() != 2 {
		t.Fatalf("protected cache reuse: checks=%d backend calls=%d", checks, exec.calls.Load())
	}
}

// T3 — scope:user isolation: different users → separate cache entries.
func TestFetch_ScopeUser_Isolation(t *testing.T) {
	svc, exec, _ := setup(t)
	svc.Fetch(aliceCtx(), "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	svc.Fetch(bobCtx(), "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	if n := exec.calls.Load(); n != 2 {
		t.Fatalf("want 2 MCP calls (one per user), got %d", n)
	}
}

// T4 — TTL expiry triggers re-fetch.
func TestFetch_TTLExpiry(t *testing.T) {
	svc, exec, _ := setup(t)
	ctx := aliceCtx()
	svc.Fetch(ctx, "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	time.Sleep(1100 * time.Millisecond)
	res, err := svc.Fetch(ctx, "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if res.Cache.Hit {
		t.Fatalf("want miss after TTL")
	}
	if n := exec.calls.Load(); n != 2 {
		t.Fatalf("want 2 MCP calls after TTL expiry, got %d", n)
	}
}

// T5 — Invalidate forces miss on next fetch.
func TestInvalidateCache(t *testing.T) {
	svc, exec, _ := setup(t)
	ctx := aliceCtx()
	svc.Fetch(ctx, "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	if err := svc.InvalidateCache(ctx, "account", ""); err != nil {
		t.Fatalf("invalidate: %v", err)
	}
	res, _ := svc.Fetch(ctx, "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	if res.Cache.Hit {
		t.Fatalf("want miss after invalidation")
	}
	if n := exec.calls.Load(); n != 2 {
		t.Fatalf("want 2 MCP calls total after invalidation, got %d", n)
	}
}

// T11 — Pinned args override caller-supplied args on the backend call.
func TestFetch_PinnedArgsWin(t *testing.T) {
	store := datasource.NewMemoryStore()
	ds := newAdvertiserDS()
	// Pinned limit=50; caller tries limit=1 — pinned must win.
	store.Put(ds)
	var seenLimit interface{}
	captured := &captureExecutor{fn: func(ctx context.Context, name string, args map[string]interface{}) (string, error) {
		seenLimit = args["limit"]
		return `{"results":[],"total":0}`, nil
	}}
	svc := datasource.New(datasource.Options{Store: store, Executor: captured})
	svc.Fetch(aliceCtx(), "account", map[string]interface{}{"q": "x", "limit": 1}, datasource.FetchOptions{})
	if !isInt50(seenLimit) {
		t.Fatalf("pinned limit=50 must override caller limit=1, got %#v", seenLimit)
	}
}

func isInt50(v interface{}) bool {
	switch n := v.(type) {
	case int:
		return n == 50
	case int64:
		return n == 50
	case float64:
		return n == 50
	default:
		return false
	}
}

// T_Inline — inline backend returns its declared rows without executor.
func TestFetch_InlineBackend(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(&dsproto.DataSource{
		ID: "regions",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendInline,
			Rows: []map[string]interface{}{
				{"id": "na", "name": "North America"},
				{"id": "emea", "name": "EMEA"},
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store})
	res, err := svc.Fetch(aliceCtx(), "regions", nil, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if len(res.Rows) != 2 {
		t.Fatalf("want 2 inline rows, got %d", len(res.Rows))
	}
}

func TestFetch_InlineBackendRetainsRootRowsForLegacyDataSelector(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(&dsproto.DataSource{
		ID: "draft",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendInline,
			Rows: []map[string]interface{}{{"id": "draft-1", "name": ""}},
		},
		DataSource: types.DataSource{
			Selectors: &types.Selectors{Data: "data"},
		},
	})
	svc := datasource.New(datasource.Options{Store: store})
	res, err := svc.Fetch(aliceCtx(), "draft", nil, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if len(res.Rows) != 1 || res.Rows[0]["id"] != "draft-1" {
		t.Fatalf("want inline root row preserved, got %#v", res.Rows)
	}
}

func TestFetch_InlineBackendProjectsRowsAndMetricsViaSelectors(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(&dsproto.DataSource{
		ID: "order_preview",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendInline,
			Rows: []map[string]interface{}{
				{
					"orderId": 2667545,
					"periodSummary": map[string]interface{}{
						"spend":       251.93,
						"impressions": 184920,
						"ctr":         0.0184,
					},
					"performanceTimeline": []map[string]interface{}{
						{
							"customerTime": "2026-05-25",
							"spend":        251.93,
							"impressions":  184920,
							"ctr":          0.0184,
						},
					},
				},
			},
		},
		DataSource: types.DataSource{
			Selectors: &types.Selectors{
				Data:    "0.performanceTimeline",
				Metrics: "0",
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store})
	res, err := svc.Fetch(aliceCtx(), "order_preview", nil, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if got := len(res.Rows); got != 1 {
		t.Fatalf("want 1 projected row, got %d", got)
	}
	if got := res.Rows[0]["spend"]; got != 251.93 {
		t.Fatalf("want projected row spend 251.93, got %#v", got)
	}
	if res.Metrics == nil {
		t.Fatalf("want projected metrics")
	}
	summary, ok := res.Metrics["periodSummary"].(map[string]interface{})
	if !ok {
		t.Fatalf("want periodSummary in metrics, got %#v", res.Metrics)
	}
	if got := summary["spend"]; got != 251.93 {
		t.Fatalf("want metrics spend 251.93, got %#v", got)
	}
}

func TestFetch_PagingAppliedInDatasourceService(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(&dsproto.DataSource{
		ID: "orders",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendInline,
			Rows: []map[string]interface{}{
				{"id": 1, "name": "one"},
				{"id": 2, "name": "two"},
				{"id": 3, "name": "three"},
				{"id": 4, "name": "four"},
				{"id": 5, "name": "five"},
			},
		},
		DataSource: types.DataSource{
			Paging: &types.PagingConfig{
				Enabled: true,
				Size:    2,
				Parameters: &types.PagingParameters{
					Page: "page",
					Size: "limit",
				},
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store})
	res, err := svc.Fetch(aliceCtx(), "orders", map[string]interface{}{"page": 2, "limit": 2}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if got := len(res.Rows); got != 2 {
		t.Fatalf("want 2 paged rows, got %d", got)
	}
	if id, _ := res.Rows[0]["id"].(int); id != 3 {
		t.Fatalf("want first paged row id 3, got %#v", res.Rows[0])
	}
	if res.DataInfo == nil {
		t.Fatalf("want dataInfo")
	}
	if total, _ := res.DataInfo["totalCount"].(int); total != 5 {
		t.Fatalf("want totalCount 5, got %#v", res.DataInfo["totalCount"])
	}
	if pages, _ := res.DataInfo["pageCount"].(int); pages != 3 {
		t.Fatalf("want pageCount 3, got %#v", res.DataInfo["pageCount"])
	}
}

func TestFetch_OffsetPagingUsesBackendWindowAndDataInfoSelectors(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(&dsproto.DataSource{
		ID: "orders",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendInline,
			Rows: []map[string]interface{}{
				{"id": 21, "name": "twenty-one"},
				{"id": 22, "name": "twenty-two"},
			},
		},
		DataSource: types.DataSource{
			Paging: &types.PagingConfig{
				Enabled: true,
				Size:    20,
				Parameters: &types.PagingParameters{
					Page: "offset",
					Size: "limit",
				},
				DataInfoSelectors: &types.DataInfoSelectors{
					PageCount:  "pageCount",
					TotalCount: "recordCount",
				},
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store})
	res, err := svc.Fetch(aliceCtx(), "orders", map[string]interface{}{
		"offset": 20,
		"limit":  20,
	}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if got := len(res.Rows); got != 2 {
		t.Fatalf("want backend-paged 2 rows, got %d", got)
	}
	if res.DataInfo == nil {
		t.Fatalf("want dataInfo")
	}
	if page, _ := res.DataInfo["page"].(int); page != 2 {
		t.Fatalf("want page 2, got %#v", res.DataInfo["page"])
	}
	if size, _ := res.DataInfo["pageSize"].(int); size != 20 {
		t.Fatalf("want pageSize 20, got %#v", res.DataInfo["pageSize"])
	}
	if hasMore, _ := res.DataInfo["hasMore"].(bool); hasMore {
		t.Fatalf("short offset page must not advertise more rows: %#v", res.DataInfo)
	}
	if _, ok := res.DataInfo["pageCount"]; ok {
		t.Fatalf("count-less offset paging must not invent pageCount: %#v", res.DataInfo)
	}
}

func TestFetch_ContainsFilterSemanticsWrapWildcard(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(&dsproto.DataSource{
		ID: "orders",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendInline,
			Rows: []map[string]interface{}{
				{"id": 1, "name": "Preview Anchor"},
			},
		},
		DataSource: types.DataSource{
			FilterSet: []types.Filter{
				{
					Name: "quick",
					Template: []types.TemplateItem{
						{ID: "work_item_name", Operator: "contains"},
					},
				},
			},
		},
	})
	captured := &captureExecutor{fn: func(ctx context.Context, name string, args map[string]interface{}) (string, error) {
		if got, _ := args["work_item_name"].(string); got != "%prev%" {
			t.Fatalf("want wildcarded contains value, got %q", got)
		}
		return `{"rows":[]}`, nil
	}}
	store.Put(&dsproto.DataSource{
		ID: "orders_remote",
		Backend: &dsproto.Backend{
			Kind:    dsproto.BackendMCPTool,
			Service: "analyst",
			Method:  "ResourceTree",
		},
		DataSource: types.DataSource{
			FilterSet: []types.Filter{
				{
					Name: "quick",
					Template: []types.TemplateItem{
						{ID: "work_item_name", Operator: "contains"},
					},
				},
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store, Executor: captured})
	_, err := svc.Fetch(aliceCtx(), "orders_remote", map[string]interface{}{"work_item_name": "prev"}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
}

func TestFetch_FilterSemantics_DoNotWrapEqualOperator(t *testing.T) {
	store := datasource.NewMemoryStore()
	captured := &captureExecutor{fn: func(ctx context.Context, name string, args map[string]interface{}) (string, error) {
		if got, _ := args["order_id"].(int); got != 1 {
			t.Fatalf("want exact order_id 1, got %#v", args["order_id"])
		}
		return `{"rows":[]}`, nil
	}}
	store.Put(&dsproto.DataSource{
		ID: "orders_remote",
		Backend: &dsproto.Backend{
			Kind:    dsproto.BackendMCPTool,
			Service: "analyst",
			Method:  "ResourceTree",
		},
		DataSource: types.DataSource{
			FilterSet: []types.Filter{
				{
					Name: "quick",
					Template: []types.TemplateItem{
						{ID: "order_id", Operator: "equal"},
						{ID: "work_item_name", Operator: "contains"},
					},
				},
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store, Executor: captured})
	_, err := svc.Fetch(aliceCtx(), "orders_remote", map[string]interface{}{"order_id": 1}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
}

func TestFetch_FilterSemantics_CoerceTypedIntSliceFromString(t *testing.T) {
	store := datasource.NewMemoryStore()
	captured := &captureExecutor{fn: func(ctx context.Context, name string, args map[string]interface{}) (string, error) {
		got, ok := args["order_id"].([]int)
		if !ok {
			t.Fatalf("want []int order_id, got %#v", args["order_id"])
		}
		if len(got) != 1 || got[0] != 1 {
			t.Fatalf("want []int{1}, got %#v", got)
		}
		return `{"rows":[]}`, nil
	}}
	store.Put(&dsproto.DataSource{
		ID: "orders_remote",
		Backend: &dsproto.Backend{
			Kind:    dsproto.BackendMCPTool,
			Service: "analyst",
			Method:  "ResourceTree",
		},
		DataSource: types.DataSource{
			FilterSet: []types.Filter{
				{
					Name: "quick",
					Template: []types.TemplateItem{
						{ID: "order_id", Operator: "equal", Type: "int[]"},
					},
				},
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store, Executor: captured})
	_, err := svc.Fetch(aliceCtx(), "orders_remote", map[string]interface{}{"order_id": "1"}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
}

func TestFetch_ExpandNestedArgsForCubeMCPTool(t *testing.T) {
	store := datasource.NewMemoryStore()
	captured := &captureExecutor{fn: func(ctx context.Context, name string, args map[string]interface{}) (string, error) {
		dimensions, ok := args["dimensions"].(map[string]interface{})
		if !ok {
			t.Fatalf("want nested dimensions map, got %#v", args["dimensions"])
		}
		if got, ok := dimensions["workItemId"].(bool); !ok || !got {
			t.Fatalf("want dimensions.workItemId=true, got %#v", dimensions["workItemId"])
		}
		filters, ok := args["filters"].(map[string]interface{})
		if !ok {
			t.Fatalf("want nested filters map, got %#v", args["filters"])
		}
		gotIDs, ok := filters["workItemId"].([]int)
		if !ok || len(gotIDs) != 1 || gotIDs[0] != 1769800 {
			t.Fatalf("want filters.workItemId=[]int{1769800}, got %#v", filters["workItemId"])
		}
		if gotName, _ := filters["workItemName"].(string); gotName != "%prev%" {
			t.Fatalf("want filters.workItemName=%%prev%%, got %#v", filters["workItemName"])
		}
		orderBy, ok := args["orderBy"].([]interface{})
		if !ok || len(orderBy) != 2 {
			t.Fatalf("want orderBy slice, got %#v", args["orderBy"])
		}
		return `{"data":[{"workItemId":1769800,"workItemName":"Preview Anchor"}],"meta":{"recordCount":1,"pageCount":1}}`, nil
	}}
	store.Put(&dsproto.DataSource{
		ID: "orders_cube",
		Backend: &dsproto.Backend{
			Kind:    dsproto.BackendMCPTool,
			Service: "analyst",
			Method:  "ResourceTreeCube",
			Pinned: map[string]interface{}{
				"dimensions.workItemId": true,
				"measures.workItemName": true,
				"orderBy":               []interface{}{"workItemCreated:desc", "workItemId:desc"},
			},
		},
		DataSource: types.DataSource{
			Selectors: &types.Selectors{Data: "data", DataInfo: "meta"},
			FilterSet: []types.Filter{
				{
					Name: "quick",
					Template: []types.TemplateItem{
						{ID: "filters.workItemId", Operator: "equal", Type: "int[]"},
						{ID: "filters.workItemName", Operator: "contains"},
					},
				},
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store, Executor: captured})
	_, err := svc.Fetch(aliceCtx(), "orders_cube", map[string]interface{}{
		"filters.workItemId":   "1769800",
		"filters.workItemName": "prev",
	}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
}

func TestFetch_ExpandNestedArgsForCubeMCPTool_DropsBlankTypedFilter(t *testing.T) {
	store := datasource.NewMemoryStore()
	captured := &captureExecutor{fn: func(ctx context.Context, name string, args map[string]interface{}) (string, error) {
		filters, ok := args["filters"].(map[string]interface{})
		if !ok {
			t.Fatalf("want nested filters map, got %#v", args["filters"])
		}
		if _, exists := filters["workItemId"]; exists {
			t.Fatalf("did not expect blank filters.workItemId to be forwarded, got %#v", filters["workItemId"])
		}
		if gotName, _ := filters["workItemName"].(string); gotName != "%Beta%" {
			t.Fatalf("want filters.workItemName=%%Beta%%, got %#v", filters["workItemName"])
		}
		return `{"data":[{"workItemId":2664777,"workItemName":"Beta - Edmonton","projectName":"Beta"}],"meta":{"recordCount":1,"pageCount":1}}`, nil
	}}
	store.Put(&dsproto.DataSource{
		ID: "orders_cube",
		Backend: &dsproto.Backend{
			Kind:    dsproto.BackendMCPTool,
			Service: "analyst",
			Method:  "ResourceTreeCube",
			Pinned: map[string]interface{}{
				"dimensions.workItemId": true,
				"measures.workItemName": true,
				"orderBy":               []interface{}{"workItemId:desc"},
			},
		},
		DataSource: types.DataSource{
			Selectors: &types.Selectors{Data: "data", DataInfo: "meta"},
			FilterSet: []types.Filter{
				{
					Name: "quick",
					Template: []types.TemplateItem{
						{ID: "filters.workItemId", Operator: "equal", Type: "int[]"},
						{ID: "filters.workItemName", Operator: "contains"},
					},
				},
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store, Executor: captured})
	_, err := svc.Fetch(aliceCtx(), "orders_cube", map[string]interface{}{
		"filters.workItemId":   "",
		"filters.workItemName": "Beta",
	}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
}

func TestFetch_ProjectsMetrics(t *testing.T) {
	store := datasource.NewMemoryStore()
	executor := &captureExecutor{fn: func(ctx context.Context, name string, args map[string]interface{}) (string, error) {
		return `{"data":[{"orderId":2667545,"performanceSummary":{"periodCtr":1.23,"periodEcpm":29.4},"performanceTimeline":[{"spend":251.927}]}]}`, nil
	}}
	store.Put(&dsproto.DataSource{
		ID: "perf",
		Backend: &dsproto.Backend{
			Kind:    dsproto.BackendMCPTool,
			Service: "primary",
			Method:  "OrderPerformance",
		},
		DataSource: types.DataSource{
			Selectors: &types.Selectors{
				Data:    "data.0.performanceTimeline",
				Metrics: "data.0",
			},
		},
	})
	svc := datasource.New(datasource.Options{Store: store, Executor: executor})
	res, err := svc.Fetch(aliceCtx(), "perf", nil, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if got := len(res.Rows); got != 1 {
		t.Fatalf("want 1 row, got %d", got)
	}
	if res.Metrics == nil {
		t.Fatalf("want projected metrics")
	}
	summary, ok := res.Metrics["performanceSummary"].(map[string]interface{})
	if !ok {
		t.Fatalf("want performanceSummary in metrics, got %#v", res.Metrics)
	}
	if got := summary["periodCtr"]; got != 1.23 {
		t.Fatalf("want periodCtr 1.23, got %#v", got)
	}
}

// captureExecutor lets a test peek at args passed through to the backend.
type captureExecutor struct {
	fn func(ctx context.Context, name string, args map[string]interface{}) (string, error)
}

func (c *captureExecutor) Execute(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	return c.fn(ctx, name, args)
}
