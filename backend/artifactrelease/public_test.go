package artifactrelease

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/authz"
	"github.com/viant/forge/backend/artifactcohort"
)

func TestPublicReleaseUsesExistingCASWithoutNamedPolicy(t *testing.T) {
	ctx := context.Background()
	p := artifactcohort.NewPublisher()
	a, _, err := p.Publish(ctx, artifactcohort.RootRef{URI: "style://shared/base", Kind: "style", Version: 1}, json.RawMessage(`{"schemaVersion":1,"tokens":{"--surface":"white"}}`), func(context.Context, json.RawMessage) error { return nil })
	require.NoError(t, err)
	bundle, err := NewBundle(ctx, "shared", []artifactcohort.RootRef{a.Root}, func(_ context.Context, ref artifactcohort.RootRef) (*artifactcohort.Artifact, error) {
		return p.Get(ref)
	})
	require.NoError(t, err)
	key := Key{Tenant: "tenant", Account: "owner", Workspace: "workspace", Namespace: "shared", Name: "base"}
	channel, err := NewPublicChannel(key, "Shared presentation")
	require.NoError(t, err)
	channel, err = PreparePromotion(channel, 0, bundle)
	require.NoError(t, err)
	require.True(t, channel.Public)
	compiled, err := CompileCohorts(ctx, channel, bundle, nil)
	require.NoError(t, err)
	require.Empty(t, compiled.Policies)
	require.Empty(t, compiled.Dependencies)
	require.Len(t, compiled.Cohorts, 1)
	require.True(t, compiled.Cohorts[0].Public)
	require.Equal(t, ReleasePublicCohortName(key), compiled.Cohorts[0].Name)
	_, err = p.ReplaceCatalog(ctx, compiled.Policies, compiled.Cohorts, p.Generation())
	require.NoError(t, err)
	_, err = p.FetchPublic(artifactcohort.FetchInput{Tenant: key.Tenant, Root: a.Root})
	require.NoError(t, err)
	doc, ref := releaseNamedPolicy(key.Tenant, "members", "member", 1)
	private, err := PrepareChannelUpdateAudience(channel, channel.Revision, "Members", []authz.NamedReference{ref}, false, bundle)
	require.NoError(t, err)
	require.False(t, private.Public)
	compiled, err = CompileCohorts(ctx, private, bundle, []authz.Document{doc})
	require.NoError(t, err)
	require.NotEmpty(t, compiled.Policies)
	_, err = p.ReplaceCatalog(ctx, compiled.Policies, compiled.Cohorts, p.Generation())
	require.NoError(t, err)
	_, err = p.FetchPublic(artifactcohort.FetchInput{Tenant: key.Tenant, Root: a.Root})
	require.ErrorIs(t, err, artifactcohort.ErrDenied)
	_, err = PrepareChannelUpdateAudience(private, channel.Revision, "Public", nil, true, bundle)
	require.ErrorIs(t, err, ErrConflict)
	_, err = PrepareChannelUpdateAudience(private, private.Revision, "Conflicting", []authz.NamedReference{ref}, true, bundle)
	require.ErrorIs(t, err, ErrInvalid)
	in := PublishInput{Namespace: key.Namespace, Name: key.Name, Public: true, Roots: []artifactcohort.RootRef{a.Root}}
	require.NoError(t, in.Validate())
	in.Policies = []authz.NamedReference{ref}
	require.ErrorIs(t, in.Validate(), ErrInvalid)
}
