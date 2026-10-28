package datasource

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/types"
	windowprotocol "github.com/viant/forge/backend/window/contract"
)

const projectionResponse = `{"columns":[{"name":"amount","type":"int"}],"data":[{"amount":7}],"hasMore":false,"complete":false,"truncated":true,"limit":25,"offset":25}`

type projectionExecutor struct {
	names []string
	args  []map[string]interface{}
}

func (e *projectionExecutor) Execute(_ context.Context, name string, args map[string]interface{}) (string, error) {
	e.names = append(e.names, name)
	e.args = append(e.args, args)
	return projectionResponse, nil
}

type projectionComponent struct {
	exactComponentFixture
	args map[string]interface{}
}

func (e *projectionComponent) ExecuteComponent(_ context.Context, service, method string, pin windowprotocol.ComponentBinding, args map[string]interface{}) (json.RawMessage, error) {
	e.executes++
	e.args = args
	return json.RawMessage(projectionResponse), nil
}
func projectionSource() *dsproto.DataSource {
	enabled := true
	return &dsproto.DataSource{ID: "readings", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data", DataInfo: "."}}, Cache: &dsproto.CachePolicy{Enabled: &enabled, TTL: time.Hour}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "fixture", Method: "compose", Args: map[string]string{"cubes.0.filters": "inputs.query.filters", "sql": "inputs.sql", "target": "inputs.target", "metadataAlias": "inputs.credentials"}, Pinned: map[string]interface{}{"sql": "SELECT * FROM cube(1) UNION ALL SELECT * FROM cube(2) LIMIT 25 OFFSET 25", "cubes.1.inheritFrom": 1, "target": "fixed"}, RequestMetadata: []string{"credentials"}}}
}
func projectionInputs(mode int) map[string]interface{} {
	return map[string]interface{}{"query": map[string]interface{}{"filters": map[string]interface{}{"mode": mode}, "limit": 1000, "offset": 0}, "sql": "caller SQL", "target": "caller target", "service": "unapproved", "method": "unapproved", "credentials": "secret", "unmapped": "omit"}
}
func assertProjection(t *testing.T, args map[string]interface{}, mode int) {
	require.Equal(t, "fixed", args["target"])
	require.Contains(t, args["sql"], "LIMIT 25 OFFSET 25")
	require.Equal(t, []interface{}{map[string]interface{}{"filters": map[string]interface{}{"mode": mode}}, map[string]interface{}{"inheritFrom": 1}}, args["cubes"])
	require.NotContains(t, args, "metadataAlias")
	for _, key := range []string{"query", "credentials", "unmapped", "service", "method", "limit", "offset"} {
		require.NotContains(t, args, key)
	}
}
func TestMCPArgumentProjectionKeepsLogicalScopeAndEnvelope(t *testing.T) {
	source := projectionSource()
	store := NewMemoryStore()
	store.Put(source)
	executor := &projectionExecutor{}
	var admitted []map[string]interface{}
	service := New(Options{Store: store, Executor: executor, Authorize: func(_ context.Context, _ string, args map[string]interface{}) error {
		admitted = append(admitted, args)
		return nil
	}})
	ctx := WithIdentity(context.Background(), "fixture-user", "fixture-chat")
	for _, mode := range []int{1, 2} {
		inputs := projectionInputs(mode)
		out, err := service.Fetch(ctx, source.ID, inputs, FetchOptions{})
		require.NoError(t, err)
		require.Equal(t, float64(7), out.Rows[0]["amount"])
		require.Equal(t, false, out.DataInfo["hasMore"])
		require.Equal(t, true, out.DataInfo["truncated"])
		require.Equal(t, false, out.DataInfo["complete"])
		require.Equal(t, float64(25), out.DataInfo["offset"])
		require.Len(t, out.DataInfo["columns"], 1)
		assertProjection(t, executor.args[len(executor.args)-1], mode)
		require.Equal(t, "caller SQL", inputs["sql"])
		require.Equal(t, "secret", inputs["credentials"])
	}
	require.Equal(t, []string{"fixture:compose", "fixture:compose"}, executor.names)
	require.Contains(t, admitted[0], "query")
	require.Equal(t, "secret", admitted[0]["credentials"])
	out, err := service.Fetch(ctx, source.ID, projectionInputs(2), FetchOptions{})
	require.NoError(t, err)
	require.True(t, out.Cache.Hit)
	require.Len(t, executor.names, 2)
	source.Backend.Args["cubes.0.filters"] = "inputs.query"
	_, err = service.Fetch(ctx, source.ID, projectionInputs(2), FetchOptions{})
	require.NoError(t, err)
	require.Len(t, executor.names, 3, "mapping change must not reuse old cached response")
}
func TestMCPArgumentProjectionUsesExactPinnedComponent(t *testing.T) {
	source := projectionSource()
	pin := componentFixturePin()
	source.Backend.Component = &pin
	source.Backend.Service = "fixture-datly"
	producer := &projectionComponent{exactComponentFixture: exactComponentFixture{actual: pin}}
	generic := &projectionExecutor{}
	store := NewMemoryStore()
	store.Put(source)
	out, err := New(Options{Store: store, Executor: generic, ComponentDispatcher: producer}).Fetch(context.Background(), source.ID, projectionInputs(3), FetchOptions{})
	require.NoError(t, err)
	require.Empty(t, generic.names)
	require.Equal(t, 1, producer.executes)
	assertProjection(t, producer.args, 3)
	require.Equal(t, true, out.DataInfo["truncated"])
}
func TestAbsentMCPArgumentProjectionPreservesPassThrough(t *testing.T) {
	source := projectionSource()
	source.Backend.Args = nil
	store := NewMemoryStore()
	store.Put(source)
	executor := &projectionExecutor{}
	_, err := New(Options{Store: store, Executor: executor}).Fetch(context.Background(), source.ID, projectionInputs(4), FetchOptions{})
	require.NoError(t, err)
	require.Contains(t, executor.args[0], "query")
	require.Equal(t, "omit", executor.args[0]["unmapped"])
	require.NotContains(t, executor.args[0], "credentials")
	require.Equal(t, "fixed", executor.args[0]["target"])
}
func TestMCPArgumentProjectionRejectsMalformedOrOverlappingPaths(t *testing.T) {
	for _, args := range []map[string]string{{"cubes.999999.filters": "inputs.query.filters"}, {"cubes.-1": "inputs.query"}, {"__proto__.x": "inputs.query"}, {"output": "item.query"}, {"cubes": "inputs.query", "cubes.0": "inputs.query"}, {"target.child": "inputs.query"}, {"cubes.0.filters": "inputs.query.filters", "cubes.named.filters": "inputs.query.filters"}, {"cubes.named.filters": "inputs.query.filters"}} {
		source := projectionSource()
		source.Backend.Args = args
		store := NewMemoryStore()
		store.Put(source)
		executor := &projectionExecutor{}
		_, err := New(Options{Store: store, Executor: executor}).Fetch(context.Background(), source.ID, projectionInputs(1), FetchOptions{})
		require.Error(t, err)
		require.Empty(t, executor.names)
	}
}

func TestMCPArgumentProjectionPreservesMissingAndNullOnWire(t *testing.T) {
	source := projectionSource()
	source.Backend.Args = map[string]string{"missing": "inputs.query.absent", "null": "inputs.query.null", "zero": "inputs.query.zero", "false": "inputs.query.false", "empty": "inputs.query.empty"}
	store := NewMemoryStore()
	store.Put(source)
	executor := &projectionExecutor{}
	_, err := New(Options{Store: store, Executor: executor}).Fetch(context.Background(), source.ID, map[string]interface{}{"query": map[string]interface{}{"null": nil, "zero": 0, "false": false, "empty": []interface{}{}}}, FetchOptions{})
	require.NoError(t, err)
	require.Len(t, executor.args, 1)
	args := executor.args[0]
	require.NotContains(t, args, "missing")
	require.Contains(t, args, "null")
	require.Nil(t, args["null"])
	require.Equal(t, 0, args["zero"])
	require.Equal(t, false, args["false"])
	require.Equal(t, []interface{}{}, args["empty"])
}

func TestProjectedCacheHashInvalidation(t *testing.T) {
	for _, variant := range []string{"plain", "aliases", "server", "component"} {
		t.Run(variant, func(t *testing.T) {
			source := projectionSource()
			executor := &projectionExecutor{}
			producer := &projectionComponent{exactComponentFixture: exactComponentFixture{actual: componentFixturePin()}}
			switch variant {
			case "aliases":
				source.ResponseAliases = map[string]string{"displayAmount": "amount"}
			case "server":
				source.Backend.ServerVersion = "fixture-v1"
			case "component":
				pin := componentFixturePin()
				source.Backend.Component = &pin
				source.Backend.Service = "fixture-datly"
			}
			store := NewMemoryStore()
			store.Put(source)
			service := New(Options{Store: store, Executor: executor, ComponentDispatcher: producer})
			ctx := WithIdentity(context.Background(), "fixture-user", "fixture-chat")
			inputs := projectionInputs(1)
			_, err := service.Fetch(ctx, source.ID, inputs, FetchOptions{})
			require.NoError(t, err)
			cached, err := service.Fetch(ctx, source.ID, inputs, FetchOptions{})
			require.NoError(t, err)
			require.True(t, cached.Cache.Hit)
			merged := expandNestedArgs(mergeArgs(normalizeFilterSemantics(inputs, &source.DataSource), source.Backend.Pinned))
			key := buildCacheKey(service.scopeID(ctx, dsproto.CachePolicyOrDefault(source.Cache).Scope), source.ID, nil, merged)
			hash := key[strings.LastIndex(key, "|")+1:]
			require.NoError(t, service.InvalidateDefinitionCache(ctx, source, hash))
			fresh, err := service.Fetch(ctx, source.ID, inputs, FetchOptions{})
			require.NoError(t, err)
			require.False(t, fresh.Cache.Hit)
			if variant == "component" {
				require.Equal(t, 2, producer.executes)
			} else {
				require.Len(t, executor.names, 2)
			}
		})
	}
}
