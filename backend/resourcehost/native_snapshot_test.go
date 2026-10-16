package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	workspacewindow "github.com/viant/forge/backend/window/source"
)

func TestNativeSnapshotPreloadsAndExplicitlyReloadsChangedImportedAsset(t *testing.T) {
	root, entries := nativeWindowFixture(t)
	definitions, err := SnapshotWindowDefinitions(context.Background(), root, entries, nil)
	require.NoError(t, err)
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, definitions)
	require.NoError(t, err)
	require.EqualValues(t, 1, snapshot.CompileCount())
	uri, _ := identity.ParseResourceURI(entries[0].URI)
	candidates, err := snapshot.Candidates(context.Background(), uri)
	require.NoError(t, err)
	for i := 0; i < 5; i++ {
		raw, err := snapshot.ReadCandidate(context.Background(), uri, candidates[0])
		require.NoError(t, err)
		require.NoError(t, ValidateWindowBundle(2, raw))
	}
	require.EqualValues(t, 1, snapshot.CompileCount())
	imported := filepath.Join(root, "extension/forge/windows/campaign/detail/mobile/phone/main.js")
	info, err := os.Stat(imported)
	require.NoError(t, err)
	old, err := os.ReadFile(imported)
	require.NoError(t, err)
	changed := append([]byte(nil), old...)
	changed[0] = 'X'
	require.NoError(t, os.WriteFile(imported, changed, 0600))
	require.NoError(t, os.Chtimes(imported, info.ModTime(), info.ModTime()))
	captured, err := snapshot.ReadCandidate(context.Background(), uri, candidates[0])
	require.NoError(t, err)
	require.Contains(t, string(captured), string(old))
	require.EqualValues(t, 1, snapshot.CompileCount())
	require.NoError(t, snapshot.Reload(context.Background()))
	raw, err := snapshot.ReadCandidate(context.Background(), uri, candidates[0])
	require.ErrorIs(t, err, identity.ErrResourceStale)
	require.Nil(t, raw)
	require.EqualValues(t, 2, snapshot.CompileCount())
	fresh, err := snapshot.Candidates(context.Background(), uri)
	require.NoError(t, err)
	require.NotEqual(t, candidates[0].ContentFingerprint, fresh[0].ContentFingerprint)
	raw, err = snapshot.ReadCandidate(context.Background(), uri, fresh[0])
	require.NoError(t, err)
	selected, err := types.SelectWindowResource(raw, &types.WindowTarget{Platform: "ios", FormFactor: "phone"})
	require.NoError(t, err)
	require.Equal(t, string(changed), selected.Window.Actions.Code)
}
func TestNativeSnapshotNewTargetDirectoryAndRootReplacement(t *testing.T) {
	for _, scenario := range []string{"new-target", "root-replacement", "symlink"} {
		t.Run(scenario, func(t *testing.T) {
			root, entries := nativeWindowFixture(t)
			definitions, err := SnapshotWindowDefinitions(context.Background(), root, entries, nil)
			require.NoError(t, err)
			snapshot, err := NewNativeAssetSnapshot(context.Background(), root, definitions)
			require.NoError(t, err)
			uri, _ := identity.ParseResourceURI(entries[0].URI)
			candidate, err := snapshot.Candidates(context.Background(), uri)
			require.NoError(t, err)
			switch scenario {
			case "new-target":
				extensionWrite(t, root, "extension/forge/windows/campaign/detail/android/phone/main.yaml", "windowKey: campaign/detail\nview:\n  content: {id: newAndroid}\n")
				raw, err := snapshot.ReadCandidate(context.Background(), uri, candidate[0])
				require.NoError(t, err)
				require.NotContains(t, string(raw), "newAndroid")
				require.NoError(t, snapshot.Reload(context.Background()))
				_, err = snapshot.ReadCandidate(context.Background(), uri, candidate[0])
				require.ErrorIs(t, err, identity.ErrResourceStale)
			case "root-replacement":
				moved := root + "-old"
				require.NoError(t, os.Rename(root, moved))
				defer os.RemoveAll(moved)
				extensionWrite(t, root, "extension/forge/windows/campaign/detail/main.yaml", "view:\n  content: {id: replaced}\n")
				retained, err := snapshot.Candidates(context.Background(), uri)
				require.NoError(t, err)
				require.Equal(t, candidate, retained)
				require.ErrorIs(t, snapshot.Reload(context.Background()), identity.ErrResourceStale)
			case "symlink":
				file := filepath.Join(root, "extension/forge/windows/campaign/detail/mobile/phone/main.js")
				require.NoError(t, os.Remove(file))
				require.NoError(t, os.Symlink("../../main.js", file))
				retained, err := snapshot.Candidates(context.Background(), uri)
				require.NoError(t, err)
				require.Equal(t, candidate, retained)
				require.ErrorIs(t, snapshot.Reload(context.Background()), identity.ErrResourceDenied)
			}
		})
	}
}
func TestNativeSnapshotNeverCachesAuthorizationOrCustomValidation(t *testing.T) {
	ctx := context.Background()
	root, entries := nativeWindowFixture(t)
	definitions, err := SnapshotWindowDefinitions(ctx, root, entries, nil)
	require.NoError(t, err)
	snapshot, err := NewNativeAssetSnapshot(ctx, root, definitions)
	require.NoError(t, err)
	bindings, err := snapshot.Bindings("internal", extensionPolicy)
	require.NoError(t, err)
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://synthetic.invalid", TenantID: "fixture", AccountID: "account", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Minute)}
	var denied atomic.Bool
	var validations atomic.Int64
	provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "internal", Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error {
		if denied.Load() {
			return identity.ErrResourceDenied
		}
		return nil
	}, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error {
		if denied.Load() {
			return identity.ErrResourceDenied
		}
		return nil
	}, Bindings: bindings, Validators: map[string]LocalResourceValidator{"window": func(version int64, raw json.RawMessage) error {
		validations.Add(1)
		return ValidateWindowBundle(version, raw)
	}}})
	require.NoError(t, err)
	got, err := provider.Get(ctx, "window", primitive.GetRequest{URI: entries[0].URI})
	require.NoError(t, err)
	require.Equal(t, "internal", got.ResolvedResource.ProviderIdentity)
	require.EqualValues(t, 1, validations.Load())
	_, err = provider.Get(ctx, "window", primitive.GetRequest{URI: entries[0].URI})
	require.NoError(t, err)
	require.EqualValues(t, 2, validations.Load())
	require.EqualValues(t, 1, snapshot.CompileCount())
	denied.Store(true)
	got, err = provider.Get(ctx, "window", primitive.GetRequest{URI: entries[0].URI})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Nil(t, got)
	require.EqualValues(t, 1, snapshot.CompileCount())
}
func TestNativeSnapshotPreparesStaticEnrichmentOnlyOnCaptureAndReload(t *testing.T) {
	root, entries := nativeWindowFixture(t)
	definitions, err := SnapshotWindowDefinitions(context.Background(), root, []workspacewindow.ResourceBinding{entries[0]}, nil)
	require.NoError(t, err)
	calls := 0
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, definitions, NativeSnapshotOptions{BeforeCompile: func(context.Context, *ExtensionReader) error { calls++; return nil }})
	require.NoError(t, err)
	require.Equal(t, 1, calls)
	extensionWrite(t, root, "extension/forge/reporting/new.yaml", "kind: test\n")
	uri, _ := identity.ParseResourceURI(entries[0].URI)
	_, err = snapshot.Candidates(context.Background(), uri)
	require.NoError(t, err)
	require.Equal(t, 1, calls)
	require.NoError(t, snapshot.Reload(context.Background()))
	require.Equal(t, 2, calls)
}

func TestNativeSnapshotTracksFirstOutsideDependencyAndIgnoresUnrelatedRootEntries(t *testing.T) {
	root, entries := nativeWindowFixture(t)
	extensionWrite(t, root, "imports/body.json", `{"schemaVersion":1,"reportDocument":{"title":"First"},"reportSpec":{"title":"First"}}`)
	file := filepath.Join(root, "imports/body.json")
	changeDuringLoad := true
	definition := NativeSnapshotDefinition{URI: "report://steward/imported", Title: "Imported", FormatVersion: 1, File: "imports/body.json", Load: func(ctx context.Context, reader *ExtensionReader, name string) (json.RawMessage, error) {
		raw, err := reader.ReadFile(ctx, name)
		if err != nil {
			return nil, err
		}
		if changeDuringLoad {
			extensionWrite(t, root, name, `{"schemaVersion":1,"reportDocument":{"title":"Second"},"reportSpec":{"title":"Second"}}`)
			_, err = reader.ReadFile(ctx, name)
			require.ErrorIs(t, err, identity.ErrResourceStale)
			return raw, err
		}
		return raw, nil
	}}
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{definition})
	require.ErrorIs(t, err, identity.ErrResourceStale)
	require.Nil(t, snapshot)
	changeDuringLoad = false
	snapshot, err = NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{definition})
	require.NoError(t, err)
	uri, _ := identity.ParseResourceURI(definition.URI)
	candidate, err := snapshot.Candidates(context.Background(), uri)
	require.NoError(t, err)
	compiles := snapshot.CompileCount()
	extensionWrite(t, root, "unrelated.log", "unrelated workspace output")
	_, err = snapshot.ReadCandidate(context.Background(), uri, candidate[0])
	require.NoError(t, err)
	require.Equal(t, compiles, snapshot.CompileCount())
	info, err := os.Stat(file)
	require.NoError(t, err)
	extensionWrite(t, root, "imports/body.json", `{"schemaVersion":1,"reportDocument":{"title":"Third!"},"reportSpec":{"title":"Third!"}}`)
	require.NoError(t, os.Chtimes(file, info.ModTime(), info.ModTime()))
	_, err = snapshot.ReadCandidate(context.Background(), uri, candidate[0])
	require.NoError(t, err)
	require.Equal(t, compiles, snapshot.CompileCount())
	require.NoError(t, snapshot.Reload(context.Background()))
	_, err = snapshot.ReadCandidate(context.Background(), uri, candidate[0])
	require.ErrorIs(t, err, identity.ErrResourceStale)
	_ = entries
}
func TestNativeSnapshotCompilationDropsCallerValues(t *testing.T) {
	root, _ := nativeWindowFixture(t)
	const file = "extension/forge/reporting/definition.json"
	extensionWrite(t, root, file, `{"schemaVersion":1,"reportDocument":{"title":"Static"},"reportSpec":{"title":"Static"}}`)
	type actorKey struct{}
	definition := NativeSnapshotDefinition{URI: "report://steward/static", Title: "Static", FormatVersion: 1, File: file, Load: func(ctx context.Context, reader *ExtensionReader, name string) (json.RawMessage, error) {
		require.Nil(t, ctx.Value(actorKey{}))
		return reader.ReadFile(ctx, name)
	}}
	snapshot, err := NewNativeAssetSnapshot(context.WithValue(context.Background(), actorKey{}, "caller-secret"), root, []NativeSnapshotDefinition{definition})
	require.NoError(t, err)
	extensionWrite(t, root, file, `{"schemaVersion":1,"reportDocument":{"title":"Updated"},"reportSpec":{"title":"Updated"}}`)
	uri, _ := identity.ParseResourceURI(definition.URI)
	_, err = snapshot.Candidates(context.WithValue(context.Background(), actorKey{}, "other-actor"), uri)
	require.NoError(t, err)
}

func TestNativeSnapshotRechecksContentAfterAuthorizationCallback(t *testing.T) {
	root, entries := nativeWindowFixture(t)
	defs, err := SnapshotWindowDefinitions(context.Background(), root, entries, nil)
	require.NoError(t, err)
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, defs)
	require.NoError(t, err)
	bindings, err := snapshot.Bindings("internal", extensionPolicy)
	require.NoError(t, err)
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://synthetic.invalid", TenantID: "fixture", AccountID: "account", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Minute)}
	calls := 0
	provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "internal", Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error {
		calls++
		if calls == 2 {
			extensionWrite(t, root, "extension/forge/windows/campaign/detail/mobile/phone/main.js", "changedAfterRead()")
			if err := snapshot.Reload(context.Background()); err != nil {
				return err
			}
		}
		return nil
	}, Bindings: bindings, Validators: map[string]LocalResourceValidator{"window": ValidateWindowBundle}})
	require.NoError(t, err)
	got, err := provider.Get(context.Background(), "window", primitive.GetRequest{URI: entries[0].URI})
	require.ErrorIs(t, err, identity.ErrResourceStale)
	require.Nil(t, got)
	require.EqualValues(t, 2, snapshot.CompileCount())
}

func TestNativeSnapshotFrozenHostConfigurationKeepsStartupContentUntilRestart(t *testing.T) {
	root, entries := nativeWindowFixture(t)
	defs, err := SnapshotWindowDefinitions(context.Background(), root, entries, nil)
	require.NoError(t, err)
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, defs, NativeSnapshotOptions{})
	require.NoError(t, err)
	uri, _ := identity.ParseResourceURI(entries[0].URI)
	candidates, err := snapshot.Candidates(context.Background(), uri)
	require.NoError(t, err)
	original, err := snapshot.ReadCandidate(context.Background(), uri, candidates[0])
	require.NoError(t, err)
	extensionWrite(t, root, "extension/forge/windows/campaign/detail/main.js", "changedAfterStartup()")
	current, err := snapshot.Candidates(context.Background(), uri)
	require.NoError(t, err)
	require.Equal(t, candidates, current)
	captured, err := snapshot.ReadCandidate(context.Background(), uri, candidates[0])
	require.NoError(t, err)
	require.Equal(t, original, captured)
	require.EqualValues(t, 1, snapshot.CompileCount())
	restarted, err := NewNativeAssetSnapshot(context.Background(), root, defs, NativeSnapshotOptions{})
	require.NoError(t, err)
	refreshed, err := restarted.Candidates(context.Background(), uri)
	require.NoError(t, err)
	require.NotEqual(t, candidates[0].ContentFingerprint, refreshed[0].ContentFingerprint)
	_, err = restarted.ReadCandidate(context.Background(), uri, candidates[0])
	require.ErrorIs(t, err, identity.ErrResourceStale)
}

func TestNativeSnapshotWindowIndexUsesOnlyImmutableMetadata(t *testing.T) {
	root, _ := nativeWindowFixture(t)
	raw := localWindowBytes(t)
	var loads atomic.Int64
	definitions := make([]NativeSnapshotDefinition, 20)
	for i := range definitions {
		definitions[i] = NativeSnapshotDefinition{URI: fmt.Sprintf("window://platform/window%d", i), Title: fmt.Sprintf("Window %d", i), FormatVersion: 2, File: "extension/forge/windows/campaign/detail/main.yaml", Load: func(context.Context, *ExtensionReader, string) (json.RawMessage, error) {
			loads.Add(1)
			return raw, nil
		}}
	}
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, definitions)
	require.NoError(t, err)
	require.EqualValues(t, 20, loads.Load())
	for i := 0; i < 3; i++ {
		rows, err := snapshot.WindowIndex(context.Background())
		require.NoError(t, err)
		require.Len(t, rows, 20)
		for _, row := range rows {
			require.Empty(t, row.Definition)
			require.Empty(t, row.DefinitionBytes)
			require.Equal(t, "platform", row.Namespace)
			require.Equal(t, identity.WorkingCandidate, row.Revision)
		}
	}
	require.EqualValues(t, 20, loads.Load())
	require.EqualValues(t, 20, snapshot.CompileCount())
}
