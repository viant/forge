// SPDX-License-Identifier: Apache-2.0
package datasource_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	resource "github.com/viant/forge/backend/resource"
	resourcehost "github.com/viant/forge/backend/resourcehost"
	"github.com/viant/forge/backend/types"
	"gopkg.in/yaml.v3"
)

func TestFetchResultLookupsUsesCurrentDefinitionOnWarmFanout(t *testing.T) {
	const raw = `
id: lookup
backend:
  kind: mcp_fanout
  fanout:
    seed: {service: fixture, method: parse}
    itemsSelector: parts
    call:
      service: fixture
      method: resolve
      args: {Key: item.key}
      valueMaps: {Key: {pending: PENDING}}
    valueSets: [{selector: targets}]
    resultMap: data
    resultKey: selection.value
    includeUnresolved: true
    unmappedAsUnresolved: true
    fieldMap: {id: selection.value, raw.key: item.key, name: result.name}
    resultLookups:
      group: {field: raw.key, trimSpace: true, values: {pending: Initial, other: null}}
      exact: {field: raw.key, values: {pending: Exact}}
      name: {field: raw.key, trimSpace: true, values: {pending: Overwrite}}
      chained: {field: group, values: {Initial: Chained}}
`
	var source dsproto.DataSource
	if err := yaml.Unmarshal([]byte(raw), &source); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(map[string]any{"schemaVersion": 1, "dataSource": source})
	if err != nil {
		t.Fatal(err)
	}
	definition, err := resourcehost.DecodeDatasourceDefinition(encoded)
	if err != nil || !reflect.DeepEqual(source.Backend.Fanout.ResultLookups, definition.Backend.Fanout.ResultLookups) {
		t.Fatalf("published descriptor did not preserve lookup: %+v, %v", definition, err)
	}
	store := datasource.NewMemoryStore()
	store.Put(definition)
	var calls atomic.Int64
	granted := true
	service := datasource.New(datasource.Options{
		Store: store,
		Authorize: func(context.Context, string, map[string]any) error {
			if !granted {
				return resource.ErrResourceDenied
			}
			return nil
		},
		Executor: pinExecutor(func(_ context.Context, tool string, _ map[string]any) (string, error) {
			calls.Add(1)
			switch tool {
			case "fixture:parse":
				return `{"parts":[{"key":"pending","targets":["1"]},{"key":" pending ","targets":["2"]},{"key":null,"targets":["3"]},{"key":7,"targets":["4"]},{"key":"unknown","targets":["5"]},{"key":"other","targets":["6"]},{"key":"\uFEFFpending","targets":["7"]},{"key":"\u0085pending","targets":["8"]}]}`, nil
			case "fixture:resolve":
				return `{"data":{"1":{"name":"Producer"}}}`, nil
			default:
				return "", fmt.Errorf("unexpected tool %q", tool)
			}
		}),
	})
	fetch := func(ctx context.Context, hit bool) []map[string]any {
		t.Helper()
		result, err := service.Fetch(ctx, source.ID, nil, datasource.FetchOptions{})
		if err != nil || result.Cache == nil || result.Cache.Hit != hit || len(result.Rows) != 8 {
			t.Fatalf("fetch expected hit=%t: %+v, %v", hit, result, err)
		}
		return result.Rows
	}
	rows := fetch(aliceCtx(), false)
	if rows[0]["group"] != "Initial" || rows[0]["exact"] != "Exact" || rows[0]["name"] != "Producer" || rows[1]["group"] != "Initial" || rows[1]["raw.key"] != " pending " {
		t.Fatalf("resolved and unresolved rows differ: %#v", rows)
	}
	if _, ok := rows[0]["chained"]; ok {
		t.Fatalf("chained lookup wrote a field: %#v", rows[0])
	}
	if _, ok := rows[1]["exact"]; ok {
		t.Fatalf("exact lookup matched padded input: %#v", rows[1])
	}
	for _, row := range rows[2:5] {
		if _, present := row["group"]; present {
			t.Fatalf("null, non-string or unknown applied a group: %#v", row)
		}
	}
	if value, present := rows[5]["group"]; !present || value != nil {
		t.Fatalf("expected explicit null entry: %#v", rows[5])
	}

	if rows[6]["group"] != "Initial" || rows[7]["group"] != nil {
		t.Fatalf("lookup trimming differs from String.trim: %#v", rows[6:])
	}

	rows[0]["group"] = "Changed by caller"
	rows[0]["raw.key"] = "unknown"
	if result := fetch(aliceCtx(), true)[0]; result["group"] != "Initial" || result["raw.key"] != "pending" {
		t.Fatalf("caller mutated cached inputs: %#v", result)
	}

	updated := "Updated"
	store.Put(withResultLookups(definition, map[string]dsproto.ResultLookup{
		"group": {Field: "raw.key", Values: map[string]*string{"pending": &updated}},
	}))
	if row := fetch(aliceCtx(), true)[0]; row["group"] != "Updated" {
		t.Fatalf("replacement did not use raw cache: %#v", row)
	}

	store.Replace([]*dsproto.DataSource{withResultLookups(definition, nil)})
	if row := fetch(aliceCtx(), true)[0]; row["group"] != nil {
		t.Fatalf("removed lookup leaked from cache: %#v", row)
	}
	if calls.Load() != 2 {
		t.Fatalf("dictionary or warm read caused extra upstream calls: %d", calls.Load())
	}
	store.Put(definition)
	if result := fetch(bobCtx(), false)[0]; result["group"] != "Initial" || calls.Load() != 4 {
		t.Fatalf("second actor crossed cache scope: row=%#v, calls=%d", result, calls.Load())
	}
	granted = false
	if result, err := service.Fetch(aliceCtx(), source.ID, nil, datasource.FetchOptions{}); result != nil || !errors.Is(err, resource.ErrResourceDenied) || calls.Load() != 4 {
		t.Fatalf("revoked actor released cached rows: %+v, %v, calls=%d", result, err, calls.Load())
	}
}

func withResultLookups(source *dsproto.DataSource, lookups map[string]dsproto.ResultLookup) *dsproto.DataSource {
	result := *source
	backend := *source.Backend
	fanout := *backend.Fanout
	fanout.ResultLookups = lookups
	backend.Fanout = &fanout
	result.Backend = &backend
	return &result
}

func lookupTestDefinition(label *string) *dsproto.DataSource {
	return &dsproto.DataSource{
		ID: "fixture",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendMCPFanout,
			Fanout: &dsproto.MCPFanout{
				Seed:          dsproto.MCPCall{Service: "fixture", Method: "parse"},
				ItemsSelector: "parts",
				Call: dsproto.MCPCall{Service: "fixture", Method: "resolve",
					Args:      map[string]string{"Key": "item.key"},
					ValueMaps: map[string]map[string]interface{}{"Key": {"other": "OTHER"}}},
				ValueSets:            []dsproto.ValueSet{{Selector: "targets"}},
				UnmappedAsUnresolved: true,
				FieldMap:             map[string]string{"id": "selection.value", "key": "item.key"},
				ResultLookups:        map[string]dsproto.ResultLookup{"label": {Field: "key", Values: map[string]*string{"known": label}}},
			},
		},
	}
}

const lookupTestSeed = `{"parts":[{"key":"known","targets":["1","2"]}]}`

func TestFetchResultLookupsConcurrentDefinitionReplacement(t *testing.T) {
	first, second := "First", "Second"
	initial, replacement := lookupTestDefinition(&first), lookupTestDefinition(&second)
	store := datasource.NewMemoryStore()
	store.Put(initial)
	service := datasource.New(datasource.Options{Store: store, Executor: pinExecutor(func(context.Context, string, map[string]any) (string, error) {
		return lookupTestSeed, nil
	})})
	fetch := func() *dsproto.FetchResult {
		result, err := service.Fetch(aliceCtx(), "fixture", nil, datasource.FetchOptions{})
		if err != nil {
			t.Error(err)
		}
		return result
	}
	cold := fetch()
	if cold == nil || len(cold.Rows) != 2 || cold.Rows[0]["label"] != first {
		t.Fatalf("unexpected cold read: %+v", cold)
	}
	group := new(sync.WaitGroup)
	group.Go(func() {
		for range 100 {
			store.Replace([]*dsproto.DataSource{replacement})
			store.Replace([]*dsproto.DataSource{initial})
		}
	})
	for range 4 {
		group.Go(func() {
			for range 100 {
				res := fetch()
				if res == nil {
					return
				}
				label := res.Rows[0]["label"]
				if !res.Cache.Hit || label != res.Rows[1]["label"] || (label != first && label != second) {
					t.Errorf("mixed or uncached definition: %+v", res)
					return
				}
			}
		})
	}
	group.Wait()
}

func TestFetchResultLookupsDiscardStalePinnedDelivery(t *testing.T) {
	first, second := "First", "Second"
	source, replacement := lookupTestDefinition(&first), lookupTestDefinition(&second)
	store := datasource.NewMemoryStore()
	store.Put(source)
	pin := resource.ResolvedResource{URI: "window://fixture/example", ResourceCandidate: resource.ResourceCandidate{Kind: resource.WorkingCandidate, ContentFingerprint: resource.ContentFingerprint([]byte("fixture"))}, AuthorityBinding: "test", ValidUntil: time.Now().Add(time.Minute)}
	service := datasource.New(datasource.Options{
		ResolveResource: func(context.Context, resource.ResolvedResource) (*resource.ResolvedResource, error) {
			return &pin, nil
		},
		ResolveDefinition: func(_ context.Context, _ resource.ResolvedResource, _ *types.WindowTarget, id string) (*dsproto.DataSource, error) {
			result, _ := store.Get(id)
			return result, nil
		},
		Executor: pinExecutor(func(context.Context, string, map[string]any) (string, error) {
			store.Put(replacement)
			return lookupTestSeed, nil
		}),
	})
	result, err := service.Fetch(aliceCtx(), "fixture", nil, datasource.FetchOptions{Resource: &pin, BypassCache: true})
	if result != nil || !errors.Is(err, resource.ErrResourceStale) {
		t.Fatalf("stale pinned lookup escaped release: %+v, %v", result, err)
	}
}
