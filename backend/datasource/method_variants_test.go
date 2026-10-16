package datasource

import (
	"context"
	"errors"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
	"strings"
	"testing"
	"time"
)

type methodVariantExecutor struct {
	calls []string
	fail  bool
}

func (e *methodVariantExecutor) Execute(_ context.Context, name string, args map[string]interface{}) (string, error) {
	e.calls = append(e.calls, name)
	if e.fail {
		return "", errors.New("producer denied")
	}
	return `{"data":[{"name":"exact","nested":{"keep":true}}],"meta":{"cnt":31,"pageCnt":4},"metrics":{"count":31}}`, nil
}

func TestMCPMethodVariantsCacheIdentityAndNoFallback(t *testing.T) {
	store := NewMemoryStore()
	enabled := true
	definition := &dsproto.DataSource{ID: "records", Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "producer", Method: "list", MethodVariants: []dsproto.MCPMethodVariant{{Method: "byKey", When: dsproto.MCPMethodCondition{Parameter: "Keys", NonEmpty: true}}}}, Cache: &dsproto.CachePolicy{Enabled: &enabled, TTL: time.Hour, Key: []string{"args.scope"}}, DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data", DataInfo: "meta", Metrics: "metrics"}}}
	store.Put(definition)
	executor := &methodVariantExecutor{}
	service := New(Options{Store: store, Executor: executor})
	ctx := WithIdentity(context.Background(), "fixture-user", "fixture-chat")
	plain, err := service.Fetch(ctx, "records", map[string]interface{}{"scope": "owned"}, FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	exact, err := service.Fetch(ctx, "records", map[string]interface{}{"scope": "owned", "Keys": []int{7}}, FetchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(executor.calls) != 2 || executor.calls[0] != "producer:list" || executor.calls[1] != "producer:byKey" || exact.Cache.Hit {
		t.Fatalf("method cache collision: %#v", executor.calls)
	}
	if definition.Backend.Method != "list" {
		t.Fatal("shared definition mutated")
	}
	if plain.DataInfo["cnt"] != float64(31) || exact.DataInfo["pageCnt"] != float64(4) || exact.Metrics["count"] != float64(31) {
		t.Fatal("producer envelope lost")
	}
	// Changing a route declaration cannot reuse its predecessor's rows.
	definition.Backend.MethodVariants[0].Method = "byOtherKey"
	if _, err = service.Fetch(ctx, "records", map[string]interface{}{"scope": "owned", "Keys": []int{7}}, FetchOptions{}); err != nil {
		t.Fatal(err)
	}
	if len(executor.calls) != 3 || executor.calls[2] != "producer:byOtherKey" {
		t.Fatal("changed declaration reused cache")
	}
	// Pinned logical arguments win before method selection.
	definition.Backend.Pinned = map[string]interface{}{"Keys": []int{}}
	_, err = service.Fetch(ctx, "records", map[string]interface{}{"scope": "owned", "Keys": []int{7}}, FetchOptions{BypassCache: true})
	if err != nil || len(executor.calls) != 4 || executor.calls[3] != "producer:list" {
		t.Fatalf("route selected before pinned merge: %#v %v", executor.calls, err)
	}
	definition.Backend.Pinned = nil
	executor.fail = true
	_, err = service.Fetch(ctx, "records", map[string]interface{}{"scope": "owned", "Keys": []int{8}, "method": "list"}, FetchOptions{BypassCache: true})
	if err == nil || !strings.Contains(err.Error(), "producer denied") || len(executor.calls) != 5 || executor.calls[4] != "producer:byOtherKey" {
		t.Fatalf("fallback or caller routing: %#v %v", executor.calls, err)
	}
}
