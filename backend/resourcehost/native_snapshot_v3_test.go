package resource

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

func TestFrozenNativeSnapshotValidatesVersionThreeReferencesAndKeepsStartupBytes(t *testing.T) {
	stack := newDependencyStack(t, time.Now().Add(time.Minute))
	root := t.TempDir()
	file := "extension/forge/windows/references.json"
	require.NoError(t, os.MkdirAll(filepath.Dir(filepath.Join(root, file)), 0700))
	raw := stack.parent.raw
	require.NoError(t, os.WriteFile(filepath.Join(root, file), raw, 0600))
	definition := NativeSnapshotDefinition{URI: "window://team/orders", Title: "Orders", FormatVersion: 3, File: file, Load: func(ctx context.Context, r *ExtensionReader, name string) (json.RawMessage, error) {
		return r.ReadFile(ctx, name)
	}}
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{definition}, NativeSnapshotOptions{})
	require.NoError(t, err)
	require.NoError(t, ValidateWindowBundle(3, raw))
	require.Error(t, ValidateWindowBundle(2, raw), "references cannot lie about format2")
	uri, _ := identity.ParseResourceURI(definition.URI)
	pins, err := snapshot.Candidates(context.Background(), uri)
	require.NoError(t, err)
	require.Len(t, pins, 1)
	got, err := snapshot.ReadCandidate(context.Background(), uri, pins[0])
	require.NoError(t, err)
	require.Equal(t, raw, got)
	require.NoError(t, os.WriteFile(filepath.Join(root, file), append(append([]byte(nil), raw...), byte(' ')), 0600))
	captured, err := snapshot.ReadCandidate(context.Background(), uri, pins[0])
	require.NoError(t, err)
	require.Equal(t, raw, captured)
	require.EqualValues(t, 1, snapshot.CompileCount())
}
