package resource

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/afs"
	manager "github.com/viant/forge/backend/clientpool"
	service "github.com/viant/forge/backend/provider"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

func TestENGScopedWindowListPreservesLegacyRolesWithoutUnrelatedDiscovery(t *testing.T) {
	ctx := context.Background()
	internal := provider("internal-owner")
	var unrelated atomic.Int32
	blocked := errors.New("unrelated discovery must not participate")
	mgr, err := manager.New(fixtureOptions{"unrelated": {}}, manager.WithClientFactory(func(_ context.Context, _, name string) (mcpclient.Interface, error) {
		if name == "unrelated" {
			unrelated.Add(1)
			return nil, blocked
		}
		return internal, nil
	}))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	require.NoError(t, mgr.RegisterLocal(ctx, "internal", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "internal-owner"}, func(context.Context) (mcpclient.Interface, error) { return internal, nil }))
	actor, verify := PublicReadActors()
	gateway := NewGateway(mgr, actor, verify, "")
	defer gateway.Close()
	proof, err := types.NewWindowTargetHMAC(make([]byte, 32))
	require.NoError(t, err)
	var roles []string
	local, err := service.NewMetadataWindowCatalog(meta.New(afs.New(), t.TempDir()), t.TempDir(), []service.SavedWindow{
		{WindowDefinitionSummary: service.WindowDefinitionSummary{WindowID: "legacy-open", ResourceURI: "window://legacy/open"}, Key: "open"},
		{WindowDefinitionSummary: service.WindowDefinitionSummary{WindowID: "legacy-hidden", ResourceURI: "window://legacy/hidden"}, Key: "hidden", Roles: []string{"admin"}},
	}, service.WithWindowAuthorizer(func(context.Context, string) (bool, error) { return true, nil }), service.WithWindowRoleResolver(func(context.Context) ([]string, error) { return roles, nil }))
	require.NoError(t, err)
	catalog := &CompositeWindowCatalog{Local: local, LocalProviderIdentity: "legacy-owner", Remote: &WindowCatalog{Gateway: gateway, TargetProof: proof}}
	roots := []Connection{{Name: "internal", ProviderIdentity: "internal-owner"}}
	rows, err := catalog.ListFrom(ctx, roots, nil)
	require.NoError(t, err)
	require.Len(t, rows.Windows, 2)
	for _, row := range rows.Windows {
		require.NotEqual(t, "legacy-hidden", row.WindowID)
	}
	require.Zero(t, unrelated.Load())
	roles = []string{"admin"}
	rows, err = catalog.ListFrom(ctx, roots, nil)
	require.NoError(t, err)
	require.Len(t, rows.Windows, 3)
	require.Zero(t, unrelated.Load())
	roles = nil
	catalog.LocalProviderIdentity = "internal-owner"
	rows, err = catalog.ListFrom(ctx, roots, nil)
	require.NoError(t, err)
	require.Len(t, rows.Windows, 1, "local owner exclusion must retain its role filtering")
	_, err = catalog.ListFrom(ctx, []Connection{{Name: "internal", ProviderIdentity: "wrong-owner"}}, nil)
	require.ErrorIs(t, err, ErrCollision, "excluded roots still require correct declared ownership")
	_, err = catalog.Remote.ListFrom(ctx, []Connection{{Name: ""}}, nil)
	require.ErrorIs(t, err, ErrCollision, "empty roots cannot become a successful empty inventory")
	catalog.LocalProviderIdentity = "legacy-owner"
	_, err = catalog.List(ctx, nil)
	require.ErrorIs(t, err, blocked)
	require.Positive(t, unrelated.Load(), "ordinary global discovery retains its existing behavior")
}
