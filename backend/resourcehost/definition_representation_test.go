package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

func TestGenericNamespaceCacheCompilesWindowOnceAndDetachesTargets(t *testing.T) {
	uri := "window://shared/original"
	raw := localWindowBytes(t)
	source := &definitionCacheProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "provider", items: map[string]*dependencyResource{uri: {raw: raw, formatVersion: 2, revision: "1", authorityBinding: "neutral"}}}, gets: map[string]int{}}
	options := fixtureOptions{"source": {PrimitiveProviderIdentity: "provider", ResourceCacheScopes: map[string]string{"shared": cfg.ResourceCachePublic}}}
	mgr, err := manager.New(options, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) {
		return identity.VerifiedActor{PublicRead: true}, nil
	}, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer g.Close()
	ctx := cacheUser("alice", "token", "browser")
	connection, err := g.ConnectionForProvider(ctx, "provider")
	require.NoError(t, err)
	parses := 0
	codec := DefinitionCodec[*types.CompiledWindowResource]{ID: "fixture.window.resource", Parse: func(raw json.RawMessage) (*types.CompiledWindowResource, error) {
		parses++
		return types.CompileWindowResource(raw)
	}}
	first, err := GetWithCodec(ctx, g, connection, identity.ResourceRef{URI: uri, Revision: "1"}, nil, codec)
	require.NoError(t, err)
	selected, err := first.Definition.Select(nil)
	require.NoError(t, err)
	selected.Window.Title = "caller mutation"
	next, err := GetWithCodec(ctx, g, connection, identity.ResourceRef{URI: uri, Revision: "1"}, first.ResolvedResource, codec)
	require.NoError(t, err)
	nextSelected, err := next.Definition.Select(nil)
	require.NoError(t, err)
	require.NotEqual(t, "caller mutation", nextSelected.Window.Title)
	require.Equal(t, 1, parses, "default and original selector share same immutable representation")
	require.Equal(t, 1, source.count(uri))
	g.Invalidate("source")
	connection, err = g.ConnectionForProvider(ctx, "provider")
	require.NoError(t, err)
	source.items[uri].raw = json.RawMessage(`{"format":"invalid"}`)
	_, err = GetWithCodec(ctx, g, connection, identity.ResourceRef{URI: uri, Revision: "1"}, nil, codec)
	require.Error(t, err, "changed malformed body must be validated after invalidation")
	require.Equal(t, 2, parses)
}

func TestDefinitionCodecRejectsMissingSchemaAndParser(t *testing.T) {
	_, err := GetWithCodec[json.RawMessage](context.Background(), nil, Connection{}, identity.ResourceRef{}, nil, DefinitionCodec[json.RawMessage]{})
	require.ErrorIs(t, err, identity.ErrResource)
	_, err = GetWithCodec[json.RawMessage](context.Background(), nil, Connection{}, identity.ResourceRef{}, nil, DefinitionCodec[json.RawMessage]{ID: "schema"})
	require.ErrorIs(t, err, identity.ErrResource)
}

func TestDefinitionCodecCannotOutliveRealSourceExpiry(t *testing.T) {
	uri := "window://shared/timed-codec"
	now := time.Now()
	source := &definitionCacheProvider{dependencyMCPProvider: &dependencyMCPProvider{owner: "provider", items: map[string]*dependencyResource{uri: {raw: localWindowBytes(t), formatVersion: 2, revision: identity.WorkingCandidate, authorityBinding: "neutral", validUntil: now.Add(time.Minute)}}}, gets: map[string]int{}}
	mgr, err := manager.New(fixtureOptions{"source": {PrimitiveProviderIdentity: "provider", ResourceCacheScopes: map[string]string{"shared": cfg.ResourceCachePublic}}}, manager.WithClientFactory(func(context.Context, string, string) (mcpclient.Interface, error) { return source, nil }))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	g := NewGateway(mgr, func(context.Context) (identity.VerifiedActor, error) {
		return identity.VerifiedActor{PublicRead: true}, nil
	}, func(context.Context, identity.VerifiedActor) error { return nil }, "gateway")
	defer g.Close()
	g.Now = func() time.Time { return now }
	ctx := cacheUser("alice", "token", "conversation")
	connection, err := g.ConnectionForProvider(ctx, "provider")
	require.NoError(t, err)
	_, err = GetWithCodec(ctx, g, connection, identity.ResourceRef{URI: uri}, nil, DefinitionCodec[*types.CompiledWindowResource]{ID: "fixture.window", Parse: func(raw json.RawMessage) (*types.CompiledWindowResource, error) {
		now = now.Add(2 * time.Minute)
		return types.CompileWindowResource(raw)
	}})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Equal(t, 1, source.count(uri), "no reread or replacement lease during compilation")
}

func TestDatasourceResolutionReusesOpenedWindowRepresentation(t *testing.T) {
	stack := newDependencyStack(t, time.Now().Add(time.Minute), map[string]string{"team": cfg.ResourceCacheUser})
	hits, misses := 0, 0
	ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) {
		if event.Phase == observe.GatewayDefinitionDecode {
			if event.Cache == observe.CacheHit {
				hits++
			}
			if event.Cache == observe.CacheMiss {
				misses++
			}
		}
	}))
	pin, target := *stack.opened.Definition.Resource, stack.opened.Definition.ResourceTarget
	ctx, err := requestctx.WithResourceReadAssociation(ctx, &pin, target)
	require.NoError(t, err)
	ctx, finish, err := stack.gateway.BeginReadSequence(ctx, nil)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, finish()) })
	first, err := stack.catalog.ResolveDatasource(ctx, pin, target, "orders")
	require.NoError(t, err)
	first.ID = "caller-mutated"
	second, err := stack.catalog.ResolveDatasource(ctx, pin, target, "orders")
	require.NoError(t, err)
	require.Equal(t, "orders", second.ID)
	require.GreaterOrEqual(t, hits, 2, "datasource reads must reuse the window representation compiled during opening")
	require.Zero(t, misses, "warm datasource reads must not compile the window again")
}
