// SPDX-License-Identifier: Apache-2.0
// Resource host implementation extracted from Viant Agently Core.
package resource

import (
	"context"
	"encoding/json"
	"fmt"
	workspacewindow "github.com/viant/forge/backend/window/source"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

type materializationFileMetadata struct {
	info  os.FileInfo
	size  int64
	mtime time.Time
	ctime string
}

func metadataOf(info os.FileInfo) materializationFileMetadata {
	change := ""
	value := reflect.ValueOf(info.Sys())
	if value.IsValid() {
		if value.Kind() == reflect.Pointer {
			value = value.Elem()
		}
		if value.IsValid() && value.Kind() == reflect.Struct {
			for _, field := range []string{"Ctim", "Ctimespec"} {
				stamp := value.FieldByName(field)
				if stamp.IsValid() && stamp.CanInterface() {
					change = fmt.Sprint(stamp.Interface())
					break
				}
			}
		}
	}
	return materializationFileMetadata{info: info, size: info.Size(), mtime: info.ModTime(), ctime: change}
}
func (a materializationFileMetadata) same(info os.FileInfo) bool {
	b := metadataOf(info)
	return os.SameFile(a.info, info) && a.info.Mode() == info.Mode() && a.size == b.size && a.mtime.Equal(b.mtime) && a.ctime == b.ctime
}

func nativeMetadataMatches(name string, expected materializationFileMetadata, info os.FileInfo) bool {
	if name == "." {
		return os.SameFile(expected.info, info) && expected.info.Mode() == info.Mode()
	}
	return expected.same(info)
}

// InternalProviderIdentity is transport provenance, not a namespace default.
const InternalProviderIdentity = "internal"

// ExtensionLoader materializes the native definition (including its imports or
// package files) through reader. It must omit credentials and execution secrets.
// It receives a trusted inventory path, never a caller-selected path. Windows
// must retain their target bundle; intents, templates and skills retain their
// native schemas. Validators remain mandatory in LocalConfig.
type ExtensionLoader func(context.Context, *ExtensionReader, string) (json.RawMessage, error)

// ExtensionDirectory explicitly binds a folder to a logical namespace. Multiple
// directories may contribute to one namespace; collisions are errors, never an
// order-dependent override. Suffixes identify definition entry points, such as
// .yaml/.yml or /SKILL.md. A package suffix uses its containing folder as name.
type ExtensionDirectory struct {
	Kind               string
	Namespace          string
	Directory          string
	FormatVersion      int64
	Suffixes           []string
	ExcludeDirectories []string
	FallbackDirectory  string
	// IncludeFile optionally distinguishes definition entry points from support
	// files sharing the same suffix. It runs through the confined reader before
	// a file receives a resource identity; nil retains suffix-only discovery.
	IncludeFile func(context.Context, *ExtensionReader, string) (bool, error)
	Load        ExtensionLoader
}

// ExtensionReader confines native loader reads to a trusted workspace directory.
// It deliberately exposes no absolute path, write API or unconstrained fs.FS.
// Import paths use slash-separated canonical relative paths.
type extensionDirectoryRoot struct {
	root *os.Root
	info os.FileInfo
}
type ExtensionReader struct {
	windowAssets *workspacewindow.StaticAssetCompilation
	root         *os.Root
	anchorInfo   os.FileInfo
	mu           sync.Mutex
	directories  map[string]extensionDirectoryRoot
	dependencies map[string]os.FileInfo
}

func extensionPath(value string) bool {
	return value != "" && value != "." && fs.ValidPath(value) && !strings.ContainsAny(value, "\\:\x00")
}

// parent validates every live directory binding, including symlinks and inode
// replacement. Retained handles avoid reopening all prefix ancestors for every
// Lstat; no file bytes or authorization decisions are cached. A directory change
// invalidates this materialization rather than returning bytes from its old FD.
func (r *ExtensionReader) parent(name string) (*os.Root, string, os.FileInfo, error) {
	if r == nil || r.root == nil || !extensionPath(name) {
		return nil, "", nil, identity.ErrResourceDenied
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.anchorInfo == nil {
		var err error
		r.anchorInfo, err = r.root.Stat(".")
		if err != nil {
			return nil, "", nil, err
		}
	}
	currentAnchor, err := os.Stat(r.root.Name())
	if err != nil {
		return nil, "", nil, err
	}
	if !os.SameFile(r.anchorInfo, currentAnchor) {
		return nil, "", nil, identity.ErrResourceStale
	}
	if r.dependencies == nil {
		r.dependencies = map[string]os.FileInfo{}
	}
	if err := r.recordDependency(".", currentAnchor); err != nil {
		return nil, "", nil, err
	}
	if r.directories == nil {
		r.directories = map[string]extensionDirectoryRoot{}
	}
	parts := strings.Split(name, "/")
	current := r.root
	prefix := ""
	for i, segment := range parts {
		info, err := current.Lstat(segment)
		if err != nil {
			return nil, "", nil, err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return nil, "", nil, identity.ErrResourceDenied
		}
		if i == len(parts)-1 {
			if err := r.recordDependency(name, info); err != nil {
				return nil, "", nil, err
			}
			return current, segment, info, nil
		}
		if !info.IsDir() {
			return nil, "", nil, identity.ErrResourceDenied
		}
		if prefix == "" {
			prefix = segment
		} else {
			prefix += "/" + segment
		}
		if err := r.recordDependency(prefix, info); err != nil {
			return nil, "", nil, err
		}
		entry, ok := r.directories[prefix]
		if ok {
			if !os.SameFile(info, entry.info) {
				return nil, "", nil, identity.ErrResourceStale
			}
		} else {
			child, err := current.OpenRoot(segment)
			if err != nil {
				return nil, "", nil, err
			}
			actual, err := child.Stat(".")
			if err != nil || !os.SameFile(info, actual) {
				child.Close()
				return nil, "", nil, identity.ErrResourceStale
			}
			entry = extensionDirectoryRoot{root: child, info: actual}
			r.directories[prefix] = entry
		}
		current = entry.root
	}
	return nil, "", nil, identity.ErrResourceDenied
}

// Called with mu held: retain FIRST metadata, never relabel older bytes with
// a later observed dependency generation.
func (r *ExtensionReader) recordDependency(name string, info os.FileInfo) error {
	if previous, ok := r.dependencies[name]; ok {
		if !nativeMetadataMatches(name, metadataOf(previous), info) {
			return identity.ErrResourceStale
		}
		return nil
	}
	r.dependencies[name] = info
	return nil
}
func (r *ExtensionReader) check(name string) error { _, _, _, err := r.parent(name); return err }
func (r *ExtensionReader) close() {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for key, entry := range r.directories {
		entry.root.Close()
		delete(r.directories, key)
	}
}

// ReadFile rejects links and special files. os.Root also confines a symlink
// replacement between the checks and open, including an escaping parent link.
func (r *ExtensionReader) ReadFile(ctx context.Context, name string) ([]byte, error) {
	if ctx == nil || ctx.Err() != nil {
		return nil, identity.ErrResourceDenied
	}
	parent, leaf, expected, err := r.parent(name)
	if err != nil {
		return nil, err
	}
	if !expected.Mode().IsRegular() {
		return nil, identity.ErrResourceDenied
	}
	file, err := parent.Open(leaf)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return nil, identity.ErrResourceDenied
	}
	if !metadataOf(expected).same(info) {
		return nil, identity.ErrResourceStale
	}
	// Bound the definition/package read before allocating; this is not a general
	// purpose file server. Native loaders may read multiple bounded package files.
	const maxFileBytes = 16 << 20
	if info.Size() > maxFileBytes {
		return nil, fmt.Errorf("extension file too large")
	}
	data, err := io.ReadAll(io.LimitReader(file, maxFileBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxFileBytes {
		return nil, fmt.Errorf("extension file too large")
	}
	_, _, current, err := r.parent(name)
	if err != nil {
		return nil, err
	}
	if !metadataOf(info).same(current) {
		return nil, identity.ErrResourceStale
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return data, nil
}

type extensionSource struct {
	root, file, uri string
	rootInfo        os.FileInfo
	load            ExtensionLoader
}

func (s *extensionSource) read(ctx context.Context, uri identity.ResourceURI) (json.RawMessage, error) {
	if ctx == nil || ctx.Err() != nil || uri.String() != s.uri {
		return nil, identity.ErrResourceDenied
	}
	root, err := os.OpenRoot(s.root)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	anchorInfo, err := root.Stat(".")
	if err != nil {
		return nil, err
	}
	if s.rootInfo != nil && !os.SameFile(s.rootInfo, anchorInfo) {
		return nil, identity.ErrResourceStale
	}
	reader := &ExtensionReader{root: root}
	defer reader.close()
	if err := reader.check(s.file); err != nil {
		return nil, err
	}
	raw, err := s.load(ctx, reader, s.file)
	if err != nil {
		return nil, err
	}
	if !json.Valid(raw) {
		return nil, fmt.Errorf("native extension loader returned invalid JSON")
	}
	if err := reader.check(s.file); err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return append(json.RawMessage(nil), raw...), nil
}
func (s *extensionSource) Candidates(ctx context.Context, uri identity.ResourceURI) ([]identity.ResourceCandidate, error) {
	raw, err := s.read(ctx, uri)
	if err != nil {
		return nil, err
	}
	return []identity.ResourceCandidate{{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint(raw)}}, nil
}
func (s *extensionSource) ReadCandidate(ctx context.Context, uri identity.ResourceURI, candidate identity.ResourceCandidate) (json.RawMessage, error) {
	if !candidate.Valid() || candidate.Kind != identity.WorkingCandidate {
		return nil, identity.ErrResourceDenied
	}
	raw, err := s.read(ctx, uri)
	if err != nil {
		return nil, err
	}
	if identity.ContentFingerprint(raw) != candidate.ContentFingerprint {
		return nil, identity.ErrResourceStale
	}
	return raw, nil
}

// ExtensionBindings indexes configured folders once. Bytes are loaded afresh on
// every candidate/read, without a DB stamp or shared user cache. A host rebuilds
// the inventory to add/remove definitions, then atomically replaces its provider.
// This grants no authority: both namespace authorizer and revision policy remain
// trusted host responsibilities. Missing configured folders fail closed.
func ExtensionBindings(ctx context.Context, rootPath string, directories []ExtensionDirectory, policy LocalRevisionPolicyFactory) ([]LocalResourceBinding, error) {
	return extensionBindings(ctx, rootPath, directories, policy, nil)
}

func extensionBindings(ctx context.Context, rootPath string, directories []ExtensionDirectory, policy LocalRevisionPolicyFactory, definitions *[]NativeSnapshotDefinition) ([]LocalResourceBinding, error) {
	if ctx == nil || ctx.Err() != nil || strings.TrimSpace(rootPath) == "" || len(directories) == 0 || policy == nil {
		return nil, fmt.Errorf("extension inventory requires root, directories and revision policy")
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
	indexed := map[string]LocalResourceBinding{}
	for _, directory := range directories {
		probe := identity.ResourceURI{Kind: directory.Kind, Namespace: directory.Namespace, Name: "probe"}
		if !probe.Valid() || primitive.Plural(directory.Kind) == "" || !extensionPath(directory.Directory) || directory.FormatVersion < 1 || directory.Load == nil {
			return nil, fmt.Errorf("invalid extension directory")
		}
		suffixes := append([]string(nil), directory.Suffixes...)
		if len(suffixes) == 0 {
			suffixes = []string{".yaml", ".yml"}
		}
		for _, suffix := range suffixes {
			if suffix == "" || strings.ContainsAny(suffix, "\\:\x00") || strings.Contains(suffix, "..") || suffix[0] != '.' && suffix[0] != '/' {
				return nil, fmt.Errorf("invalid extension definition suffix")
			}
		}
		sort.Slice(suffixes, func(i, j int) bool {
			if len(suffixes[i]) != len(suffixes[j]) {
				return len(suffixes[i]) > len(suffixes[j])
			}
			return suffixes[i] < suffixes[j]
		})
		if err := reader.check(directory.Directory); err != nil {
			return nil, err
		}
		info, err := root.Stat(directory.Directory)
		if err != nil {
			return nil, err
		}
		if !info.IsDir() {
			return nil, fmt.Errorf("extension directory must be a directory")
		}
		if directory.FallbackDirectory != "" && !extensionPath(directory.FallbackDirectory) {
			return nil, identity.ErrResource
		}
		for _, excluded := range directory.ExcludeDirectories {
			if !extensionPath(excluded) {
				return nil, identity.ErrResource
			}
		}
		err = fs.WalkDir(root.FS(), directory.Directory, func(file string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.IsDir() {
				relative := strings.TrimPrefix(file, directory.Directory+"/")
				for _, excluded := range directory.ExcludeDirectories {
					if relative == excluded {
						return fs.SkipDir
					}
				}
			}
			if err := ctx.Err(); err != nil {
				return err
			}
			if entry.Type()&os.ModeSymlink != 0 {
				return fmt.Errorf("extension inventory rejects symbolic links")
			}
			if entry.IsDir() {
				return nil
			}
			info, err := entry.Info()
			if err != nil {
				return err
			}
			if !info.Mode().IsRegular() {
				return fmt.Errorf("extension inventory rejects special files")
			}
			relative := strings.TrimPrefix(file, directory.Directory+"/")
			name := ""
			for _, suffix := range suffixes {
				if strings.HasSuffix(relative, suffix) {
					name = strings.TrimSuffix(relative, suffix)
					break
				}
			}
			if name == "" {
				return nil
			}
			if directory.IncludeFile != nil {
				include, err := directory.IncludeFile(ctx, reader, file)
				if err != nil {
					return err
				}
				if !include {
					return nil
				}
			}
			if directory.FallbackDirectory != "" {
				for _, suffix := range suffixes {
					existing := path.Join(directory.FallbackDirectory, name+suffix)
					if _, e := root.Stat(existing); e == nil {
						return nil
					} else if !os.IsNotExist(e) {
						return e
					}
				}
			}
			uri := identity.ResourceURI{Kind: directory.Kind, Namespace: directory.Namespace, Name: name}
			if !uri.Valid() {
				return fmt.Errorf("invalid extension resource path")
			}
			if _, exists := indexed[uri.String()]; exists {
				return fmt.Errorf("duplicate extension resource %s", uri.String())
			}
			if definitions != nil {
				*definitions = append(*definitions, NativeSnapshotDefinition{URI: uri.String(), Title: path.Base(name), FormatVersion: directory.FormatVersion, File: file, Load: directory.Load})
			}
			source := &extensionSource{rootInfo: rootInfo, root: rootPath, file: file, uri: uri.String(), load: directory.Load}
			binding := LocalResourceBinding{URI: uri.String(), Title: path.Base(name), FormatVersion: directory.FormatVersion}
			binding.Resolver = func(ctx context.Context, actor identity.VerifiedActor, action string) (*identity.ResourceResolver, error) {
				revisionPolicy, err := policy(ctx, actor, uri, action)
				if err != nil {
					return nil, err
				}
				if revisionPolicy == nil {
					return nil, identity.ErrResourceDenied
				}
				return &identity.ResourceResolver{ProviderIdentity: InternalProviderIdentity, Source: source, Policy: revisionPolicy}, nil
			}
			indexed[uri.String()] = binding
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	names := make([]string, 0, len(indexed))
	for name := range indexed {
		names = append(names, name)
	}
	sort.Strings(names)
	bindings := make([]LocalResourceBinding, 0, len(names))
	for _, name := range names {
		bindings = append(bindings, indexed[name])
	}
	return bindings, nil
}

// NewInternalProvider binds the confined inventory to the ordinary local MCP
// provider. Identity always remains internal while declared namespaces survive.
func NewInternalProvider(ctx context.Context, root string, directories []ExtensionDirectory, policy LocalRevisionPolicyFactory, config LocalConfig) (*LocalProvider, error) {
	if config.ProviderIdentity != "" && config.ProviderIdentity != InternalProviderIdentity || len(config.Bindings) != 0 {
		return nil, fmt.Errorf("internal provider requires its own inventory")
	}
	bindings, err := ExtensionBindings(ctx, root, directories, policy)
	if err != nil {
		return nil, err
	}
	config.ProviderIdentity, config.Bindings = InternalProviderIdentity, bindings
	return NewLocalProvider(config)
}

// SnapshotExtensionDefinitions inventories declared deterministic native loaders
// once. It carries no policy; the provider supplies admission for the snapshot.
func SnapshotExtensionDefinitions(ctx context.Context, root string, directories []ExtensionDirectory) ([]NativeSnapshotDefinition, error) {
	var definitions []NativeSnapshotDefinition
	_, err := extensionBindings(ctx, root, directories, func(context.Context, identity.VerifiedActor, identity.ResourceURI, string) (identity.ResourceRevisionPolicy, error) {
		return nil, nil
	}, &definitions)
	return definitions, err
}
