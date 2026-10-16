package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

func TestToolfeedSharesNativeStartupSnapshotWithoutWarmYAMLLoads(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "feeds/nested"), 0700))
	file := filepath.Join(root, "feeds/nested/media.yml")
	original := []byte("id: media-plan\nmatch: {service: synthetic, method: update}\ndataSource: {draft: {source: output}}\nui: {draftOnly: true}\n")
	require.NoError(t, os.WriteFile(file, original, 0600))
	ctx := context.Background()
	directory := ToolfeedDirectory("ownedfeeds", "feeds")
	var yamlLoads atomic.Int64
	directory.Load = func(ctx context.Context, reader *ExtensionReader, file string) (json.RawMessage, error) {
		yamlLoads.Add(1)
		return NativeToolfeedLoader(ctx, reader, file)
	}
	definitions, err := SnapshotToolfeedDefinitions(ctx, root, []ExtensionDirectory{directory})
	require.NoError(t, err)
	require.Len(t, definitions, 1)
	require.Equal(t, "feeds/nested/media.yml", definitions[0].File)
	require.Equal(t, "toolfeed://ownedfeeds/nested/media", definitions[0].URI)
	snapshot, err := NewNativeAssetSnapshot(ctx, root, definitions, NativeSnapshotOptions{})
	require.NoError(t, err)
	require.EqualValues(t, 1, snapshot.CompileCount())
	require.EqualValues(t, 1, yamlLoads.Load())
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "synthetic", TenantID: "team", AccountID: "account", IdentityRevision: "1", ValidUntil: time.Now().Add(time.Minute)}
	bindings, err := snapshot.Bindings("internal", extensionPolicy)
	require.NoError(t, err)
	var validations atomic.Int64
	provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "internal", Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: bindings, Validators: map[string]LocalResourceValidator{primitive.ToolfeedKind: func(version int64, raw json.RawMessage) error {
		validations.Add(1)
		return ValidateToolfeedDefinition(version, raw)
	}}})
	require.NoError(t, err)
	for i := 0; i < 5; i++ {
		got, err := provider.Get(ctx, primitive.ToolfeedKind, primitive.GetRequest{URI: definitions[0].URI})
		require.NoError(t, err)
		definition, err := primitive.DecodeToolfeedDefinition(1, got.Resource.Definition)
		require.NoError(t, err)
		require.Equal(t, "media-plan", definition.ID)
	}
	require.EqualValues(t, 1, yamlLoads.Load(), "warmGet must not read/redecode authoringYAML")
	require.EqualValues(t, 5, validations.Load(), "no newpurevalidator bypass")
	require.NoError(t, os.WriteFile(file, append(original, []byte("title: changed\n")...), 0600))
	got, err := provider.Get(ctx, primitive.ToolfeedKind, primitive.GetRequest{URI: definitions[0].URI})
	require.NoError(t, err)
	require.NotNil(t, got)
	require.EqualValues(t, 1, yamlLoads.Load(), "file edits never reload captured definitions")
	require.NoError(t, snapshot.Reload(ctx))
	require.EqualValues(t, 2, yamlLoads.Load())
}
func TestToolfeedSnapshotStrictStartupValidation(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "feeds"), 0700))
	require.NoError(t, os.WriteFile(filepath.Join(root, "feeds/bad.yaml"), []byte("id: private\nmatch: {}\nunauthenticatedGrant: true\n"), 0600))
	defs, err := SnapshotToolfeedDefinitions(context.Background(), root, []ExtensionDirectory{ToolfeedDirectory("owned", "feeds")})
	require.NoError(t, err)
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, defs, NativeSnapshotOptions{})
	require.Error(t, err)
	require.Nil(t, snapshot)
}
