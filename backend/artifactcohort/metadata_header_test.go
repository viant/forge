package artifactcohort

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestSkillDiscoveryHeadersUseClosedPayloadWithoutRemoteReads(t *testing.T) {
	ctx := actorContext("reader", "operator")
	publisher := NewPublisher()
	roots := []RootRef{}
	doc := "---\nname: guide\ndescription: Review synthetic entries\n---\nRead supporting notes."
	for _, format := range []string{"text", "bytes"} {
		payload := map[string]any{"schemaVersion": 1, "document": doc}
		if format == "bytes" {
			payload = map[string]any{"document": []byte(doc)}
		}
		raw, err := json.Marshal(payload)
		require.NoError(t, err)
		value, _, err := publisher.Publish(ctx, RootRef{URI: "skill://example/" + format + "/guide", Kind: "skill", Version: 1}, raw, allowPublished)
		require.NoError(t, err)
		roots = append(roots, value.Root)
	}
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = roots
	_, err := publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation())
	require.NoError(t, err)
	caller := &fakeCaller{publisher: publisher, fetches: map[string]int{}}
	replica, err := NewReplica(Config{Enabled: true, Source: "producer", Tenant: "tenant", Account: "account", Caller: caller, Facts: &countedFacts{}, SessionKey: fixtureSession})
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	source, err := NewMetadataSource(replica, []string{"example"})
	require.NoError(t, err)
	for i := 0; i < 5; i++ {
		rows, err := source.List(ctx, "skill", "example")
		require.NoError(t, err)
		require.Len(t, rows, 2)
		require.NotEqual(t, rows[0].URI, rows[1].URI)
		for _, row := range rows {
			require.Equal(t, "guide", row.Title)
			require.Equal(t, "Review synthetic entries", row.Description)
		}
	}
	require.Equal(t, 1, caller.discovers)
	for _, count := range caller.fetches {
		require.Equal(t, 1, count)
	}
	rows, err := source.List(actorContext("viewer", "viewer"), "skill", "example")
	require.ErrorIs(t, err, ErrDenied)
	require.Empty(t, rows)
}
func TestHeaderCacheSeparatesKindsAndHashes(t *testing.T) {
	source := &MetadataSource{}
	raw := []byte(`{"schemaVersion":1,"document":"---\nname: guide\ndescription: First\n---\nBody"}`)
	report, err := source.decodeHeader("report", Hash(raw), raw)
	require.NoError(t, err)
	require.Empty(t, report.Description)
	skill, err := source.decodeHeader("skill", Hash(raw), raw)
	require.NoError(t, err)
	require.Equal(t, "First", skill.Description)
	next := []byte(`{"schemaVersion":1,"document":"---\nname: guide\ndescription: Changed\n---\nBody"}`)
	skill, err = source.decodeHeader("skill", Hash(next), next)
	require.NoError(t, err)
	require.Equal(t, "Changed", skill.Description)
	profile, err := source.decodeHeader("playbook", "profile", []byte(`{"schemaVersion":1,"profile":{"name":"review","description":"Profile guidance"}}`))
	require.NoError(t, err)
	require.Equal(t, "review", profile.Name)
	require.Equal(t, "Profile guidance", profile.Description)
}

func TestStandaloneHeaderProjectorPreservesPayloadAndReturnsValueCopies(t *testing.T) {
	projector := new(HeaderProjector)
	raw := json.RawMessage(`{"schemaVersion":1,"mimeType":"application/json","document":"---\nname: guide\ndescription: Shared guide\n---\nBody"}`)
	original := append([]byte(nil), raw...)
	header, err := projector.Project("skill", raw)
	require.NoError(t, err)
	require.Equal(t, "guide", header.DisplayTitle("fallback"))
	require.Equal(t, "Shared guide", header.Description)
	require.Equal(t, "application/json", header.MimeType)
	cached, ok := projector.Cached("skill", Hash(raw))
	require.True(t, ok)
	require.Equal(t, header, cached)
	header.Description = "caller mutation"
	again, err := projector.Project("skill", raw)
	require.NoError(t, err)
	require.Equal(t, "Shared guide", again.Description)
	require.Equal(t, original, []byte(raw), "projection must not rewrite immutable bytes")
	next, err := projector.Project("skill", json.RawMessage(`{"schemaVersion":1,"document":"---\nname: guide\ndescription: Updated guide\n---\nBody"}`))
	require.NoError(t, err)
	require.Equal(t, "Updated guide", next.Description)
	require.Empty(t, next.MimeType, "caller retains the original MIME default when none is declared")
}
