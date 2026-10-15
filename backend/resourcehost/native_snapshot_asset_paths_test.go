// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

func configuredSnapshotDefinition() NativeSnapshotDefinition {
	return NativeSnapshotDefinition{URI: "window://studio/overview", Title: "Overview", FormatVersion: 2, File: "window.json", Load: func(ctx context.Context, reader *ExtensionReader, file string) (json.RawMessage, error) {
		raw, err := reader.ReadFile(ctx, file)
		if err != nil {
			return nil, err
		}
		var window types.Window
		if err := json.Unmarshal(raw, &window); err != nil {
			return nil, err
		}
		imported, err := reader.ReadFile(ctx, "shared/title.txt")
		if err != nil {
			return nil, err
		}
		window.View.Content.Title += string(imported)
		variant := types.WindowResourceVariant{Window: &window, DataSources: map[string]json.RawMessage{}}
		fingerprint, err := types.WindowVariantFingerprint(variant)
		if err != nil {
			return nil, err
		}
		return json.Marshal(types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Targets: []types.WindowTargetBinding{{Variant: fingerprint}}, Variants: map[string]types.WindowResourceVariant{fingerprint: variant}})
	}}
}

func configuredSnapshotRoot(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "window.json"), []byte(`{"view":{"content":{"id":"original","title":"Original"}}}`), 0600))
	require.NoError(t, os.Mkdir(filepath.Join(root, "shared"), 0700))
	require.NoError(t, os.WriteFile(filepath.Join(root, "shared/title.txt"), []byte("one"), 0600))
	return root
}

func TestFrozenNativeSnapshotConfiguredRootAssetAndTracedImport(t *testing.T) {
	for _, changed := range []string{"window.json", "shared/title.txt"} {
		t.Run(changed, func(t *testing.T) {
			ctx := context.Background()
			root := configuredSnapshotRoot(t)
			options := NativeSnapshotOptions{}
			snapshot, err := NewNativeAssetSnapshot(ctx, root, []NativeSnapshotDefinition{configuredSnapshotDefinition()}, options)
			require.NoError(t, err)
			uri, _ := identity.ParseResourceURI("window://studio/overview")
			candidates, err := snapshot.Candidates(ctx, uri)
			require.NoError(t, err)
			original, err := snapshot.ReadCandidate(ctx, uri, candidates[0])
			require.NoError(t, err)
			for i := 0; i < 5; i++ {
				_, err := snapshot.ReadCandidate(ctx, uri, candidates[0])
				require.NoError(t, err)
			}
			require.EqualValues(t, 1, snapshot.CompileCount())
			file := filepath.Join(root, changed)
			info, err := os.Stat(file)
			require.NoError(t, err)
			raw, err := os.ReadFile(file)
			require.NoError(t, err)
			if changed == "window.json" {
				raw = bytes.Replace(raw, []byte("Original"), []byte("Modified"), 1)
			} else {
				raw = []byte("two")
			}
			// Even same-size edits with preserved mtime cannot replace frozen bytes.
			require.NoError(t, os.WriteFile(file, raw, 0600))
			require.NoError(t, os.Chtimes(file, info.ModTime(), info.ModTime()))
			captured, readErr := snapshot.ReadCandidate(ctx, uri, candidates[0])
			require.NoError(t, readErr)
			require.Equal(t, original, captured)
			require.EqualValues(t, 1, snapshot.CompileCount(), "frozen snapshots never recompile after startup")
			fresh, err := NewNativeAssetSnapshot(ctx, root, []NativeSnapshotDefinition{configuredSnapshotDefinition()}, NativeSnapshotOptions{})
			require.NoError(t, err)
			current, err := fresh.Candidates(ctx, uri)
			require.NoError(t, err)
			require.NotEqual(t, candidates[0].ContentFingerprint, current[0].ContentFingerprint)
			_, err = fresh.ReadCandidate(ctx, uri, current[0])
			require.NoError(t, err)
		})
	}
}

func TestNativeSnapshotStartupLoaderRejectsEscapingAndLinkedPaths(t *testing.T) {
	for _, asset := range []string{"/absolute", "../escape", "shared/../window.json", "", ".", "shared//title.txt", "missing", "link.json", "linked/title.txt"} {
		t.Run(asset, func(t *testing.T) {
			root := configuredSnapshotRoot(t)
			require.NoError(t, os.Symlink("window.json", filepath.Join(root, "link.json")))
			require.NoError(t, os.Symlink("shared", filepath.Join(root, "linked")))
			definition := configuredSnapshotDefinition()
			definition.File = asset
			_, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{definition})
			require.Error(t, err)
		})
	}
}
