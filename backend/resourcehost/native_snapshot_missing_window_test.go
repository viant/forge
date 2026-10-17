package resource

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	workspacewindow "github.com/viant/forge/backend/window/source"
)

func TestNativeSnapshotIsolatesMissingWindowImportAndReloadsRecovery(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	extensionWrite(t, root, "extension/forge/windows/healthy.yaml", "windowKey: healthy\nview: {content: {id: healthy}}\n")
	extensionWrite(t, root, "extension/forge/windows/broken.yaml", "windowKey: broken\nview:\n  content: $import(mutation-sources.yaml)\n")
	entries := []workspacewindow.ResourceBinding{{WindowKey: "healthy", URI: "window://workspace/healthy"}, {WindowKey: "broken", URI: "window://workspace/broken"}}
	definitions, err := SnapshotWindowDefinitions(ctx, root, entries, nil)
	require.NoError(t, err)
	_, err = NewNativeAssetSnapshot(ctx, root, definitions)
	require.ErrorIs(t, err, fs.ErrNotExist, "default compilation remains strict")
	snapshot, err := NewNativeAssetSnapshot(ctx, root, definitions, NativeSnapshotOptions{IsolateMissingWindowImports: true})
	require.NoError(t, err)
	diagnostic := snapshot.CompilationErrors()[entries[1].URI]
	require.ErrorIs(t, diagnostic, fs.ErrNotExist)
	require.ErrorIs(t, diagnostic, identity.ErrResourceDenied)
	require.Contains(t, diagnostic.Error(), "mutation-sources.yaml")
	healthy, _ := identity.ParseResourceURI(entries[0].URI)
	broken, _ := identity.ParseResourceURI(entries[1].URI)
	candidates, err := snapshot.Candidates(ctx, healthy)
	require.NoError(t, err)
	require.Len(t, candidates, 1)
	raw, err := snapshot.ReadCandidate(ctx, healthy, candidates[0])
	require.NoError(t, err)
	require.NoError(t, ValidateWindowBundle(2, raw))
	_, err = snapshot.Candidates(ctx, broken)
	require.ErrorIs(t, err, fs.ErrNotExist)
	rows, err := snapshot.WindowIndex(ctx)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	bindings, err := snapshot.Bindings("internal", extensionPolicy)
	require.NoError(t, err)
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://synthetic.invalid", TenantID: "fixture", AccountID: "account", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Minute)}
	provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "internal", Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return nil }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return nil }, Bindings: bindings, Validators: map[string]LocalResourceValidator{"window": ValidateWindowBundle}})
	require.NoError(t, err)
	listed, err := provider.List(ctx, "window", primitive.ListRequest{Namespace: "workspace"})
	require.NoError(t, err)
	require.Len(t, listed.Resources, 1)
	_, err = provider.Get(ctx, "window", primitive.GetRequest{URI: entries[1].URI})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	extensionWrite(t, root, "extension/forge/windows/mutation-sources.yaml", "id: repaired\n")
	_, err = snapshot.Candidates(ctx, broken)
	require.ErrorIs(t, err, fs.ErrNotExist, "repair is only visible after explicit reload")
	require.NoError(t, snapshot.Reload(ctx))
	require.Empty(t, snapshot.CompilationErrors())
	candidates, err = snapshot.Candidates(ctx, broken)
	require.NoError(t, err)
	raw, err = snapshot.ReadCandidate(ctx, broken, candidates[0])
	require.NoError(t, err)
	require.Contains(t, string(raw), "repaired")
	listed, err = provider.List(ctx, "window", primitive.ListRequest{Namespace: "workspace"})
	require.NoError(t, err)
	require.Len(t, listed.Resources, 2)
	// A later confinement violation is fatal and cannot replace the good snapshot.
	extensionWrite(t, root, "extension/forge/windows/broken.yaml", "windowKey: broken\nview:\n  content: $import(../../../../outside.yaml)\n")
	require.ErrorIs(t, snapshot.Reload(ctx), identity.ErrResourceDenied)
	_, err = snapshot.ReadCandidate(ctx, broken, candidates[0])
	require.NoError(t, err)
}

func TestNativeSnapshotMissingIsolationDoesNotMaskSecurityOrOtherKinds(t *testing.T) {
	f := &confinedWindowFS{}
	f.fail(fs.ErrNotExist)
	f.fail(identity.ErrResourceDenied)
	require.ErrorIs(t, f.failure, identity.ErrResourceDenied)
	root := t.TempDir()
	for _, kind := range []string{"window", "report"} {
		t.Run(kind, func(t *testing.T) {
			failure := fs.ErrNotExist
			if kind == "window" {
				failure = errors.Join(fs.ErrNotExist, identity.ErrResourceDenied)
			}
			_, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{{URI: kind + "://workspace/test", File: "extension/test.yaml", FormatVersion: 1, Load: func(context.Context, *ExtensionReader, string) (json.RawMessage, error) { return nil, failure }}}, NativeSnapshotOptions{IsolateMissingWindowImports: true})
			require.Error(t, err)
		})
	}
}
