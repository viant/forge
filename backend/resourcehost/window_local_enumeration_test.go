package resource

import (
	"bytes"
	"context"
	"github.com/stretchr/testify/require"
	service "github.com/viant/forge/backend/provider"
	"github.com/viant/forge/backend/types"
	"github.com/viant/mcp"
	mcpclient "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"testing"
)

func registerOwnedEnumerationProvider(t *testing.T, g *Gateway, name string, p *fixtureProvider) {
	t.Helper()
	require.NoError(t, g.Manager.RegisterLocal(context.Background(), name, &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: p.owner}, func(context.Context) (mcpclient.Interface, error) { return p, nil }))
}
func enumerationComposite(t *testing.T, g *Gateway, owner, uri string) *CompositeWindowCatalog {
	t.Helper()
	proof, err := types.NewWindowTargetHMAC(bytes.Repeat([]byte{3}, 32))
	require.NoError(t, err)
	return &CompositeWindowCatalog{Local: localCatalogStub{service.WindowDefinitionSummary{WindowID: "native", ResourceURI: uri, ProviderIdentity: owner}}, LocalProviderIdentity: owner, Remote: &WindowCatalog{Gateway: g, TargetProof: proof}}
}
func TestCompositeEnumeratesProcessOwnedLocalConnectionOnlyThroughLocalCatalog(t *testing.T) {
	remote := provider("remote-owner")
	g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"remote": remote})
	native := provider("native-owner")
	registerOwnedEnumerationProvider(t, g, "owned", native)
	catalog := enumerationComposite(t, g, "native-owner", "window://native/home")
	listed, err := catalog.List(context.Background(), nil)
	require.NoError(t, err)
	require.Len(t, listed.Windows, 2)
	require.Empty(t, native.calls, "the remote side must not contact the local provider outside its owning native scope")
	require.Equal(t, 1, remote.calls["windows/list"])
	// Ordinary Gateway.List deliberately retains its complete inventory contract.
	_, err = g.List(context.Background(), "window", "")
	require.NoError(t, err)
	require.Greater(t, native.calls["windows/list"], 0)
}
func TestCompositeExclusionDoesNotHideDifferentConnectionsOrURICollisions(t *testing.T) {
	for _, sameOwner := range []bool{false, true} {
		t.Run(map[bool]string{false: "same-URI-different-owner", true: "external-claims-native-owner"}[sameOwner], func(t *testing.T) {
			owner := "remote-owner"
			if sameOwner {
				owner = "native-owner"
			}
			remote := provider(owner)
			g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{"external": remote})
			native := provider("native-owner")
			registerOwnedEnumerationProvider(t, g, "owned", native)
			uri := "window://example/sales"
			if sameOwner {
				uri = "window://native/home"
			}
			result, err := enumerationComposite(t, g, "native-owner", uri).List(context.Background(), nil)
			require.ErrorIs(t, err, ErrCollision)
			require.Nil(t, result)
			require.Empty(t, native.calls)
		})
	}
}
func TestCompositeRejectsAmbiguousOwnedProviderRegistrationBeforeTransport(t *testing.T) {
	g, _, _ := fixtureGateway(t, map[string]*fixtureProvider{})
	a, b := provider("native-owner"), provider("native-owner")
	registerOwnedEnumerationProvider(t, g, "first", a)
	registerOwnedEnumerationProvider(t, g, "second", b)
	result, err := enumerationComposite(t, g, "native-owner", "window://native/home").List(context.Background(), nil)
	require.ErrorIs(t, err, ErrCollision)
	require.Nil(t, result)
	require.Empty(t, a.calls)
	require.Empty(t, b.calls)
}
