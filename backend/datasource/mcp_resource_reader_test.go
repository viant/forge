// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/viant/forge/backend/datasource"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

type resourceReaderFunc func(context.Context, string, string) (json.RawMessage, error)

func (f resourceReaderFunc) ReadResource(ctx context.Context, service, uri string) (json.RawMessage, error) {
	return f(ctx, service, uri)
}

func resourceDatasource() *dsproto.DataSource {
	return &dsproto.DataSource{ID: "orders", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "items"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPResource, Service: "admitted", URI: "data://catalog/orders"}}
}

func TestMCPResourceDatasourceUsesAuthoredConnectionAndNormalProjection(t *testing.T) {
	store := datasource.NewMemoryStore()
	store.Put(resourceDatasource())
	calls := 0
	allowed := true
	revoke := false
	svc := datasource.New(datasource.Options{Store: store,
		ResourceReader: resourceReaderFunc(func(ctx context.Context, service, uri string) (json.RawMessage, error) {
			calls++
			if service != "admitted" || uri != "data://catalog/orders" {
				t.Fatalf("caller changed authored source: %s %s", service, uri)
			}
			if revoke {
				allowed = false
			}
			return json.RawMessage(`{"items":[{"id":"order-1","value":42}]}`), nil
		}),
		AuthorizeDefinition: func(context.Context, *dsproto.DataSource, map[string]interface{}) error {
			if !allowed {
				return identity.ErrResourceDenied
			}
			return nil
		},
	})
	for i := 0; i < 2; i++ {
		result, err := svc.Fetch(aliceCtx(), "orders", map[string]interface{}{"service": "unapproved", "uri": "https://unapproved.invalid"}, datasource.FetchOptions{})
		if err != nil || result == nil || len(result.Rows) != 1 || result.Rows[0]["id"] != "order-1" {
			t.Fatalf("projection=%+v err=%v", result, err)
		}
		if result.Cache != nil {
			t.Fatal("resource payload must not outlive its reader authorization through generic cache")
		}
	}
	if calls != 2 {
		t.Fatalf("resource must be freshly read: calls=%d", calls)
	}
	revoke = true
	result, err := svc.Fetch(aliceCtx(), "orders", nil, datasource.FetchOptions{})
	if result != nil || !errors.Is(err, identity.ErrResourceDenied) || calls != 3 {
		t.Fatalf("post-read authority loss leaked data: result=%+v err=%v calls=%d", result, err, calls)
	}
	_, err = svc.Fetch(aliceCtx(), "orders", nil, datasource.FetchOptions{})
	if !errors.Is(err, identity.ErrResourceDenied) || calls != 3 {
		t.Fatal("denied request reached resource reader")
	}
}

func TestMCPResourceDatasourceFailsClosedOnMissingInvalidOrCanceledReads(t *testing.T) {
	for _, mode := range []string{"missing-reader", "missing-service", "missing-uri", "reader-denied", "invalid-json", "canceled-before", "canceled-after"} {
		t.Run(mode, func(t *testing.T) {
			store := datasource.NewMemoryStore()
			ds := resourceDatasource()
			if mode == "missing-service" {
				ds.Backend.Service = ""
			}
			if mode == "missing-uri" {
				ds.Backend.URI = ""
			}
			store.Put(ds)
			ctx, cancel := context.WithCancel(aliceCtx())
			defer cancel()
			calls := 0
			var reader datasource.MCPResourceReader = resourceReaderFunc(func(context.Context, string, string) (json.RawMessage, error) {
				calls++
				if mode == "reader-denied" {
					return nil, identity.ErrResourceDenied
				}
				if mode == "invalid-json" {
					return json.RawMessage("not JSON"), nil
				}
				if mode == "canceled-after" {
					cancel()
				}
				return json.RawMessage(`{"items":[{"id":"order-1"}]}`), nil
			})
			if mode == "missing-reader" {
				reader = nil
			}
			if mode == "canceled-before" {
				cancel()
			}
			svc := datasource.New(datasource.Options{Store: store, ResourceReader: reader})
			result, err := svc.Fetch(ctx, "orders", nil, datasource.FetchOptions{})
			if err == nil || result != nil {
				t.Fatalf("%s released data: %+v %v", mode, result, err)
			}
			if mode == "reader-denied" && !errors.Is(err, identity.ErrResourceDenied) {
				t.Fatal("reader denial type lost")
			}
			wantCalls := 1
			if mode == "missing-reader" || mode == "missing-service" || mode == "missing-uri" || mode == "canceled-before" {
				wantCalls = 0
			}
			if calls != wantCalls {
				t.Fatalf("calls=%d want=%d", calls, wantCalls)
			}
		})
	}
}
