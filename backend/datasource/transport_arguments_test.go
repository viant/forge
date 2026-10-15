// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"

	dsproto "github.com/viant/forge/backend/datasource/contract"
)

func TestTransportArgumentsLiteralAndIsolated(t *testing.T) {
	args := map[string]interface{}{"semanticSelection": map[string]interface{}{"fields": []string{"spend"}}, "filters": map[string]interface{}{"orderIds": []int{2701856}, "semanticSelection": "nested"}, "filters.secret": "literal", "unknown": true, "*": 1}
	before, _ := json.Marshal(args)
	physical := transportArguments(args, []string{"semanticSelection", "filters.secret", "missing", "semanticSelection", ""})
	if _, ok := physical["semanticSelection"]; ok {
		t.Fatal("declared metadata sent")
	}
	if _, ok := physical["filters.secret"]; ok {
		t.Fatal("literal dotted key sent")
	}
	filters := physical["filters"].(map[string]interface{})
	if filters["semanticSelection"] != "nested" || physical["unknown"] != true || physical["*"] != 1 {
		t.Fatalf("undeclared values changed: %#v", physical)
	}
	filters["orderIds"].([]int)[0] = 0
	filters["added"] = true
	after, _ := json.Marshal(args)
	if string(before) != string(after) {
		t.Fatalf("executor mutation changed logical request: %s", after)
	}
	if !reflect.DeepEqual(transportArguments(args, nil), args) {
		t.Fatal("default transport altered arguments")
	}
}

type metadataExecutor struct {
	calls    int
	physical []string
}

func (e *metadataExecutor) Execute(_ context.Context, _ string, args map[string]interface{}) (string, error) {
	body, _ := json.Marshal(args)
	e.physical = append(e.physical, string(body))
	e.calls++
	args["filters"].(map[string]interface{})["id"] = -1
	return `[]`, nil
}

func TestRequestMetadataCacheRetainsLogicalIdentity(t *testing.T) {
	store := NewMemoryStore()
	store.Put(&dsproto.DataSource{ID: "report", Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "demo", Method: "rows", RequestMetadata: []string{"semanticSelection"}}})
	executor := &metadataExecutor{}
	service := New(Options{Store: store, Executor: executor})
	inputs := func(selection string) map[string]interface{} {
		return map[string]interface{}{"filters": map[string]interface{}{"id": 123}, "semanticSelection": selection, "limit": 25}
	}
	a, b := inputs("a"), inputs("b")
	for _, request := range []map[string]interface{}{a, b, a, b} {
		if _, err := service.Fetch(context.Background(), "report", request, FetchOptions{}); err != nil {
			t.Fatal(err)
		}
	}
	if executor.calls != 2 {
		t.Fatalf("distinct logical metadata must create two cached entries, got %d calls", executor.calls)
	}
	if executor.physical[0] != executor.physical[1] {
		t.Fatalf("physical request differs: %#v", executor.physical)
	}
	if a["filters"].(map[string]interface{})["id"] != 123 || b["filters"].(map[string]interface{})["id"] != 123 {
		t.Fatal("executor mutated caller scope")
	}
	if buildCacheKey("user", "report", nil, a) == buildCacheKey("user", "report", nil, b) {
		t.Fatal("logical hashes collapsed")
	}
	if buildCacheKey("user", "report", nil, transportArguments(a, []string{"semanticSelection"})) != buildCacheKey("user", "report", nil, transportArguments(b, []string{"semanticSelection"})) {
		t.Fatal("physical hashes should match")
	}
}

func TestCompositeRequestMetadataUsesFinalArguments(t *testing.T) {
	executor := &metadataExecutor{}
	service := New(Options{Executor: executor})
	args := map[string]interface{}{"filters": map[string]interface{}{"id": 123}, "semanticSelection": "logical", "unknown": "preserved"}
	_, err := service.executeCompositeCall(context.Background(), dsproto.MCPCall{Service: "demo", Method: "rows"}, args, []string{"semanticSelection"})
	if err != nil {
		t.Fatal(err)
	}
	var actual map[string]interface{}
	if err := json.Unmarshal([]byte(executor.physical[0]), &actual); err != nil {
		t.Fatal(err)
	}
	if _, ok := actual["semanticSelection"]; ok {
		t.Fatal("composite sent metadata")
	}
	if actual["unknown"] != "preserved" || args["filters"].(map[string]interface{})["id"] != 123 {
		t.Fatal("composite changed logical arguments")
	}
}
