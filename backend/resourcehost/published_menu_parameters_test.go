package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

type contextualPublishedMenu struct {
	*syntheticPublishedSource
	actor   *identity.VerifiedActor
	calls   int
	suffix  string
	failure error
}

func (s *contextualPublishedMenu) MenuSourceBacked(context.Context, string) (bool, error) {
	return true, nil
}
func (s *contextualPublishedMenu) GetMenu(ctx context.Context, uri string) (*primitive.GetResult, error) {
	return s.GetMenuWithParameters(ctx, uri, nil)
}
func (s *contextualPublishedMenu) GetMenuWithParameters(ctx context.Context, uri string, parameters map[string]any) (*primitive.GetResult, error) {
	s.calls++
	if s.failure != nil {
		return nil, s.failure
	}
	raw, _ := json.Marshal(map[string]any{"schemaVersion": 1, "applications": []any{map[string]any{"id": "example", "menus": []any{map[string]any{"id": "label", "title": fmt.Sprint(s.actor.Subject, "/", parameters["entityId"], "/", s.suffix), "disabled": true}}}}})
	state := s.states[uri]
	state.Definition, state.DefinitionBytes = nil, nil
	return &primitive.GetResult{Resource: &state, MenuProjection: &primitive.MenuProjection{SchemaVersion: 1, DefinitionBytes: raw, ContentFingerprint: identity.ContentFingerprint(raw)}}, nil
}

// Independently authored actors and context values exercise the native codec
// entry point rather than calling the source resolver directly.
func TestPublishedSourceBackedMenuCodecNeverCachesOriginRows(t *testing.T) {
	gateway, original, trap, actor := publishedFixture(t)
	original.admission = "same-admission"
	source := &contextualPublishedMenu{syntheticPublishedSource: original, actor: actor, suffix: "first"}
	gateway.mu.Lock()
	gateway.publishedMetadata[0].source = source
	gateway.mu.Unlock()
	uri := "navigation://example/sample"
	connection := Connection{Name: "catalog", ProviderIdentity: "publisher"}
	parses := 0
	codec := DefinitionCodec[json.RawMessage]{ID: "example.dynamic-navigation", Parse: func(raw json.RawMessage) (json.RawMessage, error) { parses++; return raw, nil }}
	for _, input := range []struct {
		actor  string
		entity int
	}{{"one", 1}, {"two", 2}, {"one", 2}, {"one", 1}} {
		actor.Subject = input.actor
		ctx := WithMenuParameters(context.Background(), map[string]any{"entityId": input.entity})
		got, err := GetWithCodec(ctx, gateway, connection, identity.ResourceRef{URI: uri}, nil, codec)
		require.NoError(t, err)
		require.Contains(t, string(got.Definition), fmt.Sprint(input.actor, "/", input.entity, "/first"))
		require.Equal(t, original.states[uri].ContentFingerprint, got.Resource.ContentFingerprint)
	}
	source.suffix = "refreshed"
	got, err := GetWithCodec(WithMenuParameters(context.Background(), map[string]any{"entityId": 1}), gateway, connection, identity.ResourceRef{URI: uri}, nil, codec)
	require.NoError(t, err)
	require.Contains(t, string(got.Definition), "refreshed")
	require.Equal(t, 5, source.calls)
	require.Equal(t, 5, parses)
	require.Nil(t, gateway.publishedCompiled, "origin projections must never enter the shared immutable representation cache")
	source.failure = errors.New("origin denied")
	_, err = GetWithCodec(context.Background(), gateway, connection, identity.ResourceRef{URI: uri}, nil, codec)
	require.ErrorIs(t, err, source.failure)
	require.Zero(t, original.gets.Load(), "unprojected definition must never be a fallback")
	require.Zero(t, trap.calls)
}
