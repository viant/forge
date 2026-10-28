package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

func TestPublishedTrustedAliasesShareAuthorityAndNeverResolveRemoteMetadata(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	g.mu.Lock()
	g.publishedMetadata = nil
	g.mu.Unlock()
	canonical := "mcp://workspace/catalog"
	require.NoError(t, g.RegisterPublishedMetadataSource(Connection{Name: "catalog", ProviderIdentity: "publisher"}, []string{"example"}, source, canonical))
	for _, name := range []string{"catalog", canonical} {
		page, err := ListPageFrom[json.RawMessage](context.Background(), g, []Connection{{Name: name}}, "report", CatalogQuery{})
		require.NoError(t, err)
		require.Len(t, page.Items, 1)
		require.Equal(t, name, page.Items[0].Connection.Name)
		got, err := GetFrom[json.RawMessage](context.Background(), g, Connection{Name: name, ProviderIdentity: "publisher"}, identity.ResourceRef{URI: "report://example/sample"}, decodeDefinition[json.RawMessage])
		require.NoError(t, err)
		require.Equal(t, "publisher", got.ResolvedResource.ProviderIdentity)
	}
	require.ErrorIs(t, g.RegisterPublishedMetadataSource(Connection{Name: "other", ProviderIdentity: "other"}, []string{"other"}, source, canonical), ErrCollision)
	g.Invalidate(canonical)
	require.Equal(t, g.generation("catalog"), g.generation(canonical))
	require.EqualValues(t, 1, g.generation(canonical))
	require.Zero(t, trap.calls)
}
func TestPublishedGetWithCodecCachesNavigationAndPreservesOriginalPin(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	ctx := context.Background()
	connection := Connection{Name: "catalog", ProviderIdentity: "publisher"}
	parses := 0
	codec := DefinitionCodec[json.RawMessage]{ID: "synthetic.navigation.v1", Parse: func(raw json.RawMessage) (json.RawMessage, error) { parses++; return raw, nil }}
	first, err := GetWithCodec(ctx, g, connection, identity.ResourceRef{URI: "navigation://example/sample"}, nil, codec)
	require.NoError(t, err)
	first.Definition[0] = '!'
	first.Resource.Definition[0] = '!'
	second, err := GetWithCodec(ctx, g, connection, identity.ResourceRef{URI: "navigation://example/sample"}, first.ResolvedResource, codec)
	require.NoError(t, err)
	require.Equal(t, byte('{'), second.Definition[0])
	require.Equal(t, byte('{'), second.Resource.Definition[0])
	require.Equal(t, *first.ResolvedResource, *second.ResolvedResource)
	require.Equal(t, 1, parses)
	require.EqualValues(t, 1, source.gets.Load())
	require.Zero(t, trap.calls)
}
