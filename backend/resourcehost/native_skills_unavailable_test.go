package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/artifactcohort"
	identity "github.com/viant/forge/backend/resource"
)

// Synthetic independent sources exercise a real unavailable cohort beside a
// healthy published source, including both skill catalog scope passes.
func TestNativeSkillCatalogIsolatesUnavailableCohortAndRecovers(t *testing.T) {
	ctx := context.Background()
	g, _, trap, _ := publishedFixture(t)
	publisher := artifactcohort.NewPublisher()
	replica, err := artifactcohort.NewReplica(artifactcohort.Config{Enabled: true, Source: "other", Tenant: "tenant", Account: "owner", Caller: recoveringPublicCaller{publisher}, Facts: deniedCohortFacts{}, SessionKey: func(context.Context) (string, error) { return "session", nil }})
	require.NoError(t, err)
	source, err := artifactcohort.NewMetadataSource(replica, []string{"other"})
	require.NoError(t, err)
	connection := Connection{Name: "other-catalog", ProviderIdentity: "other"}
	require.NoError(t, g.RegisterPublishedMetadataSource(connection, []string{"other"}, source))
	skills := &NativeSkillSource{Gateway: g}
	names, err := skills.Names(ctx)
	require.NoError(t, err)
	before, _, err := skills.CatalogScope(ctx, "conversation", names)
	require.NoError(t, err, "an unavailable sibling must not block all skills")
	page, err := ListPage[json.RawMessage](ctx, g, "skill", CatalogQuery{}, false)
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	_, _, err = skills.PublishedSkill(ctx, connection.Name, "skill://other/review")
	require.ErrorIs(t, err, artifactcohort.ErrUnavailable)
	artifact, _, err := publisher.Publish(ctx, artifactcohort.RootRef{URI: "skill://other/review", Kind: "skill", Version: 1}, json.RawMessage(`{"schemaVersion":1,"document":"---\nname: review\ndescription: Synthetic guidance\n---\nReview examples."}`), func(context.Context, json.RawMessage) error { return nil })
	require.NoError(t, err)
	_, err = publisher.ReplaceCatalog(ctx, nil, []artifactcohort.Cohort{{Tenant: "tenant", Name: "public", Public: true, Roots: []artifactcohort.RootRef{artifact.Root}}}, publisher.Generation())
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	after, _, err := skills.CatalogScope(ctx, "conversation", names)
	require.NoError(t, err)
	require.NotEqual(t, before, after, "recovery must invalidate the partial catalog")
	page, err = ListPage[json.RawMessage](ctx, g, "skill", CatalogQuery{}, false)
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	_, _, err = skills.CatalogScope(canceled, "conversation", names)
	require.Error(t, err, "canceled discovery must fail instead of returning a catalog")
	_, err = g.Get(ctx, connection, identity.ResourceRef{URI: "skill://other/missing"}, nil)
	require.Error(t, err)
	require.Zero(t, trap.calls, "local cohort checks must not negotiate a publisher")
}
