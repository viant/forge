package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
)

type preparedMenuSource struct {
	*syntheticPublishedSource
	menus    map[string]*primitive.MenuProjection
	menuGets int
}

func (s *preparedMenuSource) GetMenu(ctx context.Context, uri string) (*primitive.GetResult, error) {
	s.menuGets++
	key, err := s.AdmissionKey(ctx)
	if err != nil {
		return nil, err
	}
	projection := s.menus[key]
	if projection == nil {
		return nil, identity.ErrResourceDenied
	}
	state, exists := s.states[uri]
	if !exists {
		return nil, identity.ErrResourceDenied
	}
	state.Definition, state.DefinitionBytes = nil, nil
	return &primitive.GetResult{Resource: &state, MenuProjection: clonePublishedMenu(projection)}, nil
}

func TestPublishedPreparedMenuUsesSourcePinAndSelectionScopedCodec(t *testing.T) {
	gateway, original, trap, _ := publishedFixture(t)
	ctx := context.Background()
	uri := "navigation://example/sample"
	sourceRaw := json.RawMessage(`{"applications":[{"menus":[{"action":{"resourceUri":"window://example/one"}},{"action":{"resourceUri":"window://example/two"}}]}]}`)
	state := original.states[uri]
	state.DefinitionBytes = sourceRaw
	state.ContentFingerprint = identity.ContentFingerprint(sourceRaw)
	original.states[uri] = state
	source := &preparedMenuSource{syntheticPublishedSource: original, menus: map[string]*primitive.MenuProjection{}}
	for _, name := range []string{"one", "two"} {
		projection, err := producer.ProjectMenuTargets(ctx, sourceRaw, map[string]bool{"window://example/" + name: true})
		require.NoError(t, err)
		source.menus[name] = projection
	}
	gateway.mu.Lock()
	gateway.publishedMetadata[0].source = source
	gateway.mu.Unlock()
	connection := Connection{Name: "catalog", ProviderIdentity: "publisher"}
	parses := 0
	codec := DefinitionCodec[json.RawMessage]{ID: "synthetic.prepared-menu.v1", Parse: func(raw json.RawMessage) (json.RawMessage, error) { parses++; return raw, nil }}
	var first *identity.ResolvedResource
	for _, name := range []string{"one", "two", "one", "two"} {
		original.admission = name
		got, err := GetWithCodec(ctx, gateway, connection, identity.ResourceRef{URI: uri}, nil, codec)
		require.NoError(t, err)
		require.Equal(t, state.ContentFingerprint, got.ResolvedResource.ContentFingerprint)
		require.Equal(t, state.ContentFingerprint, got.Resource.ContentFingerprint)
		require.Empty(t, got.Resource.Definition)
		require.Empty(t, got.Resource.DefinitionBytes)
		require.Equal(t, source.menus[name].ContentFingerprint, got.MenuProjection.ContentFingerprint)
		require.Contains(t, string(got.MenuProjection.DefinitionBytes), `"schemaVersion":1`)
		require.JSONEq(t, string(source.menus[name].DefinitionBytes), string(got.Definition))
		if first == nil {
			pin := *got.ResolvedResource
			first = &pin
		}
		got.Definition[0] = '!'
		got.MenuProjection.DefinitionBytes[0] = '!'
	}
	require.Equal(t, 2, parses, "decode once per source and admitted root selection")
	require.Equal(t, 2, source.menuGets)
	require.Zero(t, original.gets.Load(), "must not read unfiltered menu source")
	original.admission = "two"
	_, err := gateway.GetMenu(ctx, connection, identity.ResourceRef{URI: uri}, first)
	require.Error(t, err, "source identity alone cannot authorize a different selected root set")
	got, err := gateway.GetMenu(ctx, connection, identity.ResourceRef{URI: uri}, nil)
	require.NoError(t, err)
	require.Equal(t, state.ContentFingerprint, got.Resource.ContentFingerprint)
	require.NotNil(t, got.MenuProjection)
	original.admission = "empty"
	_, err = GetWithCodec(ctx, gateway, connection, identity.ResourceRef{URI: uri}, nil, codec)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	original.denied = true
	_, err = gateway.GetMenu(ctx, connection, identity.ResourceRef{URI: uri}, nil)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Zero(t, trap.calls, "published menu path must stay entirely local")
}
