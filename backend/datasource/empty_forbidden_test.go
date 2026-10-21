package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"gopkg.in/yaml.v3"
)

func emptyForbiddenSource(enabled bool) *dsproto.DataSource {
	return &dsproto.DataSource{ID: "records", DataSource: types.DataSource{
		Selectors: &types.Selectors{Data: "data", DataInfo: "meta"},
		Paging:    &types.PagingConfig{Enabled: true, Size: 20, Parameters: &types.PagingParameters{Page: "Offset", Size: "Limit"}, DataInfoSelectors: &types.DataInfoSelectors{PageCount: "pageCnt", TotalCount: "cnt"}},
	}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "producer", Method: "Read", EmptyOnForbidden: enabled}}
}

func TestSingleToolEmptyOnForbiddenIsExplicitTypedFetchOnly(t *testing.T) {
	for _, test := range []struct {
		name          string
		enabled       bool
		upstream      error
		empty, normal bool
	}{
		{name: "default403", upstream: &dsproto.UpstreamAuthorizationError{Status: 403}},
		{name: "enabled403", enabled: true, upstream: &dsproto.UpstreamAuthorizationError{Status: 403}, empty: true},
		{name: "wrapped403identitycause", enabled: true, upstream: fmt.Errorf("upstream: %w", &dsproto.UpstreamAuthorizationError{Status: 403, Cause: identity.ErrResourceDenied}), empty: true},
		{name: "unauthenticated", enabled: true, upstream: &dsproto.UpstreamAuthorizationError{Status: 401}},
		{name: "servererror", enabled: true, upstream: &dsproto.UpstreamAuthorizationError{Status: 500}},
		{name: "ordinary403text", enabled: true, upstream: errors.New("forbidden 403")},
		{name: "localadmission", enabled: true, upstream: identity.ErrResourceDenied},
		{name: "normalresult", enabled: true, normal: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			source := emptyForbiddenSource(test.enabled)
			store := NewMemoryStore()
			store.Put(source)
			calls, checks := 0, 0
			executor := permissionResolverTestExecutor(func(_ context.Context, name string, args map[string]interface{}) (string, error) {
				calls++
				require.Equal(t, "producer:Read", name)
				require.Equal(t, 40, args["Offset"])
				require.Equal(t, 20, args["Limit"])
				return `{"data":[{"id":7}],"meta":{"cnt":1,"pageCnt":1}}`, test.upstream
			})
			service := New(Options{Store: store, Executor: executor, AuthorizeDefinition: func(context.Context, *dsproto.DataSource, map[string]interface{}) error { checks++; return nil }})
			result, err := service.Fetch(context.Background(), source.ID, map[string]interface{}{"Offset": 40, "Limit": 20}, FetchOptions{})
			require.Equal(t, 1, calls)
			if test.empty {
				require.NoError(t, err)
				require.NotNil(t, result.Rows)
				require.Empty(t, result.Rows)
				require.Nil(t, result.Cache)
				require.Equal(t, 2, checks, "fallback still requires POST authorization")
				for _, key := range []string{"pageCount", "totalCount", "returnedCount", "pageCnt", "cnt"} {
					require.Equal(t, 0, result.DataInfo[key], key)
				}
				require.Equal(t, false, result.DataInfo["hasMore"])
				raw, e := json.Marshal(result)
				require.NoError(t, e)
				require.Contains(t, string(raw), `"rows":[]`)
			} else if test.normal {
				require.NoError(t, err)
				require.Len(t, result.Rows, 1)
				require.Equal(t, float64(7), result.Rows[0]["id"])
				require.Equal(t, 2, checks)
			} else {
				require.Error(t, err)
				require.Nil(t, result)
				require.Equal(t, 1, checks)
				if test.name == "default403" {
					require.ErrorIs(t, err, dsproto.ErrDatasourceDenied)
				} else {
					require.ErrorIs(t, err, test.upstream)
				}
			}
			// The executor's ordinary execution path still returns the upstream error.
			if test.enabled && test.upstream != nil {
				_, directErr := service.runBackendRaw(context.Background(), source, map[string]interface{}{"Offset": 40, "Limit": 20})
				require.ErrorIs(t, directErr, test.upstream)
			}
		})
	}
}

func TestSingleToolForbiddenFallbackIsNotCached(t *testing.T) {
	source := emptyForbiddenSource(true)
	store := NewMemoryStore()
	store.Put(source)
	calls := 0
	service := New(Options{Store: store, Executor: permissionResolverTestExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
		calls++
		if calls < 3 {
			return "", &dsproto.UpstreamAuthorizationError{Status: 403}
		}
		return `{"data":[{"id":9}],"meta":{"cnt":1}}`, nil
	})})
	for i := 0; i < 3; i++ {
		result, err := service.Fetch(context.Background(), source.ID, nil, FetchOptions{})
		require.NoError(t, err)
		if i < 2 {
			require.Empty(t, result.Rows)
			require.Nil(t, result.Cache)
		} else {
			require.Len(t, result.Rows, 1)
		}
	}
	require.Equal(t, 3, calls)
}

func TestSingleToolForbiddenFallbackKeepsReleaseChecks(t *testing.T) {
	source := emptyForbiddenSource(true)
	store := NewMemoryStore()
	store.Put(source)
	checks := 0
	service := New(Options{Store: store, AuthorizeDefinition: func(context.Context, *dsproto.DataSource, map[string]interface{}) error {
		checks++
		if checks == 2 {
			return identity.ErrResourceDenied
		}
		return nil
	}, Executor: permissionResolverTestExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
		return "", &dsproto.UpstreamAuthorizationError{Status: 403}
	})})
	result, err := service.Fetch(context.Background(), source.ID, nil, FetchOptions{})
	require.Nil(t, result)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Equal(t, 2, checks)
}

type forbiddenFallbackDispatch struct{ failure error }

func (d forbiddenFallbackDispatch) BeforeDispatch(context.Context) error { return nil }
func (d forbiddenFallbackDispatch) AfterDispatch(context.Context) error  { return d.failure }

func TestSingleToolForbiddenFallbackDoesNotSwallowDispatchCompletion(t *testing.T) {
	for _, failure := range []error{identity.ErrResourceStale, &dsproto.UpstreamAuthorizationError{Status: 403}} {
		source := emptyForbiddenSource(true)
		store := NewMemoryStore()
		store.Put(source)
		service := New(Options{Store: store, Executor: permissionResolverTestExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
			return "", &dsproto.UpstreamAuthorizationError{Status: 403}
		})})
		ctx := requestctx.WithResourceReadDispatch(context.Background(), forbiddenFallbackDispatch{failure})
		result, err := service.Fetch(ctx, source.ID, nil, FetchOptions{})
		require.Nil(t, result)
		require.ErrorIs(t, err, failure)
	}
}

func TestSingleToolForbiddenFallbackSupportsCursorMetadata(t *testing.T) {
	source := emptyForbiddenSource(true)
	source.Paging.Mode = "cursor"
	source.Paging.DataInfoSelectors.HasMore = "nav.more"
	source.Paging.DataInfoSelectors.NextCursor = "nav.next"
	store := NewMemoryStore()
	store.Put(source)
	service := New(Options{Store: store, Executor: permissionResolverTestExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
		return "", &dsproto.UpstreamAuthorizationError{Status: 403}
	})})
	result, err := service.Fetch(context.Background(), source.ID, nil, FetchOptions{})
	require.NoError(t, err)
	require.Equal(t, false, selectPath("nav.more", result.DataInfo))
	require.Nil(t, selectPath("nav.next", result.DataInfo))
	require.NoError(t, validatePagingDataInfo(&source.DataSource, result.DataInfo))
}

func TestSingleToolForbiddenFlagDoesNotChangeCompositePolicy(t *testing.T) {
	source := emptyForbiddenSource(true)
	source.Backend.Kind = dsproto.BackendMCPTools
	source.Backend.Calls = []dsproto.MCPCall{{Service: "producer", Method: "Read"}}
	store := NewMemoryStore()
	store.Put(source)
	service := New(Options{Store: store, Executor: permissionResolverTestExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
		return "", &dsproto.UpstreamAuthorizationError{Status: 403}
	})})
	result, err := service.Fetch(context.Background(), source.ID, nil, FetchOptions{})
	require.Nil(t, result)
	require.ErrorIs(t, err, dsproto.ErrDatasourceDenied)
}

func TestSingleToolEmptyOnForbiddenContractRoundTrip(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		original := emptyForbiddenSource(enabled)
		raw, err := json.Marshal(original)
		require.NoError(t, err)
		var fromJSON dsproto.DataSource
		require.NoError(t, json.Unmarshal(raw, &fromJSON))
		require.Equal(t, enabled, fromJSON.Backend.EmptyOnForbidden)
		encoded, err := yaml.Marshal(original)
		require.NoError(t, err)
		var fromYAML dsproto.DataSource
		require.NoError(t, yaml.Unmarshal(encoded, &fromYAML))
		require.Equal(t, enabled, fromYAML.Backend.EmptyOnForbidden)
		if enabled {
			require.Contains(t, string(raw), `"emptyOnForbidden":true`)
			require.Contains(t, string(encoded), "emptyOnForbidden: true")
		}
	}
}
