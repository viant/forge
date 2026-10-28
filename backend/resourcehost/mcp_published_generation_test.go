package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type localGenerationSource struct {
	*syntheticPublishedSource
	generation string
}

func (s *localGenerationSource) MetadataGeneration(context.Context, string) (string, error) {
	return s.generation, nil
}
func TestMCPDefinitionGenerationWithoutSourceFenceNeverReusesMemo(t *testing.T) {
	gateway, source, trap, _ := publishedFixture(t)
	reader, err := NewMCPReferenceReader(gateway, MCPDefinitionSource{ConnectionName: "catalog", ProviderIdentity: "publisher", Namespace: "example"}, nil)
	require.NoError(t, err)
	ctx := context.Background()
	require.NotEqual(t, reader.DefinitionGeneration(ctx), reader.DefinitionGeneration(ctx))
	require.NotEqual(t, reader.DefinitionContentGeneration(ctx), reader.DefinitionContentGeneration(ctx))
	require.Zero(t, source.gets.Load())
	require.Zero(t, trap.calls)
}
func TestMCPDefinitionGenerationUsesSourceAdmissionAndLocalVersion(t *testing.T) {
	gateway, source, trap, _ := publishedFixture(t)
	versioned := &localGenerationSource{syntheticPublishedSource: source, generation: "generation-1"}
	gateway.mu.Lock()
	gateway.publishedMetadata[0].source = versioned
	gateway.mu.Unlock()
	reader, err := NewMCPReferenceReader(gateway, MCPDefinitionSource{ConnectionName: "catalog", ProviderIdentity: "publisher", Namespace: "example"}, nil)
	require.NoError(t, err)
	ctx := context.Background()
	first, content := reader.DefinitionGeneration(ctx), reader.DefinitionContentGeneration(ctx)
	require.Equal(t, first, reader.DefinitionGeneration(ctx))
	require.Equal(t, content, reader.DefinitionContentGeneration(ctx))
	versioned.generation = "generation-2"
	require.NotEqual(t, first, reader.DefinitionGeneration(ctx))
	require.NotEqual(t, content, reader.DefinitionContentGeneration(ctx))
	before := reader.DefinitionContentGeneration(ctx)
	source.denied = true
	require.NotEqual(t, before, reader.DefinitionContentGeneration(ctx))
	require.NotEqual(t, reader.DefinitionContentGeneration(ctx), reader.DefinitionContentGeneration(ctx))
	require.Zero(t, source.gets.Load())
	require.Zero(t, trap.calls)
}
