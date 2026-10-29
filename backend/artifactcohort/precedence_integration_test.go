package artifactcohort

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/authz"
)

// Synthetic publication-to-metadata regression; no external services or data.
func TestPolicyPrecedenceThroughColdSyncAndMetadataRefresh(t *testing.T) {
	ctx := actorContext("reader", "operator")
	publisher := NewPublisher()
	publish := func(version uint64) RootRef {
		item, _, err := publisher.Publish(ctx, RootRef{URI: "report://example/summary", Kind: "report", Version: version}, json.RawMessage(`{"schemaVersion":1,"title":"Synthetic report","version":`+itemVersion(version)+`}`), allowPublished)
		require.NoError(t, err)
		return item.Root
	}
	first, higher := publish(1), publish(2)
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{first}
	cohorts = append(cohorts, Cohort{Tenant: "tenant", Name: "preferred", PolicyResource: policies[0].Resource, Priority: 10, Roots: []RootRef{higher}})
	replace := func() {
		_, err := publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation())
		require.NoError(t, err)
	}
	replace()
	caller := &fakeCaller{publisher: publisher, fetches: map[string]int{}}
	facts := &countedFacts{}
	replica, err := NewReplica(Config{Enabled: true, Source: "producer", Tenant: "tenant", Account: "account", Caller: caller, Facts: facts, SessionKey: fixtureSession})
	require.NoError(t, err)
	require.NoError(t, replica.Sync(context.Background()))
	source, err := NewMetadataSource(replica, []string{"example"})
	require.NoError(t, err)
	assertSelected := func(ref RootRef) {
		rows, err := source.List(ctx, "report", "example")
		require.NoError(t, err)
		require.Len(t, rows, 1)
		require.Equal(t, ref.Hash, rows[0].ContentFingerprint)
		got, err := source.Get(ctx, ref.URI)
		require.NoError(t, err)
		require.Equal(t, ref.Hash, got.ContentFingerprint)
	}
	assertSelected(higher)
	joins := facts.calls.Load()
	reads := caller.discovers
	for i := 0; i < 25; i++ {
		assertSelected(higher)
	}
	require.Equal(t, joins, facts.calls.Load(), "hot metadata must reuse local admission")
	require.Equal(t, reads, caller.discovers, "hot metadata must not contact producer")
	key, err := source.AdmissionKey(ctx)
	require.NoError(t, err)
	updated := publish(3)
	cohorts[1].Roots = []RootRef{updated}
	replace()
	require.NoError(t, replica.Sync(ctx))
	assertSelected(updated)
	next, err := source.AdmissionKey(ctx)
	require.NoError(t, err)
	require.NotEqual(t, key, next)
	require.Equal(t, joins, facts.calls.Load(), "content updates do not repeat policy evaluation")
	// Revoking the shared named policy removes all versions; no older fallback.
	policies[0].Revision++
	policies[0].Policies[PolicyAction] = authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "administrator"}}
	replace()
	require.NoError(t, replica.Sync(ctx))
	rows, err := source.List(ctx, "report", "example")
	require.ErrorIs(t, err, ErrDenied)
	require.Empty(t, rows)
	_, err = source.Get(ctx, first.URI)
	require.ErrorIs(t, err, ErrDenied)
}
