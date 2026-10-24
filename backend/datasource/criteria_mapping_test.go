package datasource

import (
	"context"
	"encoding/json"
	"math"
	"reflect"
	"strings"
	"testing"

	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

func criteriaBackend() *dsproto.Backend {
	return &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "producer", Method: "rows", CriteriaMapping: &types.CriteriaMapping{Parameter: "Criteria", Fields: []types.CriteriaField{
		{Input: "Name", Field: "NAME", Operator: "contains", Type: "string"},
		{Input: "Radius", Field: "RADIUS", Operator: "equal", Type: "int"},
		{Input: "Enabled", Field: "ENABLED", Operator: "equal", Type: "bool"},
		{Input: "IDs", Field: "ID", Operator: "in", Type: "int"},
	}}}
}

func TestCriteriaMappingTransportAndLogicalIsolation(t *testing.T) {
	args := map[string]interface{}{"AdvertiserId": int64(42), "Name": `O'Reilly_50%\path`, "Radius": 0, "Enabled": false, "IDs": []int64{11, 12}, "Page": 2}
	before, _ := json.Marshal(args)
	physical, key, err := criteriaArguments(args, criteriaBackend())
	if err != nil {
		t.Fatal(err)
	}
	want := `NAME LIKE '%O''Reilly\_50\%\\path%' AND RADIUS = 0 AND ENABLED = false AND ID IN (11, 12)`
	if physical["Criteria"] != want {
		t.Fatalf("got %q, want %q", physical["Criteria"], want)
	}
	for _, input := range []string{"Name", "Radius", "Enabled", "IDs"} {
		if _, exists := physical[input]; exists {
			t.Fatalf("logical input leaked: %s", input)
		}
	}
	if physical["AdvertiserId"] != int64(42) || physical["Page"] != 2 || key == "" {
		t.Fatalf("scope/paging changed: %#v", physical)
	}
	physical["AdvertiserId"] = 0
	after, _ := json.Marshal(args)
	if string(before) != string(after) {
		t.Fatal("logical request mutated")
	}
}

func TestCriteriaMappingClearAndPinnedBase(t *testing.T) {
	b := criteriaBackend()
	for _, args := range []map[string]interface{}{nil, {}, {"Name": "", "Radius": nil, "IDs": []int{}}} {
		physical, _, err := criteriaArguments(args, b)
		if err != nil {
			t.Fatal(err)
		}
		if _, exists := physical["Criteria"]; exists {
			t.Fatalf("cleared filters retained a predicate: %#v", physical)
		}
	}
	b.Pinned = map[string]interface{}{"Criteria": "STATUS = 1"}
	physical, _, err := criteriaArguments(map[string]interface{}{"Criteria": "STATUS = 1", "Name": "Match"}, b)
	if err != nil || physical["Criteria"] != "(STATUS = 1) AND NAME LIKE '%Match%'" {
		t.Fatalf("pinned base lost: %#v %v", physical, err)
	}
}

func TestCriteriaMappingRejectsMalformedValuesAndConfiguration(t *testing.T) {
	for _, args := range []map[string]interface{}{{"Criteria": "ID = 1 OR ID = 2"}, {"Radius": "0 OR 1=1"}, {"Radius": 1.5}, {"Radius": json.Number("NaN")}, {"Radius": math.Inf(1)}, {"Name": []string{"x"}}, {"Enabled": 0}, {"IDs": "1,2"}, {"IDs": []interface{}{1, "2"}}} {
		if _, _, err := criteriaArguments(args, criteriaBackend()); err == nil {
			t.Fatalf("accepted malformed values: %#v", args)
		}
	}
	for _, change := range []func(*dsproto.Backend){
		func(b *dsproto.Backend) { b.Kind = dsproto.BackendInline },
		func(b *dsproto.Backend) { b.CriteriaMapping.Parameter = "x; DROP" },
		func(b *dsproto.Backend) { b.RequestMetadata = []string{"Criteria"} },
		func(b *dsproto.Backend) { b.CriteriaMapping.Fields[0].Field = "NAME OR 1=1" },
		func(b *dsproto.Backend) { b.CriteriaMapping.Fields[0].Operator = "raw" },
		func(b *dsproto.Backend) { b.CriteriaMapping.Fields[0].Type = "sql" },
		func(b *dsproto.Backend) { b.CriteriaMapping.Fields[0].Type = "int" },
		func(b *dsproto.Backend) {
			b.CriteriaMapping.Fields = append(b.CriteriaMapping.Fields, b.CriteriaMapping.Fields[0])
		},
	} {
		b := criteriaBackend()
		change(b)
		if _, _, err := criteriaArguments(nil, b); err == nil {
			t.Fatal("accepted malformed configuration")
		}
	}
}

type criteriaExecutor struct{ calls []map[string]interface{} }

func (e *criteriaExecutor) Execute(_ context.Context, _ string, args map[string]interface{}) (string, error) {
	e.calls = append(e.calls, args)
	return `[]`, nil
}
func TestCriteriaMappingCacheCannotCollapseDifferentFilters(t *testing.T) {
	store := NewMemoryStore()
	store.Put(&dsproto.DataSource{ID: "rows", Cache: &dsproto.CachePolicy{Key: []string{"args.Page"}}, Backend: criteriaBackend()})
	e := &criteriaExecutor{}
	s := New(Options{Store: store, Executor: e})
	for _, name := range []string{"a", "b", "a", "b", ""} {
		if _, err := s.Fetch(context.Background(), "rows", map[string]interface{}{"Name": name, "Page": 1}, FetchOptions{}); err != nil {
			t.Fatal(err)
		}
	}
	if len(e.calls) != 3 {
		t.Fatalf("distinct filters or reset collapsed: %d calls", len(e.calls))
	}
	if _, exists := e.calls[2]["Criteria"]; exists {
		t.Fatal("reset retained a stale predicate")
	}
	for _, call := range e.calls {
		if _, exists := call["Name"]; exists {
			t.Fatal("logical filter leaked to producer")
		}
	}
	if _, err := s.Fetch(context.Background(), "rows", map[string]interface{}{"Name": []string{"bad"}, "Page": 1}, FetchOptions{}); err == nil {
		t.Fatal("cache hit bypassed validation")
	}
	if len(e.calls) != 3 {
		t.Fatal("invalid request reached producer")
	}
}

func TestCriteriaMappingDescriptorRoundTrip(t *testing.T) {
	wire, err := json.Marshal(criteriaBackend())
	if err != nil {
		t.Fatal(err)
	}
	var actual dsproto.Backend
	if err = json.Unmarshal(wire, &actual); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(actual.CriteriaMapping, criteriaBackend().CriteriaMapping) {
		t.Fatal("mapping lost in descriptor")
	}
	if !strings.Contains(string(wire), "criteriaMapping") {
		t.Fatal("mapping was omitted")
	}
	var delivered windowprotocol.Backend
	if err = json.Unmarshal(wire, &delivered); err != nil {
		t.Fatal(err)
	}
	delivery, err := json.Marshal(delivered)
	if err != nil {
		t.Fatal(err)
	}
	var restored dsproto.Backend
	if err = json.Unmarshal(delivery, &restored); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(restored.CriteriaMapping, actual.CriteriaMapping) {
		t.Fatal("window delivery dropped criteria mapping")
	}
}
