package artifactcohort

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/viant/authz"
)

func TestMetadataGenerationUsesLocalAdmissionAndPartitionFences(t *testing.T) {
	ctx := actorContext("alice", "operator")
	publisher := NewPublisher()
	root, _, err := publisher.Publish(ctx, RootRef{URI: "mcp://example/data", Kind: "mcp", Version: 1}, json.RawMessage(`{"name":"data"}`), allowPublished)
	require.NoError(t, err)
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{{URI: root.Root.URI, Kind: root.Root.Kind}}
	_, err = publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation())
	require.NoError(t, err)
	caller := &fakeCaller{publisher: publisher, fetches: map[string]int{}}
	facts := &countedFacts{}
	replica, err := NewReplica(Config{Enabled: true, Source: "publisher", Tenant: "tenant", Account: "account", Caller: caller, Facts: facts, SessionKey: fixtureSession})
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	source, err := NewMetadataSource(replica, []string{"example"})
	require.NoError(t, err)
	first, err := source.MetadataGeneration(ctx, "mcp")
	require.NoError(t, err)
	roleCalls := facts.calls.Load()
	for i := 0; i < 20; i++ {
		same, err := source.MetadataGeneration(ctx, "mcp")
		require.NoError(t, err)
		require.Equal(t, first, same)
	}
	require.Equal(t, roleCalls, facts.calls.Load())
	require.Equal(t, 1, caller.discovers)
	require.NoError(t, replica.MarkUpdated(root.Root.URI))
	_, err = source.MetadataGeneration(ctx, "mcp")
	require.ErrorIs(t, err, ErrUnavailable)
	require.Equal(t, roleCalls, facts.calls.Load())
	// A notification on the MCP partition does not invalidate an unrelated kind's
	// local partition fence before its manifest changes.
	_, err = source.MetadataGeneration(ctx, "prompt")
	require.NoError(t, err)
	next, _, err := publisher.Publish(ctx, RootRef{URI: root.Root.URI, Kind: root.Root.Kind, Version: 2}, json.RawMessage(`{"name":"changed"}`), allowPublished)
	require.NoError(t, err)
	require.NotEqual(t, root.Root.Hash, next.Root.Hash)
	require.NoError(t, replica.Sync(ctx))
	changed, err := source.MetadataGeneration(ctx, "mcp")
	require.NoError(t, err)
	require.NotEqual(t, first, changed)
	require.Equal(t, roleCalls, facts.calls.Load())
	replica.mu.Lock()
	held := replica.admissions["alice"]
	held.validUntil = time.Now().Add(-time.Second)
	replica.admissions["alice"] = held
	replica.mu.Unlock()
	expired := context.WithValue(ctx, replicaActorKey{}, authz.Facts{Subject: "alice", Tenant: "tenant", Issuer: "verified", Roles: []string{"operator"}, ValidUntil: time.Now().Add(-time.Second)})
	_, err = source.MetadataGeneration(expired, "mcp")
	require.Error(t, err)
}
