// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

type pinExecutor func(context.Context, string, map[string]interface{}) (string, error)

func (f pinExecutor) Execute(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	return f(ctx, name, args)
}

func TestFetchRevalidatesWirePinDescriptorAndPostDispatchAuthority(t *testing.T) {
	store := datasource.NewMemoryStore()
	definition := &dsproto.DataSource{ID: "sales", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "source", Method: "approved"}}
	store.Put(definition)
	pin := identity.ResolvedResource{URI: "window://analytics/sales", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte("definition"))}, AuthorityBinding: "verified-account", ValidUntil: time.Now().Add(time.Minute)}
	allowed := true
	revokeDuringFetch := false
	calls := 0
	service := datasource.New(datasource.Options{Store: store, DisableCache: true,
		ResolveDefinition: func(_ context.Context, _ identity.ResolvedResource, _ *types.WindowTarget, id string) (*dsproto.DataSource, error) {
			ds, _ := store.Get(id)
			return ds, nil
		},
		ResolveResource: func(_ context.Context, in identity.ResolvedResource) (*identity.ResolvedResource, error) {
			if in != pin {
				return nil, identity.ErrResourceDenied
			}
			copy := pin
			return &copy, nil
		},
		AuthorizeDefinition: func(ctx context.Context, ds *dsproto.DataSource, _ map[string]interface{}) error {
			current, ok := requestctx.ResolvedResourceFromContext(ctx)
			if !ok || *current != pin || !allowed || ds.Backend.Method != "approved" {
				return identity.ErrResourceDenied
			}
			return nil
		},
		Executor: pinExecutor(func(context.Context, string, map[string]interface{}) (string, error) {
			calls++
			if revokeDuringFetch {
				allowed = false
			}
			return `{"data":[{"value":1}]}`, nil
		}),
	})
	ctx := context.Background()
	if _, err := service.Fetch(ctx, "sales", nil, datasource.FetchOptions{}); err == nil || calls != 0 {
		t.Fatal("missing pin reached backend")
	}
	forged := pin
	forged.AuthorityBinding = "forged"
	if _, err := service.Fetch(ctx, "sales", nil, datasource.FetchOptions{Resource: &forged}); err == nil || calls != 0 {
		t.Fatal("wire identity accepted without revalidation")
	}
	result, err := service.Fetch(ctx, "sales", nil, datasource.FetchOptions{Resource: &pin})
	if err != nil || len(result.Rows) != 1 || calls != 1 {
		t.Fatalf("valid pin: result=%+v err=%v calls=%d", result, err, calls)
	}
	definition.Backend.Method = "changed"
	if _, err := service.Fetch(ctx, "sales", nil, datasource.FetchOptions{Resource: &pin}); err == nil || calls != 1 {
		t.Fatal("changed backend descriptor executed")
	}
	definition.Backend.Method = "approved"
	revokeDuringFetch = true
	result, err = service.Fetch(ctx, "sales", nil, datasource.FetchOptions{Resource: &pin})
	if result != nil || !errors.Is(err, identity.ErrResourceDenied) || calls != 2 {
		t.Fatalf("post-dispatch revocation leaked rows: %+v %v", result, err)
	}
}
