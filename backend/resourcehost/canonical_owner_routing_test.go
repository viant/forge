package resource

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	mcpclient "github.com/viant/mcp/client"
)

func TestCanonicalWindowOwnerRoutesWithoutAggregateCatalog(t *testing.T) {
	upstream := provider("owner")
	upstream.definition = localWindowBytes(t)
	unrelatedCalls := 0
	options := fixtureOptions{"owned": {PrimitiveProviderIdentity: "owner"}, "offline": {PrimitiveProviderIdentity: "other"}}
	pool, err := manager.New(options, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) {
		if name == "offline" {
			unrelatedCalls++
			return nil, errors.New("unrelated offline MCP")
		}
		return upstream, nil
	}))
	require.NoError(t, err)
	defer pool.CloseConversation("")
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "fixture", TenantID: "team", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	gateway := NewGateway(pool, func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, func(context.Context, identity.VerifiedActor) error { return nil }, "consumer")
	defer gateway.Close()
	proof, err := types.NewWindowTargetHMAC(bytes.Repeat([]byte{3}, 32))
	require.NoError(t, err)
	catalog := &CompositeWindowCatalog{Remote: &WindowCatalog{Gateway: gateway, TargetProof: proof}}
	request := &service.WindowDefinitionGetInput{WindowID: "window://example/sales", ProviderIdentity: "owner", Namespace: "example"}
	for range 2 {
		got, err := catalog.Get(context.Background(), request)
		require.NoError(t, err)
		require.Equal(t, request.WindowID, got.Definition.Resource.URI)
	}
	require.Zero(t, unrelatedCalls, "an explicit owner must not connect to unrelated MCPs")
	require.Zero(t, upstream.calls["windows/list"])
	require.Equal(t, 2, upstream.calls["windows/get"], "selected definitions still reach their managing provider")
	bad := *request
	bad.Namespace = "other"
	_, err = catalog.Get(context.Background(), &bad)
	require.ErrorIs(t, err, identity.ErrResource)
}
