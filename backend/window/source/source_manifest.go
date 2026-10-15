// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/viant/afs"
	"github.com/viant/afs/storage"
	identity "github.com/viant/forge/backend/resource"
	wsmeta "github.com/viant/forge/backend/window/source/internal/meta"
)

// WindowSourceManifest retains authoritative named workspace files verbatim.
// It is source authoring input, not a runtime envelope or authorization grant.
// Imports and actionRefs are resolved by the existing native loader.
type WindowSourceManifest struct {
	Version int               `json:"version"`
	Binding ResourceBinding   `json:"binding"`
	Files   map[string]string `json:"files"`
}

// CompileWindowSource uses the same native loader as Steward. The temporary
// workspace is private to this compilation, contains only supplied files, and
// is deleted before return. It performs no network or business-data operation.
// Hosts must persist the manifest alongside the returned derived runtime bytes.
type WindowSourceCompileOptions struct {
	EnricherFactory func(context.Context, string, afs.Service) (WorkspaceWindowEnricher, error)
}

func CompileWindowSource(ctx context.Context, manifest WindowSourceManifest) (json.RawMessage, error) {
	return CompileWindowSourceWithOptions(ctx, manifest, WindowSourceCompileOptions{})
}
func CompileWindowSourceWithOptions(ctx context.Context, manifest WindowSourceManifest, options WindowSourceCompileOptions) (json.RawMessage, error) {
	if ctx == nil || ctx.Err() != nil {
		return nil, fmt.Errorf("source compilation context required")
	}
	if manifest.Version != 1 || len(manifest.Files) == 0 || len(manifest.Files) > 4096 {
		return nil, fmt.Errorf("invalid source manifest version or file count")
	}
	// Validate binding before creating any temporary files.
	if _, err := NewWorkspaceResourceSource(".", []ResourceBinding{manifest.Binding}, nil); err != nil {
		return nil, err
	}
	total := 0
	for name, text := range manifest.Files {
		if !sourceFilePath(name) || !utf8.ValidString(text) || strings.ContainsRune(text, '\x00') {
			return nil, fmt.Errorf("invalid source file path or encoding")
		}
		total += len(text)
		if len(text) > 8<<20 || total > 32<<20 {
			return nil, fmt.Errorf("source manifest size limit exceeded")
		}
	}
	root, err := os.MkdirTemp("", "window-source-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(root)
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		return nil, err
	}
	for name, text := range manifest.Files {
		filename := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(filename), 0700); err != nil {
			return nil, err
		}
		if err := os.WriteFile(filename, []byte(text), 0600); err != nil {
			return nil, err
		}
	}
	fs := &sourceManifestFS{Service: afs.New(), root: root}
	defer fs.CloseAll()
	var enrich WorkspaceWindowEnricher
	if options.EnricherFactory != nil {
		enrich, err = options.EnricherFactory(ctx, root, fs)
		if err != nil {
			return nil, err
		}
	}
	source, err := NewWorkspaceResourceSource(root, []ResourceBinding{manifest.Binding}, enrich)
	if err != nil {
		return nil, err
	}
	uri, err := identity.ParseResourceURI(manifest.Binding.URI)
	if err != nil {
		return nil, err
	}
	return source.LoadBundleWithOptions(ctx, uri, LoaderOptions{FS: fs, Check: fs.check, SharedDefault: true, StaticAssets: &StaticAssetCompilation{}})
}

// CaptureWindowSource records the actual text files read by native compilation,
// including transitive imports, scripts and catalog assignments. It never
// reconstructs filenames or imports from compiled JSON. The host owns the
// trusted workspace root and authoring access to it.
func CaptureWindowSource(ctx context.Context, root string, binding ResourceBinding) (WindowSourceManifest, json.RawMessage, error) {
	return CaptureWindowSourceWithOptions(ctx, root, binding, WindowSourceCompileOptions{})
}
func CaptureWindowSourceWithOptions(ctx context.Context, root string, binding ResourceBinding, options WindowSourceCompileOptions) (WindowSourceManifest, json.RawMessage, error) {
	manifest := WindowSourceManifest{Version: 1, Binding: binding, Files: map[string]string{}}
	if ctx == nil || ctx.Err() != nil {
		return manifest, nil, fmt.Errorf("source compilation context required")
	}
	absolute, err := filepath.Abs(root)
	if err != nil {
		return manifest, nil, err
	}
	absolute, err = filepath.EvalSymlinks(absolute)
	if err != nil {
		return manifest, nil, err
	}
	fs := &sourceManifestFS{Service: afs.New(), root: absolute, retained: manifest.Files}
	defer fs.CloseAll()
	var enrich WorkspaceWindowEnricher
	if options.EnricherFactory != nil {
		enrich, err = options.EnricherFactory(ctx, absolute, fs)
		if err != nil {
			return manifest, nil, err
		}
	}
	source, err := NewWorkspaceResourceSource(absolute, []ResourceBinding{binding}, enrich)
	if err != nil {
		return manifest, nil, err
	}
	uri, err := identity.ParseResourceURI(binding.URI)
	if err != nil {
		return manifest, nil, err
	}
	definition, err := source.LoadBundleWithOptions(ctx, uri, LoaderOptions{FS: fs, Check: fs.check, SharedDefault: true, StaticAssets: &StaticAssetCompilation{}, SourceCatalog: func(pool bool) { fs.pool = pool }, SourceFileSelected: func(ctx context.Context, file string) error {
		if fs.selected == nil {
			fs.selected = map[string]bool{}
		}
		if fs.selected[file] {
			return nil
		}
		fs.selected[file] = true
		var value any
		return wsmeta.New(fs, absolute).Load(ctx, file, &value)
	}})
	if err != nil {
		return manifest, nil, err
	}
	return manifest, definition, nil
}

func sourceFilePath(name string) bool {
	if name == "" || len(name) > 1024 || path.Clean(name) != name || strings.HasPrefix(name, "/") || strings.ContainsAny(name, "\\:\x00?#%") {
		return false
	}
	for _, segment := range strings.Split(name, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return false
		}
	}
	return true
}

// All loader reads are confined, including optional/branch probes. A swallowed
// denial remains sticky so an external import can never silently compile.
type sourceManifestFS struct {
	afs.Service
	root          string
	mu            sync.Mutex
	failure       error
	retained      map[string]string
	retainedBytes int
	pool          bool
	selected      map[string]bool
	reads         map[string]int
	totalReads    int
}

func (f *sourceManifestFS) check() error { f.mu.Lock(); defer f.mu.Unlock(); return f.failure }
func (f *sourceManifestFS) location(value string) (string, error) {
	u, err := url.Parse(value)
	if err == nil && u.User == nil && (u.Host == "" || u.Host == "localhost") && u.RawQuery == "" && u.Fragment == "" && (u.Scheme == "" || u.Scheme == "file") {
		filename := value
		if u.Scheme == "file" {
			filename = u.Path
		}
		if !filepath.IsAbs(filename) {
			filename = filepath.Join(f.root, filename)
		}
		rel, e := filepath.Rel(f.root, filename)
		if e == nil && (rel == "." || sourceFilePath(filepath.ToSlash(rel))) {
			// Trusted workspaces may contain links; source capture must not
			// follow them outside the declared root.
			if resolved, err := filepath.EvalSymlinks(filename); err == nil {
				rel, e = filepath.Rel(f.root, resolved)
				if e == nil && (rel == "." || sourceFilePath(filepath.ToSlash(rel))) {
					return resolved, nil
				}
			} else if os.IsNotExist(err) {
				return filename, nil
			}
		}
	}
	f.mu.Lock()
	if f.failure == nil {
		f.failure = fmt.Errorf("source import outside retained workspace")
	}
	err = f.failure
	f.mu.Unlock()
	return "", err
}
func (f *sourceManifestFS) DownloadWithURL(ctx context.Context, value string, opts ...storage.Option) ([]byte, error) {
	name, err := f.location(value)
	if err != nil {
		return nil, err
	}
	f.mu.Lock()
	if f.reads == nil {
		f.reads = map[string]int{}
	}
	f.reads[name]++
	f.totalReads++
	if f.reads[name] > 4096 || f.totalReads > 65536 {
		f.failure = fmt.Errorf("named source import/read budget exceeded")
	}
	f.mu.Unlock()
	if err := f.check(); err != nil {
		return nil, err
	}
	data, err := f.Service.DownloadWithURL(ctx, name, opts...)
	if err != nil || f.retained == nil || f.pool {
		return data, err
	}
	if !utf8.Valid(data) || strings.ContainsRune(string(data), '\x00') {
		f.mu.Lock()
		f.failure = fmt.Errorf("source manifest requires text assets")
		f.mu.Unlock()
		return nil, f.check()
	}
	rel, err := filepath.Rel(f.root, name)
	if err != nil {
		return nil, err
	}
	f.mu.Lock()
	key := filepath.ToSlash(rel)
	f.retainedBytes += len(data) - len(f.retained[key])
	_, exists := f.retained[key]
	if len(data) > 8<<20 || f.retainedBytes > 32<<20 || len(f.retained) >= 4096 && !exists {
		f.failure = fmt.Errorf("source manifest size limit exceeded")
	} else {
		f.retained[key] = string(data)
	}
	f.mu.Unlock()
	return data, f.check()
}
func (f *sourceManifestFS) Download(ctx context.Context, obj storage.Object, opts ...storage.Option) ([]byte, error) {
	return f.DownloadWithURL(ctx, obj.URL(), opts...)
}
func (f *sourceManifestFS) OpenURL(ctx context.Context, value string, opts ...storage.Option) (io.ReadCloser, error) {
	if f.retained != nil {
		data, err := f.DownloadWithURL(ctx, value, opts...)
		if err != nil {
			return nil, err
		}
		return io.NopCloser(bytes.NewReader(data)), nil
	}
	name, err := f.location(value)
	if err != nil {
		return nil, err
	}
	return f.Service.OpenURL(ctx, name, opts...)
}
func (f *sourceManifestFS) Open(ctx context.Context, obj storage.Object, opts ...storage.Option) (io.ReadCloser, error) {
	return f.OpenURL(ctx, obj.URL(), opts...)
}
func (f *sourceManifestFS) Exists(ctx context.Context, value string, opts ...storage.Option) (bool, error) {
	name, err := f.location(value)
	if err != nil {
		return false, err
	}
	return f.Service.Exists(ctx, name, opts...)
}
func (f *sourceManifestFS) Object(ctx context.Context, value string, opts ...storage.Option) (storage.Object, error) {
	name, err := f.location(value)
	if err != nil {
		return nil, err
	}
	return f.Service.Object(ctx, name, opts...)
}
func (f *sourceManifestFS) List(ctx context.Context, value string, opts ...storage.Option) ([]storage.Object, error) {
	name, err := f.location(value)
	if err != nil {
		return nil, err
	}
	return f.Service.List(ctx, name, opts...)
}
