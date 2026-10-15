// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource_test

import (
	"context"
	"testing"
	"time"

	"github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
)

// Regression test for the `args.q` cache-key path bug: before the fix,
// buildCacheKey looked up args["args.q"] which never existed, so every query
// collapsed to the same cache entry. Distinct queries would incorrectly
// return the first query's rows.
func TestFetch_CacheKey_ArgsDotQPath_DifferentQueriesProduceDifferentEntries(t *testing.T) {
	store := datasource.NewMemoryStore()
	ds := &dsproto.DataSource{
		ID: "account",
		Backend: &dsproto.Backend{
			Kind:    dsproto.BackendMCPTool,
			Service: "platform",
			Method:  "account_search",
			Pinned:  map[string]interface{}{"limit": 50},
		},
		Cache: &dsproto.CachePolicy{
			Scope: dsproto.ScopeUser,
			TTL:   1 * time.Second,
			// This is what the doc/lookups.md YAML example declares.
			Key: []string{"args.q"},
		},
	}
	ds.DataSource = types.DataSource{Selectors: &types.Selectors{Data: "results"}}
	store.Put(ds)

	exec := &stubExecutor{}
	svc := datasource.New(datasource.Options{Store: store, Executor: exec})

	ctx := datasource.WithIdentity(context.Background(), "alice", "conv-1")

	// Query 1.
	r1, err := svc.Fetch(ctx, "account", map[string]interface{}{"q": "acm"}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch1: %v", err)
	}
	if r1.Cache.Hit {
		t.Fatalf("first fetch should miss")
	}
	if len(r1.Rows) != 2 {
		t.Fatalf("want 2 rows for 'acm', got %d", len(r1.Rows))
	}

	// Query 2 — different q. If the cache key is broken, this will
	// collide with the first entry and return a cached hit with 'acm'
	// rows.
	r2, err := svc.Fetch(ctx, "account", map[string]interface{}{"q": "glob"}, datasource.FetchOptions{})
	if err != nil {
		t.Fatalf("fetch2: %v", err)
	}
	if r2.Cache.Hit {
		t.Fatalf("'glob' must not collide with 'acm' cache entry")
	}
	if len(r2.Rows) != 1 || r2.Rows[0]["name"] != "Globex" {
		t.Fatalf("want Globex row for 'glob', got %+v", r2.Rows)
	}
	if n := exec.calls.Load(); n != 2 {
		t.Fatalf("expected 2 MCP calls (one per distinct query), got %d", n)
	}

	// Same q again — must now hit cache.
	r3, _ := svc.Fetch(ctx, "account", map[string]interface{}{"q": "glob"}, datasource.FetchOptions{})
	if !r3.Cache.Hit {
		t.Fatalf("repeat 'glob' should hit cache")
	}
}

// Nested dotted paths must also resolve.
func TestFetch_CacheKey_NestedPath(t *testing.T) {
	store := datasource.NewMemoryStore()
	ds := &dsproto.DataSource{
		ID: "x",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendInline,
			Rows: []map[string]interface{}{{"id": 1}},
		},
		Cache: &dsproto.CachePolicy{
			Scope: dsproto.ScopeUser,
			TTL:   time.Minute,
			Key:   []string{"filter.region", "args.q"},
		},
	}
	store.Put(ds)
	svc := datasource.New(datasource.Options{Store: store})
	ctx := datasource.WithIdentity(context.Background(), "alice", "c")

	// Two calls with different nested values must NOT collide.
	_, _ = svc.Fetch(ctx, "x", map[string]interface{}{
		"filter": map[string]interface{}{"region": "NA"},
		"q":      "x",
	}, datasource.FetchOptions{})
	r2, _ := svc.Fetch(ctx, "x", map[string]interface{}{
		"filter": map[string]interface{}{"region": "EMEA"},
		"q":      "x",
	}, datasource.FetchOptions{})
	if r2.Cache.Hit {
		t.Fatalf("different nested filter.region must miss cache")
	}
}
