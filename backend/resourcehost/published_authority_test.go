package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

type stablePublishedSource struct {
	*syntheticPublishedSource
	authority string
}

func (s *stablePublishedSource) AuthorityKey(context.Context, string) (string, error) {
	if s.denied {
		return "", identity.ErrResourceDenied
	}
	return s.authority, nil
}

func TestPublishedPinsSeparateStableAuthorityFromReadinessFences(t *testing.T) {
	g, source, trap, _ := publishedFixture(t)
	stable := &stablePublishedSource{syntheticPublishedSource: source, authority: "verified-session-policy-content"}
	g.publishedMetadata[0].source = stable
	ctx := context.Background()
	connection := Connection{Name: "catalog", ProviderIdentity: "publisher"}
	ref := identity.ResourceRef{URI: "report://example/sample"}
	got, err := Get[json.RawMessage](ctx, g, connection, ref, nil)
	require.NoError(t, err)
	wire, err := json.Marshal(got.ResolvedResource)
	require.NoError(t, err)
	var pin identity.ResolvedResource
	require.NoError(t, json.Unmarshal(wire, &pin))
	source.admission = "reconciled-readiness"
	_, err = Get[json.RawMessage](ctx, g, connection, ref, &pin)
	require.NoError(t, err)
	_, err = Get[json.RawMessage](ctx, g, connection, ref, &pin, func(raw json.RawMessage) (json.RawMessage, error) {
		source.admission = "changed-during-read"
		return raw, nil
	})
	require.ErrorIs(t, err, identity.ErrResourceDenied, "an in-flight readiness change must still fail")
	_, err = Get[json.RawMessage](ctx, g, connection, ref, &pin, func(raw json.RawMessage) (json.RawMessage, error) {
		stable.authority = "changed-authority-during-read"
		return raw, nil
	})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	_, err = Get[json.RawMessage](ctx, g, connection, ref, &pin)
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Zero(t, trap.calls)
}
