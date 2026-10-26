package resource

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	client "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
)

type declaredCatalogProvider struct{ reader manager.DefinitionReader }

func (p *declaredCatalogProvider) ReservedLocalName(name string) bool { return name == "configuration" }

func (p *declaredCatalogProvider) Options(ctx context.Context, name string) (*cfg.MCPClient, error) {
	return p.reader.Load(ctx, name)
}
func (p *declaredCatalogProvider) Names(ctx context.Context) ([]string, error) {
	return []string{"arbitrary-root", "tool-connection"}, nil
}
func (p *declaredCatalogProvider) CatalogNames(ctx context.Context) ([]string, error) {
	return p.reader.(*MCPReferenceReader).CatalogNames(ctx)
}
func (p *declaredCatalogProvider) BindDefinitionReader(reader manager.DefinitionReader, _ []string) error {
	p.reader = reader
	return nil
}

// Synthetic configuration includes an arbitrary resource root with no primitive
// pins and an unrelated failing tool connection. Only the declared root is
// eligible for aggregate window discovery; both remain explicit tool targets.
func TestWindowViewReaderUsesDeclaredCatalogRoots(t *testing.T) {
	ctx := context.Background()
	remote := provider("window-owner")
	var envelope map[string]any
	require.NoError(t, json.Unmarshal(localWindowBytes(t), &envelope))
	envelope["viewMetadata"] = map[string]any{"id": "sales", "windowKey": "sales"}
	raw, err := json.Marshal(envelope)
	require.NoError(t, err)
	remote.definition = raw
	actor, verify := PublicReadActors()
	var bindings []LocalResourceBinding
	for _, name := range []string{"arbitrary-root", "tool-connection"} {
		uri, parseErr := identity.ParseResourceURI("mcp://workspace/" + name)
		require.NoError(t, parseErr)
		definition := json.RawMessage(`{"name":"` + name + `","transport":{"type":"streamable","url":"https://example.invalid/mcp"}}`)
		source := &indexedWindowSource{uri: uri, raw: definition}
		bindings = append(bindings, LocalResourceBinding{URI: uri.String(), FormatVersion: 1, Resolver: func(context.Context, identity.VerifiedActor, string) (*identity.ResourceResolver, error) {
			return &identity.ResourceResolver{ProviderIdentity: "configuration", Source: source, Policy: indexedWindowPolicy(func(_ context.Context, _ identity.ResourceRef, candidates []identity.ResourceCandidate) (identity.ResourceDecision, error) {
				return identity.ResourceDecision{Candidate: candidates[0], AuthorityBinding: "fixture", ValidUntil: time.Now().Add(time.Hour)}, nil
			})}, nil
		}})
	}
	configuration, err := NewLocalProvider(LocalConfig{ProviderIdentity: "configuration", Actor: actor, Verify: verify, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: bindings, Validators: map[string]LocalResourceValidator{"mcp": ValidateMCPDefinition}})
	require.NoError(t, err)
	broken := errors.New("synthetic initialize failure")
	toolCalls := 0
	failOwner := false
	mgr, err := manager.New(&declaredCatalogProvider{}, manager.WithClientFactory(func(_ context.Context, _, name string) (client.Interface, error) {
		if name == "tool-connection" {
			toolCalls++
			return nil, broken
		}
		if failOwner {
			return nil, broken
		}
		return remote, nil
	}))
	require.NoError(t, err)
	defer mgr.CloseConversation("")
	require.NoError(t, mgr.RegisterLocal(ctx, "configuration", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: "configuration", ResourceCacheScopes: map[string]string{"workspace": cfg.ResourceCachePublic}}, func(context.Context) (client.Interface, error) { return NewLocalMCPClient(configuration) }))
	gateway := NewGateway(mgr, actor, verify, "consumer")
	defer gateway.Close()
	reader, err := NewMCPReferenceReader(gateway, MCPDefinitionSource{ConnectionName: "configuration", ProviderIdentity: "configuration", Namespace: "workspace"}, []identity.ResourceRef{{URI: "mcp://workspace/arbitrary-root"}})
	require.NoError(t, err)
	bound, err := mgr.BindDefinitionReader(reader)
	require.NoError(t, err)
	require.True(t, bound)
	roots, err := mgr.CatalogNames(ctx)
	require.NoError(t, err)
	require.Equal(t, []string{"arbitrary-root", "configuration"}, roots)
	views, err := NewWindowViewReader(gateway).LoadAll(ctx)
	require.NoError(t, err)
	require.Len(t, views, 1)
	require.Equal(t, "sales", views[0].ID)
	require.Equal(t, "window://example/sales", views[0].ResourceURI)
	require.Zero(t, toolCalls)
	names, err := mgr.Names(ctx)
	require.NoError(t, err)
	require.Contains(t, names, "tool-connection")
	_, err = mgr.Get(ctx, "", "tool-connection")
	require.ErrorIs(t, err, broken)
	require.Equal(t, 1, toolCalls)
	// A selected root failure remains a hard failure after connection eviction.
	failOwner = true
	_, err = mgr.Reconnect(ctx, "", "arbitrary-root")
	require.ErrorIs(t, err, broken)
	_, err = NewWindowViewReader(gateway).LoadAll(ctx)
	require.ErrorIs(t, err, broken)
	withoutRoots, err := NewMCPReferenceReader(gateway, MCPDefinitionSource{ConnectionName: "configuration", ProviderIdentity: "configuration", Namespace: "workspace"}, nil)
	require.NoError(t, err)
	names, err = withoutRoots.CatalogNames(ctx)
	require.NoError(t, err)
	require.Empty(t, names, "ordinary MCP configuration does not implicitly declare resource roots")
}
