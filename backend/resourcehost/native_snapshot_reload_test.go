// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
)

func TestNativeSnapshotReloadPublishesAtomicallyAndKeepsPriorGenerationOnFailure(t *testing.T) {
	ctx := context.Background()
	root := configuredSnapshotRoot(t)
	definition := configuredSnapshotDefinition()
	load := definition.Load
	var calls atomic.Int64
	var block atomic.Bool
	started, release := make(chan struct{}, 1), make(chan struct{})
	definition.Load = func(ctx context.Context, r *ExtensionReader, name string) (json.RawMessage, error) {
		calls.Add(1)
		raw, err := load(ctx, r, name)
		if err != nil {
			return nil, err
		}
		if block.Load() {
			started <- struct{}{}
			select {
			case <-release:
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
		return raw, nil
	}
	snapshot, err := NewNativeAssetSnapshot(ctx, root, []NativeSnapshotDefinition{definition})
	require.NoError(t, err)
	uri, _ := identity.ParseResourceURI(definition.URI)
	original, err := snapshot.Candidates(ctx, uri)
	require.NoError(t, err)
	raw, err := snapshot.ReadCandidate(ctx, uri, original[0])
	require.NoError(t, err)
	file := filepath.Join(root, "window.json")
	input, err := os.ReadFile(file)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(file, bytes.Replace(input, []byte("Original"), []byte("Updated"), 1), 0600))
	block.Store(true)
	done := make(chan error, 1)
	go func() { done <- snapshot.Reload(ctx) }()
	<-started
	warmCalls := calls.Load()
	for i := 0; i < 100; i++ {
		held, err := snapshot.Candidates(ctx, uri)
		require.NoError(t, err)
		require.Equal(t, original, held)
		captured, err := snapshot.ReadCandidate(ctx, uri, original[0])
		require.NoError(t, err)
		require.Equal(t, raw, captured)
	}
	require.Equal(t, warmCalls, calls.Load(), "warm reads never invoke materialization")
	close(release)
	require.NoError(t, <-done)
	block.Store(false)
	current, err := snapshot.Candidates(ctx, uri)
	require.NoError(t, err)
	require.NotEqual(t, original, current)
	_, err = snapshot.ReadCandidate(ctx, uri, original[0])
	require.ErrorIs(t, err, identity.ErrResourceStale)
	updated, err := snapshot.ReadCandidate(ctx, uri, current[0])
	require.NoError(t, err)
	require.Contains(t, string(updated), "Updated")
	require.NoError(t, os.WriteFile(file, []byte("not-json"), 0600))
	require.Error(t, snapshot.Reload(ctx))
	retained, err := snapshot.ReadCandidate(ctx, uri, current[0])
	require.NoError(t, err)
	require.Equal(t, updated, retained)
	require.NoError(t, os.WriteFile(file, input, 0600))
	block.Store(true)
	release = make(chan struct{})
	canceled, cancel := context.WithCancel(ctx)
	go func() { done <- snapshot.Reload(canceled) }()
	<-started
	cancel()
	require.ErrorIs(t, <-done, context.Canceled)
	retained, err = snapshot.ReadCandidate(ctx, uri, current[0])
	require.NoError(t, err)
	require.Equal(t, updated, retained)
}

func TestNativeSnapshotReadsCapturedBytesAfterRootDeletionWithoutFilesystemAccess(t *testing.T) {
	ctx := context.Background()
	root := configuredSnapshotRoot(t)
	var loads atomic.Int64
	definition := configuredSnapshotDefinition()
	load := definition.Load
	definition.Load = func(ctx context.Context, r *ExtensionReader, file string) (json.RawMessage, error) {
		loads.Add(1)
		return load(ctx, r, file)
	}
	snapshot, err := NewNativeAssetSnapshot(ctx, root, []NativeSnapshotDefinition{definition})
	require.NoError(t, err)
	uri, _ := identity.ParseResourceURI(definition.URI)
	candidate, err := snapshot.Candidates(ctx, uri)
	require.NoError(t, err)
	original, err := snapshot.ReadCandidate(ctx, uri, candidate[0])
	require.NoError(t, err)
	require.NoError(t, os.RemoveAll(root))
	for i := 0; i < 10; i++ {
		raw, err := snapshot.ReadCandidate(ctx, uri, candidate[0])
		require.NoError(t, err)
		require.Equal(t, original, raw)
		require.NoError(t, snapshot.CheckCandidate(ctx, uri, candidate[0]))
		_, err = snapshot.WindowIndex(ctx)
		require.NoError(t, err)
	}
	require.EqualValues(t, 1, loads.Load())
	require.EqualValues(t, 1, snapshot.CompileCount())
	require.Error(t, snapshot.Reload(ctx), "explicit materialization still validates and reads its confined source")
	raw, err := snapshot.ReadCandidate(ctx, uri, candidate[0])
	require.NoError(t, err)
	require.Equal(t, original, raw)
	foreign := candidate[0]
	foreign.ContentFingerprint = identity.ContentFingerprint([]byte("foreign"))
	_, err = snapshot.ReadCandidate(ctx, uri, foreign)
	require.ErrorIs(t, err, identity.ErrResourceStale)
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	_, err = snapshot.ReadCandidate(canceled, uri, candidate[0])
	require.ErrorIs(t, err, identity.ErrResourceDenied)
}
