// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"encoding/json"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
	"strings"
	"testing"
)

type exactComponentFixture struct {
	actual             windowprotocol.ComponentBinding
	observes, executes int
	drift              bool
}

func (f *exactComponentFixture) IsComponentProducer(service string) bool {
	return service == "fixture-datly"
}
func (f *exactComponentFixture) ObserveComponent(context.Context, string, string, windowprotocol.ComponentBinding) (windowprotocol.ComponentBinding, error) {
	f.observes++
	return f.actual, nil
}
func (f *exactComponentFixture) ExecuteComponent(_ context.Context, service, method string, pin windowprotocol.ComponentBinding, args map[string]interface{}) (json.RawMessage, error) {
	f.executes++
	if f.drift {
		f.actual.Revision = "2"
	}
	return json.RawMessage(`{"data":[{"value":1}]}`), nil
}

type forbiddenGenericComponentTransport struct{ calls int }

func (f *forbiddenGenericComponentTransport) Execute(context.Context, string, map[string]interface{}) (string, error) {
	f.calls++
	return `{"data":[{"wrong":true}]}`, nil
}
func componentFixturePin() windowprotocol.ComponentBinding {
	return windowprotocol.ComponentBinding{ID: "fixture", Kind: "linked", Revision: "artifact-fixture-v1", ContentFingerprint: identity.ContentFingerprint([]byte("fixture-binary")), SchemaFingerprint: identity.ContentFingerprint([]byte("fixture-schema"))}
}
func TestPinnedComponentUsesExactProducerAndDeniesDriftWithoutGenericFallback(t *testing.T) {
	pin := componentFixturePin()
	producer := &exactComponentFixture{actual: pin}
	generic := &forbiddenGenericComponentTransport{}
	store := NewMemoryStore()
	ds := &dsproto.DataSource{ID: "fixture", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "fixture-datly", Method: "query", Component: &pin}}
	store.Put(ds)
	service := New(Options{Store: store, Executor: generic, ComponentDispatcher: producer})
	out, err := service.Fetch(context.Background(), ds.ID, nil, FetchOptions{})
	if err != nil || len(out.Rows) != 1 || producer.executes != 1 || producer.observes != 2 || generic.calls != 0 {
		t.Fatalf("exact dispatch not used: result=%+v err=%v", out, err)
	}
	// A cached result still re-observes the producer and cannot outlive revision drift.
	producer.actual.Revision = "2"
	if out, err = service.Fetch(context.Background(), ds.ID, nil, FetchOptions{}); err == nil || out != nil || producer.executes != 1 || generic.calls != 0 {
		t.Fatal("cache result released after producer drift")
	}
	producer.actual = pin
	producer.drift = true
	out, err = service.Fetch(context.Background(), ds.ID, nil, FetchOptions{BypassCache: true})
	if err == nil || out != nil || generic.calls != 0 {
		t.Fatal("rows released after post-dispatch revision drift")
	}
	for _, mutate := range []func(*windowprotocol.ComponentBinding){func(p *windowprotocol.ComponentBinding) { p.ContentFingerprint = strings.Repeat("a", 64) }, func(p *windowprotocol.ComponentBinding) { p.SchemaFingerprint = strings.Repeat("b", 64) }, func(p *windowprotocol.ComponentBinding) { p.Kind = "dynamic" }} {
		producer.drift = false
		producer.actual = pin
		mutate(&producer.actual)
		before := producer.executes
		if _, err = service.Fetch(context.Background(), ds.ID, nil, FetchOptions{BypassCache: true}); err == nil || producer.executes != before {
			t.Fatal("content/schema/source drift reached producer")
		}
	}
	ds.Backend.ProducerKind = "datly" // explicit legacy component intent cannot silently unpin
	ds.Backend.Component = nil
	before := generic.calls
	if _, err = service.Fetch(context.Background(), ds.ID, nil, FetchOptions{}); err == nil || generic.calls != before {
		t.Fatal("known Datly producer downgraded to generic MCP")
	}
	ds.Backend.Component = &pin
	without := New(Options{Store: store, Executor: generic})
	if _, err = without.Fetch(context.Background(), ds.ID, nil, FetchOptions{}); err == nil || generic.calls != before {
		t.Fatal("unavailable component transport downgraded")
	}
}
func TestArbitraryMCPRemainsGenericWithObservedServerVersion(t *testing.T) {
	store := NewMemoryStore()
	generic := &forbiddenGenericComponentTransport{}
	store.Put(&dsproto.DataSource{ID: "other", Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, ProducerKind: "mcp", Service: "arbitrary", Method: "query", ServerVersion: "observed-v1"}})
	if _, err := New(Options{Store: store, Executor: generic, ComponentDispatcher: &exactComponentFixture{}}).Fetch(context.Background(), "other", nil, FetchOptions{}); err != nil || generic.calls != 1 {
		t.Fatalf("arbitrary MCP rejected: %v", err)
	}
}

func TestDeclaredProducerDoesNotImposeComponentPinOnOrdinaryMCP(t *testing.T) {
	declared, err := windowprotocol.NewDeclaredComponentDispatcher([]string{"fixture-datly"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	generic := &forbiddenGenericComponentTransport{}
	store := NewMemoryStore()
	store.Put(&dsproto.DataSource{ID: "bare", Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "fixture-datly", Method: "query"}})
	result, err := New(Options{Store: store, Executor: generic, ComponentDispatcher: declared}).Fetch(context.Background(), "bare", nil, FetchOptions{})
	if err != nil || result == nil || generic.calls != 1 {
		t.Fatalf("ordinary schema call wrongly required client binding: %v", err)
	}
}
