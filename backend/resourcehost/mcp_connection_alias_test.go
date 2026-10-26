package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	clientpool "github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	client "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

func canonicalConnectionProvider(t *testing.T, owner string, definitions map[string]string) *LocalProvider {
	t.Helper()
	actor, verify := PublicReadActors()
	var bindings []LocalResourceBinding
	for name, raw := range definitions {
		uri, err := identity.ParseResourceURI(name)
		require.NoError(t, err)
		source := &indexedWindowSource{uri: uri, raw: json.RawMessage(raw)}
		bindings = append(bindings, LocalResourceBinding{URI: name, FormatVersion: 1, Resolver: func(context.Context, identity.VerifiedActor, string) (*identity.ResourceResolver, error) {
			return &identity.ResourceResolver{ProviderIdentity: owner, Source: source, Policy: indexedWindowPolicy(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
				return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "fixture", ValidUntil: time.Now().Add(time.Hour)}, nil
			})}, nil
		}})
	}
	p, err := NewLocalProvider(LocalConfig{ProviderIdentity: owner, Actor: actor, Verify: verify, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: bindings, Validators: map[string]LocalResourceValidator{"mcp": ValidateMCPDefinition}})
	require.NoError(t, err)
	return p
}

func TestCanonicalNamespaceConnectionReusesDirectAlias(t *testing.T) {
	for _, collision := range []bool{false, true} {
		t.Run(fmt.Sprint("collision=", collision), func(t *testing.T) {
			ctx := context.Background()
			canonical := "mcp://example/supply"
			definitions := map[string]string{
				"mcp://workspace/direct": `{"name":"mcp://example/supply","transport":{"type":"streamable","url":"https://example.invalid/namespace"},"auth":{"useIdToken":true},"primitiveProviderIdentity":"producer","resourceCacheScopes":{"*":"public"}}`,
			}
			roots := []identity.ResourceRef{{URI: "mcp://workspace/direct"}}
			if collision {
				definitions["mcp://workspace/other"] = `{"name":"mcp://example/supply","transport":{"type":"streamable","url":"https://different.example/namespace"},"auth":{"useIdToken":false}}`
				roots = append(roots, identity.ResourceRef{URI: "mcp://workspace/other"})
			}
			configuration := canonicalConnectionProvider(t, "configuration", definitions)
			remote := canonicalConnectionProvider(t, "producer", map[string]string{
				canonical: `{"name":"supply","transport":{"type":"streamable","url":"https://example.invalid/namespace"}}`,
			})
			initializations := 0
			mgr, err := clientpool.New(&declaredCatalogProvider{}, clientpool.WithClientFactory(func(_ context.Context, _, name string) (client.Interface, error) {
				initializations++
				require.Equal(t, canonical, name)
				return NewLocalMCPClient(remote)
			}))
			require.NoError(t, err)
			t.Cleanup(func() { mgr.CloseConversation("") })
			require.NoError(t, mgr.RegisterLocal(ctx, "configuration", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "configuration", ResourceCacheScopes: map[string]string{"workspace": cfg.ResourceCachePublic}}, func(context.Context) (client.Interface, error) { return NewLocalMCPClient(configuration) }))
			actor, verify := PublicReadActors()
			g := NewGateway(mgr, actor, verify, "consumer")
			t.Cleanup(g.Close)
			r, err := NewMCPReferenceReader(g, MCPDefinitionSource{ConnectionName: "configuration", ProviderIdentity: "configuration", Namespace: "workspace"}, roots)
			require.NoError(t, err)
			_, err = mgr.BindDefinitionReader(r)
			require.NoError(t, err)
			if collision {
				_, err := r.List(ctx)
				require.ErrorIs(t, err, ErrCollision)
				require.Zero(t, initializations)
				return
			}
			// Resolving either spelling never needs management or namespace discovery.
			for _, name := range []string{"direct", canonical} {
				options, err := r.Load(ctx, name)
				require.NoError(t, err)
				require.Equal(t, canonical, options.ResolvedIdentity.ServiceName)
				require.True(t, options.Auth.UseIdToken)
			}
			require.Zero(t, initializations)
			names, err := r.List(ctx)
			require.NoError(t, err)
			require.Equal(t, []string{canonical}, names)
			a, err := mgr.Get(ctx, "", "direct")
			require.NoError(t, err)
			b, err := mgr.Get(ctx, "", canonical)
			require.NoError(t, err)
			require.Same(t, a, b)
			require.Equal(t, 1, initializations)

		})
	}
}
