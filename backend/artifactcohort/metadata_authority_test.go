package artifactcohort

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/authz"
)

func TestMetadataAuthoritySurvivesUnchangedReconciliationAndFencesScopeChanges(t *testing.T) {
	ctx := actorContext("reader-session", "operator")
	publisher := NewPublisher()
	publish := func(version uint64, title string) RootRef {
		raw, _ := json.Marshal(map[string]any{"schemaVersion": 1, "title": title})
		item, _, err := publisher.Publish(ctx, RootRef{URI: "report://example/summary", Kind: "report", Version: version}, raw, allowPublished)
		require.NoError(t, err)
		return item.Root
	}
	root := publish(1, "Example")
	policies, cohorts := cohortFixture()
	named := authz.Resource{Kind: "policy", ID: "readers", Version: "logical", Tenant: "tenant"}
	policies = append(policies, authz.Document{Resource: named, Revision: 1, Policies: map[string]authz.Policy{authz.NamedDefinitionAction: {Mode: "definition", Definition: &authz.NamedDefinition{DisplayName: "Readers", Policies: map[string]authz.Policy{PolicyAction: {Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "operator"}}}}}}})
	policies[0].Policies[PolicyAction] = authz.Policy{Mode: "named", Named: &authz.NamedReference{Resource: named, Revision: 1}}
	cohorts[0].Roots = []RootRef{root}
	replace := func() {
		_, err := publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation())
		require.NoError(t, err)
	}
	replace()
	newSource := func(account string) (*Replica, *MetadataSource) {
		caller := &fakeCaller{publisher: publisher, fetches: map[string]int{}}
		replica, err := NewReplica(Config{Enabled: true, Source: "producer", Tenant: "tenant", Account: account, Caller: caller, Facts: &countedFacts{}, SessionKey: fixtureSession})
		require.NoError(t, err)
		require.NoError(t, replica.Sync(context.Background()))
		source, err := NewMetadataSource(replica, []string{"example"})
		require.NoError(t, err)
		return replica, source
	}
	replica, source := newSource("account")
	before, err := source.AuthorityKey(ctx, root.URI)
	require.NoError(t, err)
	readiness, err := source.AdmissionKey(ctx)
	require.NoError(t, err)
	replica.MarkDisconnected()
	_, err = source.AuthorityKey(ctx, root.URI)
	require.Error(t, err)
	_, err = source.Get(ctx, root.URI)
	require.Error(t, err)
	require.NoError(t, replica.Sync(ctx))
	after, err := source.AuthorityKey(ctx, root.URI)
	require.NoError(t, err)
	require.Equal(t, before, after)
	nextReadiness, err := source.AdmissionKey(ctx)
	require.NoError(t, err)
	require.NotEqual(t, readiness, nextReadiness, "readiness must still invalidate cached and in-flight projections")
	// A new release wrapper and unrelated roots do not change this resource's
	// effective policy or closed bytes.
	for _, kind := range []string{"report", "navigation"} {
		raw := json.RawMessage(`{"schemaVersion":1,"reportSpec":{"version":1,"kind":"reportSpec","title":"Other","datasets":[],"blocks":[]}}`)
		if kind == "navigation" {
			raw = json.RawMessage(`{"schemaVersion":1,"applications":[{"id":"other","menus":[{"id":"other","action":{"type":"report","resourceUri":"report://example/other"}}]}]}`)
		}
		extra, _, e := publisher.Publish(ctx, RootRef{URI: kind + "://example/other", Kind: kind, Version: 1}, raw, allowPublished)
		require.NoError(t, e)
		cohorts[0].Roots = append(cohorts[0].Roots, extra.Root)
	}
	policies[0].Revision++
	policies[0].Resource.ID = "new-release-wrapper"
	cohorts[0].Name = "new-release"
	cohorts[0].PolicyResource = policies[0].Resource
	replace()
	require.NoError(t, replica.Sync(ctx))
	after, err = source.AuthorityKey(ctx, root.URI)
	require.NoError(t, err)
	require.Equal(t, before, after)
	policies[1].Revision++ // A real named-policy head remains an authority input.
	replace()
	require.NoError(t, replica.Sync(ctx))
	after, err = source.AuthorityKey(ctx, root.URI)
	require.NoError(t, err)
	require.NotEqual(t, before, after)
	before = after
	otherActor, err := source.AuthorityKey(actorContext("another-session", "operator"), root.URI)
	require.NoError(t, err)
	require.NotEqual(t, before, otherActor)
	_, otherSource := newSource("another-account")
	otherAccount, err := otherSource.AuthorityKey(ctx, root.URI)
	require.NoError(t, err)
	require.NotEqual(t, before, otherAccount)
	cohorts[0].Roots = []RootRef{publish(2, "Changed")}
	replace()
	require.NoError(t, replica.Sync(ctx))
	changed, err := source.AuthorityKey(ctx, root.URI)
	require.NoError(t, err)
	require.NotEqual(t, before, changed)
	policies[0].Revision++
	policies[0].Policies[PolicyAction] = authz.Policy{Mode: "protected", Rule: &authz.Rule{Kind: "role", Value: "administrator"}}
	replace()
	require.NoError(t, replica.Sync(ctx))
	_, err = source.AuthorityKey(ctx, root.URI)
	require.ErrorIs(t, err, ErrDenied)
	_, err = source.Get(ctx, root.URI)
	require.ErrorIs(t, err, ErrDenied)
}
