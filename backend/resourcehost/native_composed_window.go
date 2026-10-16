package resource

import (
	"context"
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	workspacewindow "github.com/viant/forge/backend/window/source"
	"path/filepath"
)

// NativeComposedWindowLoader preserves a trusted linked definition and adds its
// authored workspace dependencies through the snapshot's confined source reader.
// It runs during compilation only and accepts no actor or permission facts.
func NativeComposedWindowLoader(binding workspacewindow.ResourceBinding, base func(context.Context, *types.WindowTarget) (*types.Window, error), enrich StaticWorkspaceWindowEnricher) ExtensionLoader {
	binding.Targets = append([]types.WindowTarget(nil), binding.Targets...)
	return func(ctx context.Context, reader *ExtensionReader, _ string) (json.RawMessage, error) {
		if reader == nil || reader.root == nil || base == nil {
			return nil, identity.ErrResourceDenied
		}
		root := reader.root.Name()
		reader.mu.Lock()
		if reader.windowAssets == nil {
			reader.windowAssets = workspacewindow.NewStaticAssetCompilation()
		}
		assets := reader.windowAssets
		reader.mu.Unlock()
		native := &confinedWindowFS{reader: reader, base: filepath.Clean(root)}
		options := workspacewindow.LoaderOptions{StaticAssets: assets, FS: native, AssetDirectories: native.assetDirectories, Check: native.check}
		return workspacewindow.LoadComposedWindowBundleWithOptionsAt(ctx, root, binding, base, workspacewindow.WorkspaceWindowEnricher(enrich), options)
	}
}
