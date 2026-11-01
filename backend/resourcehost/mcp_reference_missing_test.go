package resource

import (
	"context"
	"io/fs"
	"testing"

	"github.com/stretchr/testify/require"
	clientpool "github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
	"github.com/viant/mcp"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

func TestMCPReferenceMissingDefinitionRetainsNotExist(t *testing.T) {
	ctx := context.Background()
	actor, verify := PublicReadActors()
	configuration, err := NewLocalProvider(LocalConfig{ProviderIdentity: "configuration", Actor: actor, Verify: verify,
		Authorize:  func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil },
		Catalog:    producer.EmptyCatalog{{Namespace: "workspace", Kinds: []primitive.KindSupport{{Kind: "mcp", FormatVersions: []int64{1}, Operations: []string{"list", "get"}}}}},
		Validators: map[string]LocalResourceValidator{"mcp": ValidateMCPDefinition},
	})
	require.NoError(t, err)
	remoteCalls := 0
	mgr, err := clientpool.New(&declaredCatalogProvider{}, clientpool.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) {
		remoteCalls++
		return nil, fs.ErrNotExist
	}))
	require.NoError(t, err)
	t.Cleanup(func() { mgr.CloseConversation("") })
	require.NoError(t, mgr.RegisterLocal(ctx, "configuration", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "configuration", ResourceCacheScopes: map[string]string{"workspace": cfg.ResourceCachePublic}}, func(context.Context) (mcpclient.Interface, error) { return NewLocalMCPClient(configuration) }))
	gateway := NewGateway(mgr, actor, verify, "consumer")
	t.Cleanup(gateway.Close)
	reader, err := NewMCPReferenceReader(gateway, MCPDefinitionSource{ConnectionName: "configuration", ProviderIdentity: "configuration", Namespace: "workspace"}, nil)
	require.NoError(t, err)
	for _, name := range []string{"missing", "mcp://example/hidden"} {
		_, err := reader.Load(ctx, name)
		require.ErrorIs(t, err, fs.ErrNotExist)
		require.NotContains(t, err.Error(), name)
	}
	require.Zero(t, remoteCalls)
}
