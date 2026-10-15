package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/stretchr/testify/require"
	dsproto "github.com/viant/forge/backend/datasource/contract"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	workspacewindow "github.com/viant/forge/backend/window/source"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestNativeComposedChatOwnsAuthoredPickerClosureAndSourceGuard(t *testing.T) {
	root := t.TempDir()
	write := func(name, body string) {
		p := filepath.Join(root, "extension/forge", name)
		require.NoError(t, os.MkdirAll(filepath.Dir(p), 0700))
		require.NoError(t, os.WriteFile(p, []byte(body), 0600))
	}
	write("lookups/order.yaml", "id: order\nbindings:\n  - named: {name: order}\n    lookup: {dialogId: adOrderPicker, dataSource: ad_order_lookup}\n")
	write("dialogs/order.yaml", "id: adOrderPicker\ndataSourceRef: ad_order_lookup\ncontent: {id: originalOrderTable, dataSourceRef: ad_order_lookup}\n")
	write("datasources/order.yaml", "id: ad_order_lookup\ncardinality: collection\nbackend: {kind: datly, ownership: provider, service: protected, method: fetch}\n")
	write("datasources/unrelated.yaml", "id: unrelated\ncardinality: collection\n")
	binding := workspacewindow.ResourceBinding{WindowKey: "chat/new", URI: "window://agently/chat-new"}
	calls := 0
	loader := NativeComposedWindowLoader(binding, func(ctx context.Context, target *types.WindowTarget) (*types.Window, error) {
		calls++
		title := "desktop"
		if target != nil && target.FormFactor == "phone" {
			title = "phone"
		}
		return &types.Window{Namespace: title, View: types.View{Content: &types.Container{Chat: &types.Chat{}}}}, nil
	}, nil)
	ctx := context.Background()
	snapshot, err := NewNativeAssetSnapshot(ctx, root, []NativeSnapshotDefinition{{URI: binding.URI, FormatVersion: 2, File: "extension/forge", Load: loader}}, NativeSnapshotOptions{})
	require.NoError(t, err)
	require.Equal(t, len(workspacewindow.StandardWindowTargets()), calls)
	uri, _ := identity.ParseResourceURI(binding.URI)
	candidates, err := snapshot.Candidates(ctx, uri)
	require.NoError(t, err)
	raw, err := snapshot.ReadCandidate(ctx, uri, candidates[0])
	require.NoError(t, err)
	selected, err := types.SelectWindowResource(raw, &types.WindowTarget{Platform: "web", FormFactor: "phone"})
	require.NoError(t, err)
	require.Equal(t, "phone", selected.Window.Namespace)
	require.Len(t, selected.Window.Dialogs, 1)
	require.Equal(t, "adOrderPicker", selected.Window.Dialogs[0].Id)
	require.Contains(t, selected.DataSources, "ad_order_lookup")
	require.NotContains(t, selected.DataSources, "unrelated")
	var descriptor dsproto.DataSource
	require.NoError(t, json.Unmarshal(selected.DataSources["ad_order_lookup"], &descriptor))
	require.NotNil(t, descriptor.Backend)
	require.Equal(t, "protected", descriptor.Backend.Service)
	require.Equal(t, identity.ContentFingerprint(selected.DataSources["ad_order_lookup"]), selected.Window.ResourceDependencies["ad_order_lookup"])
	write("dialogs/order.yaml", "id: adOrderPicker\ndataSourceRef: ad_order_lookup\ncontent: {id: changed}\n")
	retained, err := snapshot.ReadCandidate(ctx, uri, candidates[0])
	require.NoError(t, err)
	require.Equal(t, raw, retained)
	require.EqualValues(t, 1, snapshot.CompileCount())
	require.NoError(t, snapshot.Reload(ctx))
	_, err = snapshot.ReadCandidate(ctx, uri, candidates[0])
	require.ErrorIs(t, err, identity.ErrResourceStale)
}

func TestNativeComposedWindowDetachesSourceAndDeclaredProfiles(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "extension/forge"), 0700))
	shared := &types.Window{Resource: &identity.ResolvedResource{URI: "window://authored/source"}, ResourceDependencies: map[string]string{"authored": "unchanged"}, DataSource: map[string]types.DataSource{"items": {Selectors: &types.Selectors{Data: "data"}}}, View: types.View{Content: &types.Container{ID: "authored"}}}
	original, err := json.Marshal(shared)
	require.NoError(t, err)
	custom := types.WindowTarget{Platform: "web", FormFactor: "foldable"}
	binding := workspacewindow.ResourceBinding{WindowKey: "composed", URI: "window://example/composed", Targets: []types.WindowTarget{custom}}
	profiles := append(workspacewindow.StandardWindowTargets(), custom)
	type callerKey struct{}
	calls := 0
	loader := NativeComposedWindowLoader(binding, func(ctx context.Context, target *types.WindowTarget) (*types.Window, error) {
		require.Nil(t, ctx.Value(callerKey{}), "static compilation must not inherit caller values")
		calls++
		copy := *shared // Trusted providers may share immutable nested declarations.
		copy.Namespace = (types.WindowTarget{}).ProfileKey()
		if target != nil {
			copy.Namespace = target.ProfileKey()
		}
		return &copy, nil
	}, func(_ context.Context, window *types.Window) error {
		window.View.Content.ClassName = window.Namespace
		window.DataSource["items"] = types.DataSource{Selectors: &types.Selectors{Data: window.Namespace}}
		return nil
	})
	binding.Targets[0].FormFactor = "caller-mutated"
	ctx := context.WithValue(context.Background(), callerKey{}, "caller-secret")
	snapshot, err := NewNativeAssetSnapshot(ctx, root, []NativeSnapshotDefinition{{URI: binding.URI, FormatVersion: 2, File: "extension/forge", Load: loader}}, NativeSnapshotOptions{})
	require.NoError(t, err)
	require.Equal(t, len(profiles), calls)
	after, err := json.Marshal(shared)
	require.NoError(t, err)
	require.JSONEq(t, string(original), string(after), "composition mutated its borrowed authored source")
	uri, err := identity.ParseResourceURI(binding.URI)
	require.NoError(t, err)
	candidates, err := snapshot.Candidates(ctx, uri)
	require.NoError(t, err)
	raw, err := snapshot.ReadCandidate(ctx, uri, candidates[0])
	require.NoError(t, err)
	var envelope types.WindowResourceEnvelope
	require.NoError(t, json.Unmarshal(raw, &envelope))
	require.Len(t, envelope.Targets, len(profiles))
	for _, target := range profiles {
		selected, err := types.SelectWindowResource(raw, &target)
		require.NoError(t, err)
		require.Equal(t, target.ProfileKey(), selected.Window.Namespace)
		require.Equal(t, target.ProfileKey(), selected.Window.View.Content.ClassName)
		var descriptor dsproto.DataSource
		require.NoError(t, json.Unmarshal(selected.DataSources["items"], &descriptor))
		require.Equal(t, target.ProfileKey(), descriptor.Selectors.Data)
	}
	var readers sync.WaitGroup
	failures := make(chan error, len(profiles))
	for _, target := range profiles {
		readers.Add(1)
		go func(target types.WindowTarget) {
			defer readers.Done()
			for i := 0; i < 3; i++ {
				bytes, err := snapshot.ReadCandidate(ctx, uri, candidates[0])
				if err != nil {
					failures <- err
					return
				}
				selected, err := types.SelectWindowResource(bytes, &target)
				if err != nil {
					failures <- err
					return
				}
				if selected.Window.Namespace != target.ProfileKey() || selected.Window.View.Content.ClassName != target.ProfileKey() {
					failures <- fmt.Errorf("cross-profile contamination for %s", target.ProfileKey())
					return
				}
				selected.Window.View.Content.ClassName = "caller-local-mutation"
				bytes[0] = 'x' // Returned bytes must not alias the held snapshot.
			}
		}(target)
	}
	readers.Wait()
	close(failures)
	for err := range failures {
		require.NoError(t, err)
	}
	// Newly introduced assets do not replace the captured closure on a read.
	require.NoError(t, os.WriteFile(filepath.Join(root, "extension/forge/new.yaml"), []byte("new: asset\n"), 0600))
	retained, err := snapshot.ReadCandidate(ctx, uri, candidates[0])
	require.NoError(t, err)
	require.NoError(t, ValidateWindowBundle(2, retained))
	require.EqualValues(t, 1, snapshot.CompileCount(), "new unrelated files are not scanned on reads")
	require.EqualValues(t, 1, snapshot.CompileCount())
}

func TestNativeComposedWindowRejectsInvalidDeclarationsBeforeBaseLoad(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "extension/forge"), 0700))
	pin := identity.ResolvedResource{URI: "window://example/composed", ProviderIdentity: "producer", AuthorityBinding: "actor", ValidUntil: time.Now().Add(time.Minute), ResourceCandidate: identity.ResourceCandidate{Kind: "working", ContentFingerprint: identity.ContentFingerprint([]byte("source"))}}
	for _, scenario := range []string{"nil-base", "path-escape", "runtime-proof"} {
		t.Run(scenario, func(t *testing.T) {
			binding := workspacewindow.ResourceBinding{WindowKey: "composed", URI: pin.URI}
			calls := 0
			var base func(context.Context, *types.WindowTarget) (*types.Window, error)
			base = func(context.Context, *types.WindowTarget) (*types.Window, error) {
				calls++
				return &types.Window{}, nil
			}
			switch scenario {
			case "nil-base":
				base = nil
			case "path-escape":
				binding.WindowKey = "../escape"
			case "runtime-proof":
				binding.Targets = []types.WindowTarget{{Platform: "custom", ExecutionProof: &primitive.ExecutionProof{Resource: pin, Binding: "runtime-variant", Token: "runtime-token"}}}
			}
			_, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{{URI: pin.URI, FormatVersion: 2, File: "extension/forge", Load: NativeComposedWindowLoader(binding, base, nil)}})
			require.Error(t, err)
			require.Zero(t, calls)
		})
	}
}

func TestNativeComposedWindowDeniesAmbiguousAndUnconfinedClosures(t *testing.T) {
	for _, scenario := range []string{"nil-window", "base-error", "duplicate-profile", "too-many-profiles", "symlink-asset"} {
		t.Run(scenario, func(t *testing.T) {
			root := t.TempDir()
			assets := filepath.Join(root, "extension/forge")
			require.NoError(t, os.MkdirAll(assets, 0700))
			binding := workspacewindow.ResourceBinding{WindowKey: "composed", URI: "window://example/composed"}
			base := func(context.Context, *types.WindowTarget) (*types.Window, error) { return &types.Window{}, nil }
			switch scenario {
			case "nil-window":
				base = func(context.Context, *types.WindowTarget) (*types.Window, error) { return nil, nil }
			case "base-error":
				base = func(context.Context, *types.WindowTarget) (*types.Window, error) {
					return nil, identity.ErrResourceDenied
				}
			case "duplicate-profile":
				binding.Targets = []types.WindowTarget{{Platform: "web"}}
			case "too-many-profiles":
				for i := 0; i < 129; i++ {
					binding.Targets = append(binding.Targets, types.WindowTarget{Platform: fmt.Sprintf("custom%d", i)})
				}
			case "symlink-asset":
				outside := filepath.Join(t.TempDir(), "outside.yaml")
				require.NoError(t, os.WriteFile(outside, []byte("id: outside\n"), 0600))
				require.NoError(t, os.Symlink(outside, filepath.Join(assets, "outside.yaml")))
			}
			snapshot, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{{URI: binding.URI, FormatVersion: 2, File: "extension/forge", Load: NativeComposedWindowLoader(binding, base, nil)}}, NativeSnapshotOptions{})
			require.Error(t, err)
			require.Nil(t, snapshot)
		})
	}
}

func TestNativeComposedWindowPreservesLargeAuthoredNumbers(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "extension/forge"), 0700))
	for _, value := range []any{int64(9007199254740993), json.Number("9007199254740993")} {
		shared := &types.Window{Parameters: []map[string]interface{}{{"name": "exactId", "default": value}}, View: types.View{Content: &types.Container{ID: "exact", VisibleWhen: map[string]interface{}{"accountId": value}}}}
		original, err := json.Marshal(shared.Parameters)
		require.NoError(t, err)
		originalCondition, err := json.Marshal(shared.View.Content.VisibleWhen)
		require.NoError(t, err)
		binding := workspacewindow.ResourceBinding{WindowKey: "exact", URI: "window://example/exact"}
		loader := NativeComposedWindowLoader(binding, func(context.Context, *types.WindowTarget) (*types.Window, error) { return shared, nil }, nil)
		snapshot, err := NewNativeAssetSnapshot(context.Background(), root, []NativeSnapshotDefinition{{URI: binding.URI, FormatVersion: 2, File: "extension/forge", Load: loader}}, NativeSnapshotOptions{})
		require.NoError(t, err)
		uri, err := identity.ParseResourceURI(binding.URI)
		require.NoError(t, err)
		candidates, err := snapshot.Candidates(context.Background(), uri)
		require.NoError(t, err)
		raw, err := snapshot.ReadCandidate(context.Background(), uri, candidates[0])
		require.NoError(t, err)
		// Inspect authored JSON directly: ordinary client decoding of interface
		// maps may itself lose precision, which is outside static compilation.
		var envelope struct {
			Variants map[string]struct {
				Window struct {
					Parameters json.RawMessage `json:"parameters"`
					View       struct {
						Content struct {
							VisibleWhen json.RawMessage `json:"visibleWhen"`
						} `json:"content"`
					} `json:"view"`
				} `json:"window"`
			} `json:"variants"`
		}
		require.NoError(t, json.Unmarshal(raw, &envelope))
		require.NotEmpty(t, envelope.Variants)
		expectedFingerprint, err := types.WindowVariantFingerprint(types.WindowResourceVariant{Window: shared, DataSources: map[string]json.RawMessage{}})
		require.NoError(t, err)
		for fingerprint, variant := range envelope.Variants {
			require.Equal(t, expectedFingerprint, fingerprint, "composition changed the authored declaration fingerprint")
			require.Equal(t, string(original), string(variant.Window.Parameters), "composition rounded an authored identifier")
			require.Equal(t, string(originalCondition), string(variant.Window.View.Content.VisibleWhen), "composition rounded a container condition")
		}
		selected, err := types.SelectWindowResource(raw, nil)
		require.NoError(t, err)
		selectedJSON, err := json.Marshal(selected.Window.Parameters)
		require.NoError(t, err)
		require.Equal(t, string(original), string(selectedJSON), "selected consumer rounded an authored identifier")
		selectedCondition, err := json.Marshal(selected.Window.View.Content.VisibleWhen)
		require.NoError(t, err)
		require.Equal(t, string(originalCondition), string(selectedCondition), "selected consumer rounded a container condition")
		after, err := json.Marshal(shared.Parameters)
		require.NoError(t, err)
		require.Equal(t, string(original), string(after))
	}
}
