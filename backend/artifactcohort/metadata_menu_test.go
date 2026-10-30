package artifactcohort

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/authz"
)

// Independently authored synthetic resources; no application captures.
func TestMetadataMenuSelectionCachesProjectionAndPreservesSource(t *testing.T) {
	ctx := actorContext("synthetic-user", "operator")
	publisher := NewPublisher()
	publish := func(uri, kind string, payload json.RawMessage) RootRef {
		artifact, _, err := publisher.Publish(ctx, RootRef{URI: uri, Kind: kind, Version: 1}, payload, allowPublished)
		require.NoError(t, err)
		return artifact.Root
	}
	// Legacy source deliberately omits schemaVersion. Only derived bytes acquire
	// portable version one; the retained source fingerprint remains unchanged.
	raw := json.RawMessage(`{"name":"Synthetic menu","applications":[{"id":"visible","menus":[{"id":"group","children":[{"id":"one","action":{"resourceUri":"window://synthetic/one","parameters":{"large":9007199254740993,"zero":0,"enabled":false,"optional":null}}},{"id":"two","action":{"resourceURI":"report://synthetic/two"}}]},{"id":"empty","children":[{"action":{"resourceUri":"window://synthetic/missing"}}]}]},{"id":"empty-app","menus":[{"action":{"resourceUri":"window://other/absent"}}]}]}`)
	menu := publish("navigation://synthetic/main", "navigation", raw)
	one := publish("window://synthetic/one", "window", json.RawMessage(`{"schemaVersion":1,"title":"Synthetic one"}`))
	two := publish("report://synthetic/two", "report", json.RawMessage(`{"schemaVersion":1,"title":"Synthetic two"}`))
	policies, _ := cohortFixture()
	cohorts := []Cohort{
		{Tenant: "tenant", Name: "first", PolicyResource: policies[0].Resource, Roots: []RootRef{menu, one}},
		{Tenant: "tenant", Name: "second", PolicyResource: policies[0].Resource, Roots: []RootRef{menu, two}},
		{Tenant: "tenant", Name: "empty", PolicyResource: policies[0].Resource, Roots: []RootRef{menu}},
	}
	_, err := publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation())
	require.NoError(t, err)
	caller, facts := &fakeCaller{publisher: publisher, fetches: map[string]int{}}, &countedFacts{}
	store := &countedArtifactStore{timingStore: timingStore{values: map[RootRef]*Artifact{}}}
	replica, err := NewReplica(Config{Enabled: true, Source: "synthetic", Tenant: "tenant", Account: "account", Caller: caller, Facts: facts, Store: store, SessionKey: fixtureSession, Cohort: func(ctx context.Context) (string, error) {
		selected, _ := ctx.Value(cohortSelectorKey{}).(string)
		return selected, nil
	}})
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	source, err := NewMetadataSource(replica, []string{"synthetic"})
	require.NoError(t, err)
	first, second, empty := selectCohort(ctx, "first"), selectCohort(ctx, "second"), selectCohort(ctx, "empty")
	key1, err := source.AdmissionKey(first)
	require.NoError(t, err)
	key2, err := source.AdmissionKey(second)
	require.NoError(t, err)
	require.NotEqual(t, key1, key2, "trusted selectors with the same session/manifest must not share projections")
	policyCalls := facts.calls.Load()
	for round := 0; round < 5; round++ {
		for _, selected := range []context.Context{first, second} {
			got, err := source.GetMenu(selected, menu.URI)
			require.NoError(t, err)
			require.Equal(t, menu.Hash, got.Resource.ContentFingerprint)
			require.Empty(t, got.Resource.DefinitionBytes)
			require.Empty(t, got.Resource.Definition)
			require.NotEqual(t, menu.Hash, got.MenuProjection.ContentFingerprint)
			require.Contains(t, string(got.MenuProjection.DefinitionBytes), `"schemaVersion":1`)
			require.NotContains(t, string(got.MenuProjection.DefinitionBytes), "empty-app")
			require.NotContains(t, string(got.MenuProjection.DefinitionBytes), `"id":"empty"`)
			if selected == first {
				require.Contains(t, string(got.MenuProjection.DefinitionBytes), "window://synthetic/one")
				require.Contains(t, string(got.MenuProjection.DefinitionBytes), "9007199254740993")
				require.NotContains(t, string(got.MenuProjection.DefinitionBytes), "report://synthetic/two")
			} else {
				require.Contains(t, string(got.MenuProjection.DefinitionBytes), "report://synthetic/two")
				require.NotContains(t, string(got.MenuProjection.DefinitionBytes), "window://synthetic/one")
			}
			got.MenuProjection.DefinitionBytes[0] = '!'
			rows, err := source.List(selected, "navigation", "synthetic")
			require.NoError(t, err)
			require.Len(t, rows, 1)
			require.Equal(t, menu.Hash, rows[0].ContentFingerprint)
		}
	}
	require.Len(t, source.menus, 2, "one prepared menu set per admission selection")
	_, err = source.Get(first, menu.URI)
	require.ErrorIs(t, err, ErrDenied, "ordinary Get must never leak raw navigation")
	_, err = source.GetMenu(empty, menu.URI)
	require.ErrorIs(t, err, ErrDenied)
	rows, err := source.List(empty, "navigation", "synthetic")
	require.NoError(t, err)
	require.Empty(t, rows)
	namespaces, err := source.Namespaces(empty)
	require.NoError(t, err)
	require.Empty(t, namespaces[0].Kinds, "entirely empty menu must not advertise navigation")
	ordinary, err := source.Get(first, one.URI)
	require.NoError(t, err)
	require.Equal(t, one.Hash, Hash(ordinary.DefinitionBytes))
	retained, err := publisher.Get(menu)
	require.NoError(t, err)
	require.True(t, bytes.Equal(raw, retained.Payload))
	require.Equal(t, policyCalls, facts.calls.Load())
	require.Equal(t, 1, caller.discovers)
	for _, count := range caller.fetches {
		require.Equal(t, 1, count)
	}

	// Security keys remain session-specific, but equivalent available exact
	// roots must share the prepared object and avoid even another source hydrate.
	prepared, err := source.preparedNavigation(first)
	require.NoError(t, err)
	storeGets := store.gets.Load()
	otherSession := selectCohort(actorContext("other-synthetic-user", "operator"), "first")
	otherKey, err := source.AdmissionKey(otherSession)
	require.NoError(t, err)
	require.NotEqual(t, key1, otherKey)
	shared, err := source.preparedNavigation(otherSession)
	require.NoError(t, err)
	require.Same(t, prepared, shared, "equivalent sessions must reuse actual projection computation")
	require.Equal(t, storeGets, store.gets.Load(), "shared content must avoid rehydrating and reprojecting the source")
	require.Len(t, source.menus, 3, "two sessions still share the same three content selections")

	// A target partition can become stale without a new manifest. Its local
	// epoch must invalidate the old nonempty projection immediately.
	require.NoError(t, replica.MarkUpdated(one.URI))
	staleKey, err := source.AdmissionKey(first)
	require.NoError(t, err)
	require.NotEqual(t, key1, staleKey)
	_, err = source.GetMenu(first, menu.URI)
	require.ErrorIs(t, err, ErrDenied)
	_, err = source.GetMenu(second, menu.URI)
	require.NoError(t, err, "unrelated target partition stays available")
	require.NoError(t, replica.Sync(ctx))
	_, err = source.GetMenu(first, menu.URI)
	require.NoError(t, err, "local activation invalidates the empty snapshot too")
	policies[0].Revision++
	policies[0].Policies[PolicyAction] = authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "other-role"}}
	_, err = publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation())
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	_, err = source.GetMenu(first, menu.URI)
	require.ErrorIs(t, err, ErrDenied, "policy revocation must not reuse a cached projection")
	_, err = source.GetMenu(otherSession, menu.URI)
	require.ErrorIs(t, err, ErrDenied, "shared projection content never grants another session access")
}
