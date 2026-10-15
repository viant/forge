// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource_test

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"

	"github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"gopkg.in/yaml.v3"
)

type compositeExecutor struct {
	mu    sync.Mutex
	calls []string
}

func (e *compositeExecutor) Execute(_ context.Context, name string, args map[string]interface{}) (string, error) {
	e.mu.Lock()
	e.calls = append(e.calls, name)
	e.mu.Unlock()
	switch name {
	case "platform:first":
		return `{"data":[{"id":2,"name":"Beta"}]}`, nil
	case "platform:second":
		return `{"data":[{"sourceId":1,"label":"Alpha"}]}`, nil
	case "platform:missing":
		return "", fmt.Errorf("not found or access denied")
	case "platform:seed":
		return `{"data":[{"dimensions":[{"namespace":"category.type","targets":["2"],"exclusions":["3"]},{"namespace":"unsupported.type","targets":["9"]}]}]}`, nil
	case "platform:empty-seed":
		return `{"data":[{"dimensions":[]}]}`, nil
	case "platform:resolve":
		if args["Field"] != "CATEGORY_TYPE" {
			return "", fmt.Errorf("unexpected mapped field: %#v", args["Field"])
		}
		body, _ := args["Body"].(map[string]interface{})
		lookups, _ := body["treeLookupParam"].([]map[string]interface{})
		if len(lookups) != 2 || lookups[0]["namespace"] != "category.type" || lookups[1]["id"] != "3" {
			return "", fmt.Errorf("unexpected lookup list: %#v", body["treeLookupParam"])
		}
		return `{"data":{"map":{"2":{"displayName":"Mobile","displayPath":"Device"},"3":{"displayName":"Desktop","displayPath":"Device"}}}}`, nil
	default:
		return "", fmt.Errorf("unexpected tool %q", name)
	}
}

func TestFetchMCPToolsMapsConstantsAndSorts(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(&dsproto.DataSource{
		ID: "composite",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendMCPTools,
			Calls: []dsproto.MCPCall{
				{Service: "platform", Method: "first", FieldMap: map[string]string{"id": "id", "name": "name"}, Constants: map[string]interface{}{"type": "one"}},
				{Service: "platform", Method: "second", FieldMap: map[string]string{"id": "sourceId", "name": "label"}, Constants: map[string]interface{}{"type": "two"}},
				{Service: "platform", Method: "missing", IgnoreNotFound: true},
			},
			Sort: []dsproto.SortField{{Field: "name", Direction: "asc"}},
		},
	})
	executor := &compositeExecutor{}
	service := datasource.New(datasource.Options{Store: store, Executor: executor})
	got, err := service.Fetch(aliceCtx(), "composite", nil, datasource.FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Rows) != 2 || got.Rows[0]["name"] != "Alpha" || got.Rows[1]["type"] != "one" {
		t.Fatalf("unexpected composite rows: %#v", got.Rows)
	}
}

func TestFetchMCPFanoutResolvesValueSetsAndResultMap(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(&dsproto.DataSource{
		ID: "fanout",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendMCPFanout,
			Fanout: &dsproto.MCPFanout{
				Seed:          dsproto.MCPCall{Service: "platform", Method: "seed"},
				ItemsSelector: "data.0.dimensions",
				Call: dsproto.MCPCall{
					Service: "platform", Method: "resolve",
					Args:      map[string]string{"Field": "item.namespace", "Body.model.resourceId": "inputs.ResourceId"},
					Pinned:    map[string]interface{}{"Operation": "map"},
					ValueMaps: map[string]map[string]interface{}{"Field": {"category.type": "CATEGORY_TYPE"}},
				},
				ValueSets: []dsproto.ValueSet{
					{Selector: "targets", Constants: map[string]interface{}{"excluded": false}},
					{Selector: "exclusions", Constants: map[string]interface{}{"excluded": true}},
				},
				ListArgument: &dsproto.ListArgument{Target: "Body.treeLookupParam", Fields: map[string]string{"namespace": "item.namespace", "id": "selection.value"}},
				ResultMap:    "data.map", ResultKey: "selection.value", IncludeUnresolved: true,
				UnmappedAsUnresolved: true,
				FieldMap:             map[string]string{"namespace": "item.namespace", "id": "selection.value", "excluded": "selection.excluded", "displayName": "result.displayName"},
			},
			Sort: []dsproto.SortField{{Field: "id", Direction: "asc"}},
		},
	})
	executor := &compositeExecutor{}
	service := datasource.New(datasource.Options{Store: store, Executor: executor})
	got, err := service.Fetch(aliceCtx(), "fanout", map[string]interface{}{"ResourceId": 42}, datasource.FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Rows) != 3 {
		t.Fatalf("expected three fanout rows, got %#v", got.Rows)
	}
	if got.Rows[0]["displayName"] != "Mobile" || got.Rows[0]["excluded"] != false || got.Rows[1]["displayName"] != "Desktop" || got.Rows[1]["excluded"] != true {
		t.Fatalf("unexpected fanout rows: %#v", got.Rows)
	}
	if got.Rows[2]["namespace"] != "unsupported.type" || got.Rows[2]["displayName"] != nil {
		t.Fatalf("unmapped value must remain an unresolved row: %#v", got.Rows[2])
	}
}

func TestFetchMCPFanoutPreservesCompletedEmptyCollection(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(&dsproto.DataSource{
		ID: "empty_fanout",
		Backend: &dsproto.Backend{
			Kind: dsproto.BackendMCPFanout,
			Fanout: &dsproto.MCPFanout{
				Seed:          dsproto.MCPCall{Service: "platform", Method: "empty-seed"},
				ItemsSelector: "data.0.dimensions",
				Call:          dsproto.MCPCall{Service: "platform", Method: "resolve"},
			},
		},
	})
	service := datasource.New(datasource.Options{Store: store, Executor: &compositeExecutor{}})
	got, err := service.Fetch(aliceCtx(), "empty_fanout", nil, datasource.FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if got.Rows == nil || len(got.Rows) != 0 {
		t.Fatalf("completed empty fanout must return a non-nil empty collection, got %#v", got.Rows)
	}
	encoded, err := json.Marshal(got.Rows)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != "[]" {
		t.Fatalf("completed empty fanout must serialize as [], got %s", encoded)
	}
}

func TestBackendCompositeYAMLRoundTrip(t *testing.T) {
	raw := []byte(`
kind: mcp_fanout
sort: [{field: namespace, direction: asc}]
fanout:
  seed: {service: platform, method: seed}
  itemsSelector: data.0.dimensions
  call:
    service: platform
    method: resolve
    valueMaps: {Field: {category.type: CATEGORY_TYPE}}
  valueSets: [{selector: targets, constants: {excluded: false}}]
  listArgument: {target: Body.treeLookupParam, fields: {id: selection.value}}
  resultMap: data.map
  resultKey: selection.value
  includeUnresolved: true
  unmappedAsUnresolved: true
  fieldMap: {id: selection.value, displayName: result.displayName}
`)
	var backend dsproto.Backend
	if err := yaml.Unmarshal(raw, &backend); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(&backend)
	if err != nil {
		t.Fatal(err)
	}
	if backend.Kind != dsproto.BackendMCPFanout || backend.Fanout == nil || backend.Fanout.Seed.Method != "seed" || len(backend.Fanout.ValueSets) != 1 || !backend.Fanout.IncludeUnresolved || !backend.Fanout.UnmappedAsUnresolved {
		t.Fatalf("composite metadata was not retained: %s", encoded)
	}
}
