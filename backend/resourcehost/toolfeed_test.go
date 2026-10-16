package resource

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

func TestToolfeedInventoryRejectsInvalidDefinitionsAndOwnership(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	require.NoError(t, os.Mkdir(filepath.Join(root, "feeds"), 0700))
	file := filepath.Join(root, "feeds", "terminal.yaml")
	require.NoError(t, os.WriteFile(file, []byte("id: legacy-terminal\nmatch:\n  service: system/exec\n"), 0600))
	policy := func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) (identity.ResourceRevisionPolicy, error) {
		return nil, identity.ErrResourceDenied
	}
	_, err := ExtensionBindings(ctx, root, []ExtensionDirectory{ToolfeedDirectory("alice", "feeds"), ToolfeedDirectory("alice", "feeds")}, policy)
	require.Error(t, err)
	_, err = ExtensionBindings(ctx, root, []ExtensionDirectory{ToolfeedDirectory("../alice", "feeds")}, policy)
	require.Error(t, err)
	for _, body := range []string{"id: terminal\nfeedId: live-event\n", "id: x\nid: y\n", "id: x\n---\nid: y\n", "id: x\ndataSource:\n  result: 2\n"} {
		require.NoError(t, os.WriteFile(file, []byte(body), 0600))
		opened, err := os.OpenRoot(root)
		require.NoError(t, err)
		reader := &ExtensionReader{root: opened}
		_, err = NativeToolfeedLoader(ctx, reader, "feeds/terminal.yaml")
		reader.close()
		require.NoError(t, opened.Close())
		require.Error(t, err, body)
	}
	require.NoError(t, os.Symlink(file, filepath.Join(root, "feeds", "alias.yaml")))
	_, err = ExtensionBindings(ctx, root, []ExtensionDirectory{ToolfeedDirectory("alice", "feeds")}, policy)
	require.Error(t, err)
}
