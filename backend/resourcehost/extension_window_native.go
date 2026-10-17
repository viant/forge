// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"

	"github.com/viant/afs"
	"github.com/viant/afs/object"
	"github.com/viant/afs/storage"
	identity "github.com/viant/forge/backend/resource"
	workspacewindow "github.com/viant/forge/backend/window/source"
)

// NativeWindowLoader preserves the approved native Forge/Core window loader,
// including keyed/parameterized imports, target precedence, assignments, action
// sources and datasource descriptors. Targets are trusted host declarations.
// Entry points remain explicit inventory bindings; fragments and target branches
// must not be independently indexed as windows.
func NativeWindowLoader(bindings []workspacewindow.ResourceBinding, enrich workspacewindow.WorkspaceWindowEnricher) ExtensionLoader {
	configured := append([]workspacewindow.ResourceBinding(nil), bindings...)
	return func(ctx context.Context, reader *ExtensionReader, file string) (json.RawMessage, error) {
		if reader == nil || reader.root == nil {
			return nil, identity.ErrResourceDenied
		}
		root := reader.root.Name()
		selected := -1
		for i, binding := range configured {
			if file == path.Join("extension/forge/windows", binding.WindowKey+".yaml") || file == path.Join("extension/forge/windows", binding.WindowKey+".yml") || file == path.Join("extension/forge/windows", binding.WindowKey, "main.yaml") || file == path.Join("extension/forge/windows", binding.WindowKey, "shared/main.yaml") {
				if selected != -1 {
					return nil, fmt.Errorf("ambiguous native window entry")
				}
				selected = i
			}
		}
		if selected < 0 {
			return nil, fmt.Errorf("native window entry requires an explicit logical binding")
		}
		binding := configured[selected]
		source, err := workspacewindow.NewWorkspaceResourceSource(root, []workspacewindow.ResourceBinding{binding}, enrich)
		if err != nil {
			return nil, err
		}
		reader.mu.Lock()
		if reader.windowAssets == nil {
			reader.windowAssets = workspacewindow.NewStaticAssetCompilation()
		}
		assets := reader.windowAssets
		reader.mu.Unlock()
		native := &confinedWindowFS{reader: reader, base: filepath.Clean(root)}
		options := workspacewindow.LoaderOptions{StaticAssets: assets, SharedDefault: true, FS: native, AssetDirectories: native.assetDirectories, Check: native.check}
		uri, err := identity.ParseResourceURI(binding.URI)
		if err != nil {
			return nil, err
		}
		raw, err := source.LoadBundleWithOptions(ctx, uri, options)
		if err != nil {
			return nil, err
		}
		return attachNativeWindowViewMetadata(ctx, reader, file, raw)
	}
}

// ConfinedWindowBindings uses explicit native entry points to avoid interpreting
// shared/import fragments and target variants as separate resources. It retains
// logical subfolder names and target declarations from approved ResourceBinding.
func ConfinedWindowBindings(ctx context.Context, rootPath string, bindings []workspacewindow.ResourceBinding, policy LocalRevisionPolicyFactory, enrich workspacewindow.WorkspaceWindowEnricher) ([]LocalResourceBinding, error) {
	if ctx == nil || policy == nil || len(bindings) == 0 {
		return nil, fmt.Errorf("native window bindings require policy and entries")
	}
	rootPath, err := filepath.Abs(rootPath)
	if err != nil {
		return nil, err
	}
	root, err := os.OpenRoot(rootPath)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	reader := &ExtensionReader{root: root}
	defer reader.close()
	rootInfo, err := root.Stat(".")
	if err != nil {
		return nil, err
	}
	// Reuse canonical duplicate/target checks before any registration.
	if _, err = workspacewindow.NewWorkspaceResourceSource(rootPath, bindings, enrich); err != nil {
		return nil, err
	}
	result := make([]LocalResourceBinding, 0, len(bindings))
	for _, binding := range bindings {
		uri, err := identity.ParseResourceURI(binding.URI)
		if err != nil {
			return nil, err
		}
		var entry string
		// Singleton aliases and native main files designate one logical resource;
		// an alias alongside its main file is normal, not a duplicate window.
		for _, candidate := range []string{path.Join("extension/forge/windows", binding.WindowKey+".yaml"), path.Join("extension/forge/windows", binding.WindowKey, "main.yaml"), path.Join("extension/forge/windows", binding.WindowKey, "shared/main.yaml")} {
			if err := reader.check(candidate); err == nil {
				entry = candidate
				break
			} else if !errors.Is(err, fs.ErrNotExist) {
				return nil, err
			}
		}
		if entry == "" {
			return nil, fmt.Errorf("native window entry missing")
		}
		source := &extensionSource{rootInfo: rootInfo, root: rootPath, file: entry, uri: uri.String(), load: NativeWindowLoader([]workspacewindow.ResourceBinding{binding}, enrich)}
		result = append(result, LocalResourceBinding{URI: uri.String(), Title: binding.WindowKey, FormatVersion: 2, Resolver: func(ctx context.Context, actor identity.VerifiedActor, action string) (*identity.ResourceResolver, error) {
			p, err := policy(ctx, actor, uri, action)
			if err != nil {
				return nil, err
			}
			if p == nil {
				return nil, identity.ErrResourceDenied
			}
			return &identity.ResourceResolver{ProviderIdentity: InternalProviderIdentity, Source: source, Policy: p}, nil
		}})
	}
	return result, nil
}

type confinedWindowFS struct {
	reader        *ExtensionReader
	base          string
	canonicalOnce sync.Once
	canonicalBase string
	canonicalErr  error
	mu            sync.Mutex
	failure       error
	reads         map[string]int
	totalReads    int
}

func (f *confinedWindowFS) check() error { f.mu.Lock(); defer f.mu.Unlock(); return f.failure }
func (f *confinedWindowFS) fail(err error) error {
	if err != nil {
		f.mu.Lock()
		if f.failure == nil || errors.Is(f.failure, fs.ErrNotExist) && !errors.Is(err, fs.ErrNotExist) {
			f.failure = err
		}
		f.mu.Unlock()
	}
	return err
}
func (f *confinedWindowFS) relative(location string) (string, error) {
	parsed, err := url.Parse(location)
	if err != nil {
		return "", f.fail(identity.ErrResourceDenied)
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" || parsed.User != nil || parsed.Scheme != "" && parsed.Scheme != "file" || parsed.Host != "" && parsed.Host != "localhost" {
		return "", f.fail(identity.ErrResourceDenied)
	}
	value := location
	if parsed.Scheme == "file" {
		value = parsed.Path
	}
	if filepath.IsAbs(value) {
		absolute := value
		value, err = filepath.Rel(f.base, absolute)
		if err != nil || !extensionPath(filepath.ToSlash(value)) {
			f.canonicalOnce.Do(func() { f.canonicalBase, f.canonicalErr = filepath.EvalSymlinks(f.base) })
			if f.canonicalErr != nil {
				return "", f.fail(f.canonicalErr)
			}
			value, err = filepath.Rel(f.canonicalBase, absolute)
			if err != nil {
				return "", f.fail(identity.ErrResourceDenied)
			}
		}
	}
	value = filepath.ToSlash(value)
	if !extensionPath(value) {
		return "", f.fail(identity.ErrResourceDenied)
	}
	return value, nil
}
func (f *confinedWindowFS) DownloadWithURL(ctx context.Context, location string, _ ...storage.Option) ([]byte, error) {
	name, err := f.relative(location)
	if err != nil {
		return nil, err
	}
	f.mu.Lock()
	if f.reads == nil {
		f.reads = map[string]int{}
	}
	f.reads[name]++
	f.totalReads++
	exhausted := f.reads[name] > 4096 || f.totalReads > 65536
	f.mu.Unlock()
	if exhausted {
		return nil, f.fail(fmt.Errorf("native window import/read budget exceeded"))
	}
	raw, err := f.reader.ReadFile(ctx, name)
	if err != nil {
		return nil, f.fail(err)
	}
	return raw, nil
}
func (f *confinedWindowFS) Download(ctx context.Context, o storage.Object, opts ...storage.Option) ([]byte, error) {
	return f.DownloadWithURL(ctx, o.URL(), opts...)
}
func (f *confinedWindowFS) OpenURL(ctx context.Context, location string, opts ...storage.Option) (io.ReadCloser, error) {
	raw, err := f.DownloadWithURL(ctx, location, opts...)
	if err != nil {
		return nil, err
	}
	return io.NopCloser(bytes.NewReader(raw)), nil
}
func (f *confinedWindowFS) Open(ctx context.Context, o storage.Object, opts ...storage.Option) (io.ReadCloser, error) {
	return f.OpenURL(ctx, o.URL(), opts...)
}
func (f *confinedWindowFS) Exists(ctx context.Context, location string, _ ...storage.Option) (bool, error) {
	name, err := f.relative(location)
	if err != nil {
		return false, err
	}
	if ctx == nil || ctx.Err() != nil {
		return false, f.fail(identity.ErrResourceDenied)
	}
	err = f.reader.check(name)
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, f.fail(err)
	}
	return true, nil
}
func (f *confinedWindowFS) Object(ctx context.Context, location string, _ ...storage.Option) (storage.Object, error) {
	name, err := f.relative(location)
	if err != nil {
		return nil, err
	}
	if ctx == nil || ctx.Err() != nil {
		return nil, f.fail(identity.ErrResourceDenied)
	}
	_, _, info, err := f.reader.parent(name)
	if err != nil {
		return nil, f.fail(err)
	}
	return object.New("file://"+filepath.ToSlash(filepath.Join(f.base, name)), info, nil), nil
}
func (f *confinedWindowFS) List(ctx context.Context, location string, _ ...storage.Option) ([]storage.Object, error) {
	name, err := f.relative(location)
	if err != nil {
		return nil, err
	}
	if ctx == nil || ctx.Err() != nil {
		return nil, f.fail(identity.ErrResourceDenied)
	}
	parent, leaf, _, err := f.reader.parent(name)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, err
		}
		return nil, f.fail(err)
	}
	file, err := parent.Open(leaf)
	if err != nil {
		return nil, f.fail(err)
	}
	defer file.Close()
	entries, err := file.ReadDir(-1)
	if err != nil {
		return nil, f.fail(err)
	}
	result := make([]storage.Object, 0, len(entries))
	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink != 0 {
			return nil, f.fail(identity.ErrResourceDenied)
		}
		info, err := entry.Info()
		if err != nil {
			return nil, f.fail(err)
		}
		if !info.IsDir() && !info.Mode().IsRegular() {
			return nil, f.fail(identity.ErrResourceDenied)
		}
		result = append(result, object.New("file://"+filepath.ToSlash(filepath.Join(f.base, name, entry.Name())), info, nil))
	}
	return result, nil
}
func (f *confinedWindowFS) assetDirectories(ctx context.Context) (map[string]bool, error) {
	const base = "extension/forge"
	if err := f.reader.check(base); err != nil {
		return nil, f.fail(err)
	}
	dirs := map[string]bool{}
	err := fs.WalkDir(f.reader.root.FS(), base, func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if ctx == nil || ctx.Err() != nil {
			return identity.ErrResourceDenied
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return identity.ErrResourceDenied
		}
		if entry.IsDir() {
			relative := strings.TrimPrefix(name, base+"/")
			parts := strings.Split(relative, "/")
			for i := range parts {
				dirs[strings.Join(parts[i:], "/")] = true
			}
		}
		return nil
	})
	if err != nil {
		return nil, f.fail(err)
	}
	return dirs, nil
}

// Native window metadata needs read operations only. Every other afs method
// explicitly denies rather than delegating to an unconstrained default service.
func (f *confinedWindowFS) Upload(context.Context, string, os.FileMode, io.Reader, ...storage.Option) error {
	return f.fail(identity.ErrResourceDenied)
}
func (f *confinedWindowFS) Uploader(context.Context, string, ...storage.Option) (storage.Upload, io.Closer, error) {
	return nil, nil, f.fail(identity.ErrResourceDenied)
}
func (f *confinedWindowFS) Delete(context.Context, string, ...storage.Option) error {
	return f.fail(identity.ErrResourceDenied)
}
func (f *confinedWindowFS) Create(context.Context, string, os.FileMode, bool, ...storage.Option) error {
	return f.fail(identity.ErrResourceDenied)
}
func (f *confinedWindowFS) Walk(context.Context, string, storage.OnVisit, ...storage.Option) error {
	return f.fail(identity.ErrResourceDenied)
}
func (f *confinedWindowFS) Copy(context.Context, string, string, ...storage.Option) error {
	return f.fail(identity.ErrResourceDenied)
}
func (f *confinedWindowFS) Move(context.Context, string, string, ...storage.Option) error {
	return f.fail(identity.ErrResourceDenied)
}
func (f *confinedWindowFS) Init(context.Context, string, ...storage.Option) error {
	return f.fail(identity.ErrResourceDenied)
}
func (f *confinedWindowFS) NewWriter(context.Context, string, os.FileMode, ...storage.Option) (io.WriteCloser, error) {
	return nil, f.fail(identity.ErrResourceDenied)
}
func (f *confinedWindowFS) CloseAll() error             { return nil }
func (f *confinedWindowFS) Close(string) error          { return nil }
func (f *confinedWindowFS) ErrorCode(string, error) int { return 0 }

var _ afs.Service = (*confinedWindowFS)(nil)
