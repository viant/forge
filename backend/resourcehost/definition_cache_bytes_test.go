package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

func TestDefinitionCachePreservesExactBytesWithoutDuplicateJSON(t *testing.T) {
	uri := "window://shared/pretty"
	exact := json.RawMessage("{\n  \"view\": {\"content\": {\"id\": \"pretty\"}}\n}\n")
	source := &definitionCacheProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "provider", items: map[string]*dependencyResource{uri: {raw: exact, formatVersion: 2, revision: "1", authorityBinding: "neutral"}}}, gets: map[string]int{}}
	mgr, err := manager.New(fixtureOptions{"source": {PrimitiveProviderIdentity: "provider", ResourceCacheScopes: map[string]string{"shared": cfg.ResourceCachePublic}}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	actor, verify := PublicReadActors()
	g := NewGateway(mgr, actor, verify, "gateway")
	defer g.Close()
	ctx := cacheUser("alice", "token", "conversation")
	connection, err := g.ConnectionForProvider(ctx, "provider")
	require.NoError(t, err)
	first, err := Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri, Revision: "1"}, nil)
	require.NoError(t, err)
	require.Equal(t, exact, first.Definition)
	require.NotNil(t, first.definitionCache)
	reference := first.definitionCache
	_, err = mgr.VisibleCatalogRepresentation(ctx, reference.key, reference.entry, "test.exact-byte-storage", func(raw json.RawMessage) (any, error) {
		var stored primitive.GetResult
		require.NoError(t, json.Unmarshal(raw, &stored))
		require.Empty(t, stored.Resource.Definition, "warm reads must not parse redundant compacted JSON to compare it with exact bytes")
		require.Equal(t, []byte(exact), []byte(stored.Resource.DefinitionBytes))
		return true, nil
	})
	require.NoError(t, err)
	first.Definition[0] = 'X'
	second, err := Get[json.RawMessage](ctx, g, connection, identity.ResourceRef{URI: uri, Revision: "1"}, nil)
	require.NoError(t, err)
	require.Equal(t, exact, second.Definition)
	require.Equal(t, exact, second.Resource.Definition)
	require.Equal(t, 1, source.count(uri))
}
