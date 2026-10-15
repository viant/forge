// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	requestctx "github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func TestFetchTimelessMetadataWithFiniteProofAndAuthenticatedActor(t *testing.T) {
	now := time.Now()
	actor := identity.VerifiedActor{Issuer: "fixture", Subject: "alice", TenantID: "team", AccountID: "account", IdentityRevision: "current", ValidUntil: now.Add(time.Hour)}
	signer, err := identity.NewSelectionHMAC(make([]byte, 32))
	require.NoError(t, err)
	signer.Now = func() time.Time { return now }
	pin := identity.ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "original"}
	child := pin
	child.URI = "datasource://team/rows"
	target := &types.WindowTarget{Platform: "web", DependencyPins: map[string]identity.ResolvedResource{"rows": child}}
	parameters := map[string]any{"original": json.Number("9007199254740993")}
	targetBytes, _ := json.Marshal(target)
	binding, err := signer.Bind(context.Background(), pin, targetBytes, actor, "instance", parameters)
	require.NoError(t, err)
	proofResource := pin
	proofResource.ValidUntil = now.Add(time.Minute)
	proof := &primitive.ExecutionProof{Resource: proofResource, Binding: "provider-owned", Token: "synthetic-token"}
	descriptor := &dsproto.DataSource{ID: "rows", DataSource: types.DataSource{Selectors: &types.Selectors{Data: "data"}}, Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "managing", Method: "read"}}
	calls := 0
	var metadataDeadline time.Time
	expireChild := false
	service := New(Options{DisableCache: true, Now: func() time.Time { return now }, NewDeliveryPreparer: func(ctx context.Context, original OriginalDelivery) (context.Context, *PreparedDelivery, error) {
		raw, _ := json.Marshal(original.Target)
		if err := signer.VerifyOriginalForNewDelivery(ctx, *original.Resource, raw, *original.SelectionBinding, original.WindowParameters, actor); err != nil {
			return nil, nil, err
		}
		original.Resource.ValidUntil = metadataDeadline
		if expireChild {
			child := original.Target.DependencyPins["rows"]
			child.ValidUntil = now.Add(-time.Second)
			original.Target.DependencyPins["rows"] = child
		}
		return ctx, &PreparedDelivery{Resource: original.Resource, Target: original.Target, ResourceProof: proof}, nil
	}, ResolveResource: func(_ context.Context, pin identity.ResolvedResource) (*identity.ResolvedResource, error) {
		if !identity.MetadataExpiryValid(pin.ValidUntil, now) {
			return nil, identity.ErrResourceDenied
		}
		return &pin, nil
	}, ResolveDefinition: func(context.Context, identity.ResolvedResource, *types.WindowTarget, string) (*dsproto.DataSource, error) {
		return descriptor, nil
	}, Executor: deliveryExecutor(func(_ context.Context, method string, args map[string]any) (string, error) {
		require.Equal(t, "managing:read", method)
		require.Equal(t, "mutable-owned", args["id"])
		calls++
		return `{"data":[{"id":"mutable-owned"}]}`, nil
	})})
	opts := FetchOptions{Resource: &pin, Target: target, SelectionBinding: binding, WindowParameters: parameters}
	rows, err := service.Fetch(context.Background(), "rows", map[string]any{"id": "mutable-owned"}, opts)
	require.NoError(t, err)
	require.NotNil(t, rows)
	require.Equal(t, 1, calls)
	metadataDeadline = now.Add(-time.Second)
	rows, err = service.Fetch(context.Background(), "rows", map[string]any{"id": "mutable-owned"}, opts)
	require.Error(t, err)
	require.Nil(t, rows)
	require.Equal(t, 1, calls, "real expired metadata still denied")
	metadataDeadline = time.Time{}
	expireChild = true
	rows, err = service.Fetch(context.Background(), "rows", map[string]any{"id": "mutable-owned"}, opts)
	require.Error(t, err)
	require.Nil(t, rows)
	require.Equal(t, 1, calls, "real expired dependency metadata still denied")
	expireChild = false
	proof.Resource.ValidUntil = time.Time{}
	rows, err = service.Fetch(context.Background(), "rows", map[string]any{"id": "mutable-owned"}, opts)
	require.Error(t, err)
	require.Nil(t, rows)
	require.Equal(t, 1, calls, "timeless metadata cannot create timeless execution proof")
	proof.Resource.ValidUntil = now.Add(-time.Second)
	rows, err = service.Fetch(context.Background(), "rows", map[string]any{"id": "mutable-owned"}, opts)
	require.Error(t, err)
	require.Nil(t, rows)
	require.Equal(t, 1, calls)
	proof.Resource.ValidUntil = now.Add(time.Minute)
	actor.ValidUntil = now.Add(-time.Second)
	rows, err = service.Fetch(context.Background(), "rows", map[string]any{"id": "mutable-owned"}, opts)
	require.Error(t, err)
	require.Nil(t, rows)
	require.Equal(t, 1, calls, "authenticated actor expiry remains strict")
}

func TestProviderComponentMetadataPinsAllowZeroButProofMustExpire(t *testing.T) {
	now := time.Now()
	component := componentFixturePin()
	descriptor := &dsproto.DataSource{ID: "rows", Backend: &dsproto.Backend{Kind: dsproto.BackendDatly, Ownership: "provider", Method: "read", Component: &component}}
	executions := 0
	service := New(Options{DisableCache: true, ProviderExecute: func(context.Context, *dsproto.DataSource, map[string]any) (json.RawMessage, error) {
		executions++
		return json.RawMessage(`{"data":[]}`), nil
	}, ResolveResource: func(_ context.Context, in identity.ResolvedResource) (*identity.ResolvedResource, error) {
		return &in, nil
	}, ResolveDefinition: func(context.Context, identity.ResolvedResource, *types.WindowTarget, string) (*dsproto.DataSource, error) {
		return descriptor, nil
	}})
	pin := identity.ResolvedResource{ProviderIdentity: "owner", URI: "datasource://team/rows", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "original"}
	proofResource := pin
	proofResource.ValidUntil = now.Add(time.Minute)
	ctx := requestctx.WithResourceExecutionProof(requestctx.WithResolvedResource(context.Background(), pin), primitive.ExecutionProof{Resource: proofResource, Binding: "owned", Token: "synthetic"})
	require.NoError(t, service.validateComponentSource(ctx, descriptor))
	rows, err := service.Fetch(context.Background(), "rows", map[string]any{"id": "owned"}, FetchOptions{Resource: &pin, ResourceProof: &primitive.ExecutionProof{Resource: proofResource, Binding: "owned", Token: "synthetic"}})
	require.NoError(t, err)
	require.NotNil(t, rows)
	require.Equal(t, 1, executions)
	proofResource.ValidUntil = time.Time{}
	ctx = requestctx.WithResourceExecutionProof(ctx, primitive.ExecutionProof{Resource: proofResource, Binding: "owned", Token: "synthetic"})
	require.Error(t, service.validateComponentSource(ctx, descriptor))
	rows, err = service.Fetch(context.Background(), "rows", map[string]any{"id": "owned"}, FetchOptions{Resource: &pin, ResourceProof: &primitive.ExecutionProof{Resource: proofResource, Binding: "owned", Token: "synthetic"}})
	require.Error(t, err)
	require.Nil(t, rows)
	require.Equal(t, 1, executions, "expired execution proof cannot dispatch provider component")
	window := pin
	window.URI = "window://team/view"
	ctx = requestctx.WithWindowTarget(requestctx.WithResolvedResource(context.Background(), window), &types.WindowTarget{SelectionToken: "owned", DependencyPins: map[string]identity.ResolvedResource{"rows": pin}})
	require.NoError(t, service.validateComponentSource(ctx, descriptor))
	report := pin
	report.URI = "report://team/view"
	ctx = requestctx.WithResourceDependencies(requestctx.WithResolvedResource(context.Background(), report), report, map[string]identity.ResolvedResource{"rows": pin})
	require.NoError(t, service.validateComponentSource(ctx, descriptor))
}

func TestTimelessMetadataKeepsManagingFetchDenialDatasetScoped(t *testing.T) {
	pin := identity.ResolvedResource{ProviderIdentity: "owner", URI: "window://team/view", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{}`))}, AuthorityBinding: "original"}
	descriptor := &dsproto.DataSource{ID: "rows", Backend: &dsproto.Backend{Kind: dsproto.BackendMCPTool, Service: "managing", Method: "read"}}
	calls := 0
	service := New(Options{DisableCache: true, ResolveResource: func(_ context.Context, in identity.ResolvedResource) (*identity.ResolvedResource, error) {
		return &in, nil
	}, ResolveDefinition: func(context.Context, identity.ResolvedResource, *types.WindowTarget, string) (*dsproto.DataSource, error) {
		return descriptor, nil
	}, AuthorizeDefinition: func(context.Context, *dsproto.DataSource, map[string]any) error { return nil }, Executor: deliveryExecutor(func(_ context.Context, method string, args map[string]any) (string, error) {
		require.Equal(t, "managing:read", method)
		require.Equal(t, "owned-opaque", args["id"])
		calls++
		return "", &dsproto.UpstreamAuthorizationError{Status: 403}
	})})
	rows, err := service.Fetch(context.Background(), "rows", map[string]any{"id": "owned-opaque"}, FetchOptions{Resource: &pin, Target: &types.WindowTarget{Platform: "web", SelectionToken: "original"}})
	require.Nil(t, rows)
	require.True(t, errors.Is(err, dsproto.ErrDatasourceDenied))
	require.Equal(t, 1, calls, "managing denial is not retried")
}
