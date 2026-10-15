package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	service "github.com/viant/forge/backend/provider"
	identity "github.com/viant/forge/backend/resource"
)

type pinnedOwnerEnumerationTrap struct {
	localCatalogStub
	lists int
}

func (c *pinnedOwnerEnumerationTrap) List(context.Context, *service.WindowDefinitionListInput) (*service.WindowDefinitionListOutput, error) {
	c.lists++
	return nil, identity.ErrResourceDenied
}

func TestPinnedCompositeRemoteGetRevalidatesExactOwnerWithoutEnumeratingLocalCatalog(t *testing.T) {
	p := provider("remote-owner")
	p.definition = localWindowBytes(t)
	g, _, revoked := fixtureGateway(t, map[string]*fixtureProvider{"remote": p})
	c := enumerationComposite(t, g, "native-owner", "window://native/home")
	local := &pinnedOwnerEnumerationTrap{localCatalogStub: c.Local.(localCatalogStub)}
	c.Local = local
	opened, err := c.Remote.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: "window://example/sales"})
	require.NoError(t, err)
	input := &service.WindowDefinitionGetInput{WindowID: "window://example/sales", ResolvedResource: opened.Definition.Resource, Target: opened.Definition.ResourceTarget}
	for i := 0; i < 2; i++ {
		restored, err := c.Get(context.Background(), input)
		require.NoError(t, err)
		require.Equal(t, opened.Definition.Resource.ResourceCandidate, restored.Definition.Resource.ResourceCandidate)
		require.Equal(t, opened.Definition.Resource.AuthorityBinding, restored.Definition.Resource.AuthorityBinding)
	}
	require.Zero(t, local.lists)
	require.Zero(t, p.calls["windows/list"], "a held owner/pin does not require inventory discovery")
	*revoked = true
	denied, err := c.Get(context.Background(), input)
	require.Error(t, err)
	require.Nil(t, denied)
	*revoked = false
	wrong := *input.ResolvedResource
	wrong.URI = "window://example/Other"
	input.ResolvedResource = &wrong
	denied, err = c.Get(context.Background(), input)
	require.Error(t, err)
	require.Nil(t, denied)
	_, err = c.Get(context.Background(), &service.WindowDefinitionGetInput{WindowID: "window://example/sales"})
	require.Error(t, err, "an unpinned canonical lookup must still perform aggregate admission and collision discovery")
	require.Equal(t, 1, local.lists)
}
