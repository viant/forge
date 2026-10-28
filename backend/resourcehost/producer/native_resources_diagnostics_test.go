package provider

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp-protocol/schema"
)

func TestNativeResourceFailureIdentifiesStageWithoutChangingWireError(t *testing.T) {
	uri := "agently-runtime://workspace/example"
	for _, test := range []struct {
		name     string
		stage    string
		category string
		cancel   bool
	}{
		{name: "request", stage: "request", category: "denied"},
		{name: "current_actor", stage: "current_actor", category: "denied"},
		{name: "current_actor_canceled", stage: "current_actor", category: "canceled", cancel: true},
		{name: "read", stage: "read", category: "stale"},
		{name: "finish_actor", stage: "finish_actor", category: "canceled"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var observed []NativeResourceFailure
			var verifies int
			actor := identity.VerifiedActor{Subject: "reader", Issuer: "example.test", TenantID: "tenant", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
			provider := &LocalProvider{
				actor: func(context.Context) (identity.VerifiedActor, error) {
					if test.name == "current_actor" {
						return identity.VerifiedActor{}, fmt.Errorf("private actor error: %w", identity.ErrResourceDenied)
					}
					return actor, nil
				},
				verify: func(context.Context, identity.VerifiedActor) error {
					verifies++
					if test.name == "finish_actor" && verifies == 2 {
						return fmt.Errorf("private verifier error: %w", context.DeadlineExceeded)
					}
					return nil
				},
			}
			resource := NativeResource{Metadata: schema.Resource{Uri: uri}, Read: func(context.Context) ([]byte, error) {
				if test.name == "read" {
					return nil, fmt.Errorf("private document error: %w", identity.ErrResourceStale)
				}
				return []byte("private document"), nil
			}, OnFailure: func(_ context.Context, failure NativeResourceFailure) {
				observed = append(observed, failure)
			}}
			request := &schema.ReadResourceRequest{Params: schema.ReadResourceRequestParams{Uri: uri}}
			if test.name == "request" {
				request = nil
			}
			ctx := context.Background()
			if test.cancel {
				canceled, cancel := context.WithCancel(ctx)
				cancel()
				ctx = canceled
			}
			result, rpcErr := (&localMCPHandler{provider: provider}).readNativeResource(ctx, request, resource)
			require.Nil(t, result)
			require.NotNil(t, rpcErr)
			require.Equal(t, -32602, rpcErr.Code)
			require.Equal(t, "native resource unavailable", rpcErr.Message)
			require.Equal(t, []NativeResourceFailure{{Stage: test.stage, Category: test.category}}, observed)
		})
	}
}

func TestNativeResourceSuccessDoesNotEmitFailure(t *testing.T) {
	uri := "agently-runtime://workspace/example"
	actor := identity.VerifiedActor{Subject: "reader", Issuer: "example.test", TenantID: "tenant", AccountID: "account", IdentityRevision: "one", ValidUntil: time.Now().Add(time.Minute)}
	provider := &LocalProvider{actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, verify: func(context.Context, identity.VerifiedActor) error { return nil }}
	resource := NativeResource{Metadata: schema.Resource{Uri: uri}, Read: func(context.Context) ([]byte, error) { return []byte("document"), nil }, OnFailure: func(context.Context, NativeResourceFailure) { t.Fatal("unexpected failure callback") }}
	result, rpcErr := (&localMCPHandler{provider: provider}).readNativeResource(context.Background(), &schema.ReadResourceRequest{Params: schema.ReadResourceRequestParams{Uri: uri}}, resource)
	require.Nil(t, rpcErr)
	require.Equal(t, "document", result.Contents[0].Text)
}
