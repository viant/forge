package resource

import (
	"context"
	"encoding/json"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/mcp"
	client "github.com/viant/mcp/client"
	cfg "github.com/viant/mcp/client/config"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
)

func TestNativeDocumentReadsUseOriginalActorAndCapturedBytes(t *testing.T) {
	root := t.TempDir()
	file := "control.txt"
	bytes := []byte("exact original\n$import(unchanged)\n")
	require.NoError(t, os.WriteFile(filepath.Join(root, file), bytes, 0600))
	var loads atomic.Int64
	uri := NativeDocumentURI(file)
	snapshot, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{{URI: uri, File: file, RawDocument: true, Load: func(ctx context.Context, r *ExtensionReader, _ string) (json.RawMessage, error) {
		loads.Add(1)
		raw, err := r.ReadFile(ctx, file)
		return raw, err
	}}}, NativeSnapshotOptions{})
	require.NoError(t, err)
	actor, verify := PublicReadActors()
	var denied atomic.Bool
	checked := func(ctx context.Context) (identity.VerifiedActor, error) {
		if denied.Load() {
			return identity.VerifiedActor{}, identity.ErrResourceDenied
		}
		return actor(ctx)
	}
	var primitiveAuthorizations atomic.Int64
	provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: "configured-owner", Actor: checked, Verify: verify, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error {
		primitiveAuthorizations.Add(1)
		return identity.ErrResourceDenied
	}, NativeResources: snapshot.NativeResourceDocuments()})
	require.NoError(t, err)
	mgr, err := manager.New(nil)
	require.NoError(t, err)
	require.NoError(t, mgr.RegisterLocal(context.Background(), "internal", &cfg.MCPClient{ClientOptions: &mcp.ClientOptions{}, PrimitiveProviderIdentity: provider.ProviderIdentity()}, func(context.Context) (client.Interface, error) { return NewLocalMCPClient(provider) }))
	t.Cleanup(func() { mgr.CloseConversation("") })
	gateway := NewGateway(mgr, checked, verify, "gateway")
	t.Cleanup(gateway.Close)
	for i := 0; i < 4; i++ {
		got, err := gateway.ReadNativeResource(context.Background(), "internal", provider.ProviderIdentity(), uri)
		require.NoError(t, err)
		require.Equal(t, bytes, got)
		got[0] = 'X'
	}
	require.Equal(t, int64(1), loads.Load(), "request reads must not reopen/parse original files")
	require.Zero(t, primitiveAuthorizations.Load(), "native document reads must not infer namespace permissions")
	_, err = gateway.ReadNativeResource(context.Background(), "internal", provider.ProviderIdentity(), NativeDocumentURI("unregistered.txt"))
	require.Error(t, err)
	_, err = gateway.ReadNativeResource(context.Background(), "internal", "foreign-owner", uri)
	require.Error(t, err)
	denied.Store(true)
	_, err = gateway.ReadNativeResource(context.Background(), "internal", provider.ProviderIdentity(), uri)
	require.Error(t, err)
	denied.Store(false)
	require.NoError(t, os.WriteFile(filepath.Join(root, file), []byte("changed original"), 0600))
	retained, err := gateway.ReadNativeResource(context.Background(), "internal", provider.ProviderIdentity(), uri)
	require.NoError(t, err)
	require.Equal(t, bytes, retained)
	require.EqualValues(t, 1, loads.Load())
	require.NoError(t, snapshot.Reload(context.Background()))
	refreshed, err := gateway.ReadNativeResource(context.Background(), "internal", provider.ProviderIdentity(), uri)
	require.NoError(t, err)
	require.Equal(t, []byte("changed original"), refreshed)
	require.EqualValues(t, 2, loads.Load())
}

func TestRawDocumentsCannotSkipPrimitiveValidation(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "window.json"), []byte("not a window"), 0600))
	_, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{{URI: "window://workspace/window", File: "window.json", FormatVersion: 2, RawDocument: true, Load: func(ctx context.Context, r *ExtensionReader, _ string) (json.RawMessage, error) {
		return r.ReadFile(ctx, "window.json")
	}}})
	require.Error(t, err)
}
