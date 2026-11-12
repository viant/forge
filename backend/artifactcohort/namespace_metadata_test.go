package artifactcohort

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	"testing"
)

func TestNamespaceGuidanceSyncUsesExistingReplicaWithoutChangingArtifactHash(t *testing.T) {
	ctx := actorContext("alice", "operator")
	publisher := NewPublisher()
	artifact, _, err := publisher.Publish(ctx, RootRef{URI: "window://example/main", Kind: "window", Version: 1}, json.RawMessage(`{"title":"Example"}`), allowPublished)
	require.NoError(t, err)
	policies, cohorts := cohortFixture()
	cohorts[0].Roots = []RootRef{artifact.Root}
	_, err = publisher.ReplaceCatalog(ctx, policies, cohorts, publisher.Generation())
	require.NoError(t, err)
	tool := &namespaceReplicaTool{publisher: publisher, calls: map[string]int{}, description: "Initial guidance"}
	replica, err := NewReplica(Config{Enabled: true, Source: "producer", Tenant: "tenant", Account: "account", Caller: NamespaceCaller{Client: tool, Namespace: "example"}, Facts: &countedFacts{}, SessionKey: fixtureSession})
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	metadata, err := NewMetadataSource(replica, []string{"example"})
	require.NoError(t, err)
	key, err := metadata.AdmissionKey(ctx)
	require.NoError(t, err)
	require.NoError(t, replica.Sync(ctx))
	unchangedKey, err := metadata.AdmissionKey(ctx)
	require.NoError(t, err)
	require.Equal(t, key, unchangedKey, "unchanged synchronization must preserve prepared catalog identity")
	deniedRows, deniedErr := metadata.Namespaces(actorContext("visitor", "viewer"))
	if deniedErr == nil {
		for _, row := range deniedRows {
			require.Empty(t, row.Kinds)
			require.Empty(t, row.Description, "guidance must not expand admitted namespace metadata")
		}
	}
	hash := replica.KnownHash()
	discovers, fetches := tool.counts()
	for i := 0; i < 20; i++ {
		rows, err := metadata.Namespaces(ctx)
		require.NoError(t, err)
		require.Len(t, rows, 1)
		require.Equal(t, "Initial guidance", rows[0].Description)
	}
	d, f := tool.counts()
	require.Equal(t, discovers, d)
	require.Equal(t, fetches, f)
	tool.mu.Lock()
	tool.description = "Updated guidance"
	tool.mu.Unlock()
	require.NoError(t, replica.Sync(ctx))
	require.Equal(t, hash, replica.KnownHash())
	rows, err := metadata.Namespaces(ctx)
	require.NoError(t, err)
	require.Equal(t, "Updated guidance", rows[0].Description)
	changedKey, err := metadata.AdmissionKey(ctx)
	require.NoError(t, err)
	require.NotEqual(t, key, changedKey, "guidance changes must invalidate prepared namespace metadata")
	_, f = tool.counts()
	require.Equal(t, fetches, f, "metadata change must not download unchanged artifacts")
	manifest, err := publisher.Snapshot()
	require.NoError(t, err)
	manifest.NamespaceMetadata = map[string]primitive.NamespaceMetadata{"example": {Description: "Advisory"}}
	require.Equal(t, hash, ManifestHash(manifest))
	raw, err := json.Marshal(manifest)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "Advisory")
	tool.mu.Lock()
	tool.description = ""
	tool.mu.Unlock()
	require.NoError(t, replica.Sync(ctx))
	rows, err = metadata.Namespaces(ctx)
	require.NoError(t, err)
	require.Empty(t, rows[0].Description, "older producers may omit optional guidance")
}
