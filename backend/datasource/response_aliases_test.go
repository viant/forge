// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
)

func TestResponseAliasesPreserveExactValuesAndOwnKeys(t *testing.T) {
	nested := map[string]interface{}{"values": []int{1, 2}}
	original := []map[string]interface{}{{"Number": json.Number("9007199254740991"), "Null": nil, "False": false, "Zero": 0, "Nested": nested, "a.b": "literal", "a": map[string]interface{}{"b": "path"}}}
	aliases := map[string]string{"number": "Number", "null": "Null", "false": "False", "zero": "Zero", "nested": "Nested", "dotted": "a.b", "absent": "Missing"}
	rows, err := applyResponseAliases(original, aliases)
	if err != nil {
		t.Fatal(err)
	}
	for target, source := range aliases {
		value, present := original[0][source]
		actual, added := rows[0][target]
		if present != added || present && !reflect.DeepEqual(value, actual) {
			t.Fatalf("alias changed %s: %#v", target, actual)
		}
	}
	rows[0]["nested"].(map[string]interface{})["values"].([]int)[0] = 99
	if nested["values"].([]int)[0] != 1 {
		t.Fatal("aliased rows mutate source")
	}
	if _, exists := original[0]["number"]; exists {
		t.Fatal("source acquired aliases")
	}
	if len(rows[0]) != len(original[0])+6 {
		t.Fatal("source keys removed or missing alias invented")
	}
}

func TestResponseAliasesRejectConflictsAndUnsafeGraphs(t *testing.T) {
	source := []map[string]interface{}{{"Source": map[string]interface{}{"v": 1}, "target": map[string]interface{}{"v": 2}}}
	before, _ := json.Marshal(source)
	if _, err := applyResponseAliases(source, map[string]string{"target": "Source"}); err == nil {
		t.Fatal("conflict accepted")
	}
	after, _ := json.Marshal(source)
	if string(before) != string(after) {
		t.Fatal("failed alias mutated source")
	}
	equal := []map[string]interface{}{{"Source": []int{0}, "target": []int{0}}}
	if _, err := applyResponseAliases(equal, map[string]string{"target": "Source"}); err != nil {
		t.Fatal(err)
	}
	cyclic := map[string]interface{}{}
	cyclic["self"] = cyclic
	for _, value := range []interface{}{cyclic, func() {}, make(chan int)} {
		if _, err := applyResponseAliases([]map[string]interface{}{{"Source": value}}, map[string]string{"target": "Source"}); err == nil {
			t.Fatalf("unsupported graph accepted %T", value)
		}
	}
	for _, aliases := range []map[string]string{{"a": "b", "b": "c"}, {"a": "b", "b": "a"}, {"": "Source"}, {"target": ""}, {"__proto__": "Source"}, {"target": "safe.constructor.value"}, {"prototype.x": "Source"}} {
		if _, err := prepareResponseAliases(aliases); err == nil {
			t.Fatalf("unsafe declaration accepted: %#v", aliases)
		}
	}
	config := map[string]string{"left": "Source", "right": "Source", "self": "self"}
	captured, err := prepareResponseAliases(config)
	if err != nil {
		t.Fatal(err)
	}
	config["left"] = "Other"
	if captured["left"] != "Source" {
		t.Fatal("configuration not captured")
	}
}

type responseAliasExecutor struct {
	calls  int
	wire   []string
	during func()
}

func (e *responseAliasExecutor) Execute(_ context.Context, _ string, args map[string]interface{}) (string, error) {
	e.calls++
	encoded, _ := json.Marshal(args)
	e.wire = append(e.wire, string(encoded))
	if e.during != nil {
		e.during()
	}
	return `{"Data":[{"Total":0,"Alternate":false,"Null":null}],"Metrics":{"count":1}}`, nil
}

func TestResponseAliasCacheIdentityAndTransportIsolation(t *testing.T) {
	store := NewMemoryStore()
	ds := &dsproto.DataSource{ID: "demo", ResponseAliases: map[string]string{"logical": "Total"}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "example", Method: "read"}, DataSource: types.DataSource{Selectors: &types.Selectors{Data: "Data", Metrics: "Metrics"}}}
	store.Put(ds)
	executor := &responseAliasExecutor{}
	service := New(Options{Store: store, Executor: executor})
	args := map[string]interface{}{"filters": map[string]interface{}{"ids": []int{42}}, "limit": 25}
	ctx := WithIdentity(context.Background(), "owner", "conversation")
	first, err := service.Fetch(ctx, "demo", args, FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if first.Rows[0]["logical"] != float64(0) || first.Metrics["count"] != float64(1) {
		t.Fatalf("projection altered result %#v", first)
	}
	first.Rows[0]["logical"] = 999
	cached, err := service.Fetch(ctx, "demo", args, FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !cached.Cache.Hit || cached.Rows[0]["logical"] != float64(0) {
		t.Fatal("cache isolation failed")
	}
	ds.ResponseAliases = map[string]string{"logical": "Alternate"}
	changed, err := service.Fetch(ctx, "demo", args, FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if changed.Cache.Hit || changed.Rows[0]["logical"] != false || executor.calls != 2 {
		t.Fatal("changed aliases reused stale result")
	}
	if executor.wire[0] != `{"filters":{"ids":[42]},"limit":25}` {
		t.Fatalf("physical arguments changed: %s", executor.wire[0])
	}
	if executor.wire[0] != executor.wire[1] {
		t.Fatal("response mapping changed physical Execute args")
	}
	logicalKey := buildCacheKey("owner", "demo", nil, args)
	if err = service.InvalidateCache(ctx, "demo", logicalKey[len("owner|demo|"):]); err != nil {
		t.Fatal(err)
	}
	if _, err = service.Fetch(ctx, "demo", args, FetchOptions{}); err != nil {
		t.Fatal(err)
	}
	if executor.calls != 3 {
		t.Fatal("logical invalidation did not remove alias variant")
	}
	before := executor.calls
	ds.ResponseAliases = map[string]string{"a": "b", "b": "a"}
	if _, err = service.Fetch(ctx, "demo", args, FetchOptions{}); err == nil || executor.calls != before {
		t.Fatal("invalid configuration dispatched")
	}
}

func TestResponseAliasesCaptureBeforeAwaitAndStableConfigDigest(t *testing.T) {
	store := NewMemoryStore()
	ds := &dsproto.DataSource{ID: "demo", ResponseAliases: map[string]string{"value": "Total"}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "example", Method: "read"}, DataSource: types.DataSource{Selectors: &types.Selectors{Data: "Data"}}}
	store.Put(ds)
	executor := &responseAliasExecutor{during: func() { ds.ResponseAliases["value"] = "Alternate" }}
	result, err := New(Options{Store: store, Executor: executor}).Fetch(context.Background(), "demo", nil, FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if result.Rows[0]["value"] != float64(0) {
		t.Fatal("in-flight config change replaced captured mapping")
	}
	a := map[string]string{"a": "First", "b": "Second"}
	b := map[string]string{"b": "Second", "a": "First"}
	if responseAliasCacheKey("logical", a) != responseAliasCacheKey("logical", b) {
		t.Fatal("map insertion order changed digest")
	}
}

func TestResponseAliasesDoNotRewriteExistingLogicalRows(t *testing.T) {
	original := []map[string]interface{}{{"amount": 12.5, "date": "2026-10-04", "category": 0}}
	before, _ := json.Marshal(original)
	projected, err := applyResponseAliases(original, map[string]string{"amount": "Amount", "date": "Date", "category": "Category"})
	if err != nil {
		t.Fatal(err)
	}
	after, _ := json.Marshal(projected)
	if string(before) != string(after) {
		t.Fatal("missing producer keys changed logical row bytes")
	}
	projected[0]["amount"] = 99
	if original[0]["amount"] != 12.5 {
		t.Fatal("missing-source projection aliased original rows")
	}
}
