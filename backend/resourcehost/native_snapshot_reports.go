package resource

import (
	"context"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"

	reportcatalog "github.com/viant/forge/backend/reporting/catalog"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
	workspacewindow "github.com/viant/forge/backend/window/source"
)

// ConfinedReportingOptions routes native registry YAML/profile reads and scans
// through the same confined reader used by window/import materialization.
func ConfinedReportingOptions(ctx context.Context, reader *ExtensionReader, options registry.Options) (registry.Options, func() error, error) {
	if reader == nil || reader.root == nil {
		return options, nil, identity.ErrResourceDenied
	}
	filesystem := &confinedWindowFS{reader: reader, base: filepath.Clean(reader.root.Name())}
	options.WorkspaceRoot = reader.root.Name()
	options.ReadFile = func(file string) ([]byte, error) { return filesystem.DownloadWithURL(ctx, file) }
	options.WalkDir = func(root string, visit fs.WalkDirFunc) error {
		relative, err := filesystem.relative(root)
		if err != nil {
			return err
		}
		if err = reader.check(relative); err != nil {
			return filesystem.fail(err)
		}
		err = fs.WalkDir(reader.root.FS(), relative, func(name string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if entry.Type()&os.ModeSymlink != 0 {
				return identity.ErrResourceDenied
			}
			_, _, info, err := reader.parent(name)
			if err != nil {
				return err
			}
			if !info.IsDir() && !info.Mode().IsRegular() {
				return identity.ErrResourceDenied
			}
			return visit(filepath.Join(options.WorkspaceRoot, filepath.FromSlash(name)), entry, nil)
		})
		return filesystem.fail(err)
	}
	return options, filesystem.check, nil
}

// NativeReportLoader uses the existing approved authored report materializer,
// including fragment/profile expansion and complete native datasource imports.
// It is a deterministic startup/rebuild loader; it never reads caller authority.
func NativeReportLoader(uri string, options reportcatalog.ReportResourceOptions, enrich StaticWorkspaceWindowEnricher) ExtensionLoader {
	return func(ctx context.Context, reader *ExtensionReader, _ string) (json.RawMessage, error) {
		reportingOptions, check, err := ConfinedReportingOptions(ctx, reader, options.Options)
		if err != nil {
			return nil, err
		}
		current := options
		current.Options = reportingOptions
		filesystem := &confinedWindowFS{reader: reader, base: filepath.Clean(reader.root.Name())}
		current.DataSources = func(ctx context.Context, builder *registry.Asset) (map[string]json.RawMessage, error) {
			key := options.BuilderWindows[builder.ID]
			if key == "" {
				return nil, identity.ErrResourceDenied
			}
			return workspacewindow.LoadWorkspaceDatasourceDescriptorsWithOptionsAt(ctx, reader.root.Name(), key, workspacewindow.WorkspaceWindowEnricher(enrich), workspacewindow.LoaderOptions{SharedDefault: true, FS: filesystem, AssetDirectories: filesystem.assetDirectories, Check: filesystem.check})
		}
		source, err := reportcatalog.NewReportResourceSource(current)
		if err != nil {
			return nil, err
		}
		raw, err := source.Materialize(ctx, uri)
		if err != nil {
			return nil, err
		}
		if err = check(); err != nil {
			return nil, err
		}
		if err = filesystem.check(); err != nil {
			return nil, err
		}
		return raw, nil
	}
}
