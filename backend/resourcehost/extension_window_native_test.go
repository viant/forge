package resource

import (
	"context"
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	workspacewindow "github.com/viant/forge/backend/window/source"
)

func nativeWindowFixture(t *testing.T) (string, []workspacewindow.ResourceBinding) {
	root := t.TempDir()
	base := "extension/forge/windows/campaign/detail"
	extensionWrite(t, root, base+".yaml", `$import(detail/shared/main.yaml)`)
	// Singleton aliases resolve relative to their containing folder.
	extensionWrite(t, root, base+"/main.yaml", `$import(shared/main.yaml)`)
	extensionWrite(t, root, base+"/shared/main.yaml", `windowKey: campaign/detail
dataSource:
  items:
    cardinality: collection
    selectors: {data: data}
    parameters:
      - {name: region, from: windowForm, to: metrics, default: authored}
view:
  content: '$import(content.yaml:card, {"rootID":"desktopRoot","class":"native-import"})'
`)
	extensionWrite(t, root, base+"/shared/content.yaml", `card:
  id: $param(rootID)
  className: $param(class)
  dataSourceRef: items
`)
	for _, item := range []struct{ branch, id string }{{"web", "webRoot"}, {"mobile/phone", "phoneRoot"}, {"mobile/tablet", "tabletRoot"}} {
		prefix := "../"
		if item.branch != "web" {
			prefix = "../../"
		}
		extensionWrite(t, root, base+"/"+item.branch+"/main.yaml", "$import("+prefix+"shared/main.yaml)")
		extensionWrite(t, root, base+"/"+item.branch+"/content.yaml", "card:\n  id: "+item.id+"\n  className: $param(class)\n  dataSourceRef: items\n")
		extensionWrite(t, root, base+"/"+item.branch+"/main.js", item.id+"Action()")
	}
	extensionWrite(t, root, base+"/main.js", "desktopAction()")
	extensionWrite(t, root, "extension/forge/datasources/items.yaml", `id: items
cardinality: collection
parameters:
  - {name: region, from: windowForm, to: metrics, default: global}
selectors: {data: data}
backend: {kind: inline, rows: [{value: trusted}]}
cache: {enabled: false}
`)
	return root, []workspacewindow.ResourceBinding{{WindowKey: "campaign/detail", URI: "window://platform/campaign/detail"}}
}
func TestConfinedNativeWindowImportsTargetsAndStaleBytes(t *testing.T) {
	root, entries := nativeWindowFixture(t)
	ctx := context.Background()
	bindings, err := ConfinedWindowBindings(ctx, root, entries, extensionPolicy, nil)
	require.NoError(t, err)
	actor := identity.VerifiedActor{ValidUntil: time.Now().Add(time.Minute)}
	resolver, err := bindings[0].Resolver(ctx, actor, "resource.get")
	require.NoError(t, err)
	pin, err := resolver.Resolve(ctx, identity.ResourceRef{URI: entries[0].URI})
	require.NoError(t, err)
	raw, _, err := resolver.ReadResolved(ctx, *pin)
	require.NoError(t, err)
	require.NoError(t, ValidateWindowBundle(2, raw))
	for _, item := range []struct {
		target     *types.WindowTarget
		id, script string
	}{{nil, "desktopRoot", "desktopAction()"}, {&types.WindowTarget{Platform: "web"}, "webRoot", "webRootAction()"}, {&types.WindowTarget{Platform: "ios", FormFactor: "phone"}, "phoneRoot", "phoneRootAction()"}, {&types.WindowTarget{Platform: "android", FormFactor: "tablet"}, "tabletRoot", "tabletRootAction()"}} {
		selected, err := types.SelectWindowResource(raw, item.target)
		require.NoError(t, err)
		require.Equal(t, item.id, selected.Window.View.Content.ID)
		require.Equal(t, "native-import", selected.Window.View.Content.ClassName)
		require.Equal(t, item.script, selected.Window.Actions.Code)
		var ds dsproto.DataSource
		require.NoError(t, json.Unmarshal(selected.DataSources["items"], &ds))
		require.Equal(t, "authored", ds.Parameters[0].Default)
		require.NotNil(t, ds.Backend)
		require.Equal(t, dsproto.BackendInline, ds.Backend.Kind)
	}
	extensionWrite(t, root, "extension/forge/windows/campaign/detail/mobile/phone/main.js", "changedAction()")
	_, _, err = resolver.ReadResolved(ctx, *pin)
	require.ErrorIs(t, err, identity.ErrResourceStale)
}
func TestConfinedNativeWindowDeniesUnsafeAndMissingImports(t *testing.T) {
	for _, test := range []string{"missing", "remote", "escape", "symlink"} {
		t.Run(test, func(t *testing.T) {
			root, entries := nativeWindowFixture(t)
			imported := "missing.yaml"
			switch test {
			case "remote":
				imported = "https://example.invalid/main.yaml"
			case "escape":
				imported = "../../../../../../outside.yaml"
			case "symlink":
				imported = "linked.yaml"
				require.NoError(t, os.Symlink("content.yaml", filepath.Join(root, "extension/forge/windows/campaign/detail/shared/linked.yaml")))
			}
			extensionWrite(t, root, "extension/forge/windows/campaign/detail/shared/main.yaml", "view:\n  content: $import("+imported+")\n")
			bindings, err := ConfinedWindowBindings(context.Background(), root, entries, extensionPolicy, nil)
			require.NoError(t, err)
			resolver, err := bindings[0].Resolver(context.Background(), identity.VerifiedActor{ValidUntil: time.Now().Add(time.Minute)}, "resource.get")
			require.NoError(t, err)
			pin, err := resolver.Resolve(context.Background(), identity.ResourceRef{URI: entries[0].URI})
			require.Error(t, err)
			require.Nil(t, pin)
		})
	}
}

func TestConfinedNativeSharedMainWithoutAlias(t *testing.T) {
	root, entries := nativeWindowFixture(t)
	require.NoError(t, os.Remove(filepath.Join(root, "extension/forge/windows/campaign/detail.yaml")))
	require.NoError(t, os.Remove(filepath.Join(root, "extension/forge/windows/campaign/detail/main.yaml")))
	bindings, err := ConfinedWindowBindings(context.Background(), root, entries, extensionPolicy, nil)
	require.NoError(t, err)
	resolver, err := bindings[0].Resolver(context.Background(), identity.VerifiedActor{ValidUntil: time.Now().Add(time.Minute)}, "resource.get")
	require.NoError(t, err)
	pin, err := resolver.Resolve(context.Background(), identity.ResourceRef{URI: entries[0].URI})
	require.NoError(t, err)
	raw, _, err := resolver.ReadResolved(context.Background(), *pin)
	require.NoError(t, err)
	selected, err := types.SelectWindowResource(raw, nil)
	require.NoError(t, err)
	require.Equal(t, "desktopRoot", selected.Window.View.Content.ID)
}

func TestConfinedNativeWindowRevocationBuffersDefinition(t *testing.T) {
	root, entries := nativeWindowFixture(t)
	var revoked atomic.Bool
	bindings, err := ConfinedWindowBindings(context.Background(), root, entries, extensionPolicy, func(context.Context, *types.Window) error { revoked.Store(true); return nil })
	require.NoError(t, err)
	actor := identity.VerifiedActor{Subject: "alice", Issuer: "https://idp.example", TenantID: "team", AccountID: "account", IdentityRevision: "r1", ValidUntil: time.Now().Add(time.Minute)}
	guard := func() error {
		if revoked.Load() {
			return identity.ErrResourceDenied
		}
		return nil
	}
	provider, err := NewLocalProvider(LocalConfig{ProviderIdentity: InternalProviderIdentity, Actor: func(context.Context) (identity.VerifiedActor, error) { return actor, nil }, Verify: func(context.Context, identity.VerifiedActor) error { return guard() }, Authorize: func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) error { return guard() }, Bindings: bindings, Validators: map[string]LocalResourceValidator{"window": ValidateWindowBundle}})
	require.NoError(t, err)
	got, err := provider.Get(context.Background(), "window", primitive.GetRequest{URI: entries[0].URI})
	require.ErrorIs(t, err, identity.ErrResourceDenied)
	require.Nil(t, got)
}

func TestConfinedNativeWindowImportCycleBudget(t *testing.T) {
	root, entries := nativeWindowFixture(t)
	extensionWrite(t, root, "extension/forge/windows/campaign/detail/shared/main.yaml", `$import(main.yaml)`)
	bindings, err := ConfinedWindowBindings(context.Background(), root, entries, extensionPolicy, nil)
	require.NoError(t, err)
	resolver, err := bindings[0].Resolver(context.Background(), identity.VerifiedActor{ValidUntil: time.Now().Add(time.Minute)}, "resource.get")
	require.NoError(t, err)
	pin, err := resolver.Resolve(context.Background(), identity.ResourceRef{URI: entries[0].URI})
	require.Error(t, err)
	require.Nil(t, pin)
	require.Contains(t, err.Error(), "budget")
}
