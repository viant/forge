// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package meta

import (
	"context"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/viant/afs"
	"github.com/viant/afs/storage"
	wscodec "github.com/viant/forge/backend/window/source/internal/codec"
	"gopkg.in/yaml.v3"
)

// Service provides minimal meta loading and listing with a base directory.
type Service struct {
	fs      afs.Service
	base    string
	options []storage.Option
}

// New constructs a meta Service with the given filesystem and base directory/URL.
// Optional storage.Option values (e.g. an *embed.FS) are forwarded to every
// afs call so that scheme-specific managers receive them.
func New(fs afs.Service, base string, options ...storage.Option) *Service {
	return &Service{fs: fs, base: base, options: options}
}

// resolve joins base with a relative path, otherwise returns the path as-is.
func (s *Service) resolve(p string) string {
	if p == "" {
		return s.base
	}
	if strings.Contains(p, "://") || filepath.IsAbs(p) {
		return p
	}
	if strings.TrimSpace(s.base) == "" {
		return p
	}
	// When base is a URL, prefer URL-style join to avoid OS path quirks.
	if strings.Contains(s.base, "://") {
		base := strings.TrimRight(s.base, "/")
		rel := strings.TrimLeft(p, "/")
		return base + "/" + rel
	}
	return filepath.Join(s.base, p)
}

// Load reads URL and unmarshals into v. Supports *yaml.Node or a struct pointer.
func (s *Service) Load(ctx context.Context, URL string, v interface{}) error {
	URL = s.resolve(URL)
	if _, ok := v.(*yaml.Node); ok {
		if err := wscodec.DecodeURL(ctx, s.fs, URL, v, s.options...); err != nil {
			return err
		}
		if node, ok := v.(*yaml.Node); ok {
			return ResolveImports(ctx, s.fs, node, importBaseDir(URL), s.options...)
		}
		return nil
	}
	var node yaml.Node
	if err := wscodec.DecodeURL(ctx, s.fs, URL, &node, s.options...); err != nil {
		return err
	}
	if err := ResolveImports(ctx, s.fs, &node, importBaseDir(URL), s.options...); err != nil {
		return err
	}
	return node.Decode(v)
}

// List returns YAML candidates under a directory or the file itself when URL points to a file.
func (s *Service) List(ctx context.Context, URL string) ([]string, error) {
	URL = s.resolve(URL)
	if ext := strings.ToLower(path.Ext(URL)); ext == ".yaml" || ext == ".yml" {
		return []string{URL}, nil
	}
	objs, err := s.fs.List(ctx, URL, s.options...)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, o := range objs {
		if o.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(o.Name()))
		if ext == ".yaml" || ext == ".yml" {
			out = append(out, s.resolve(filepath.Join(URL, filepath.Base(o.Name()))))
		}
	}
	return out, nil
}

// ListRecursive returns all YAML candidates below a directory. Unlike List,
// it preserves subdirectory paths so callers can organize resources by domain.
func (s *Service) ListRecursive(ctx context.Context, URL string) ([]string, error) {
	URL = s.resolve(URL)
	if ext := strings.ToLower(path.Ext(URL)); ext == ".yaml" || ext == ".yml" {
		return []string{URL}, nil
	}
	var out []string
	seenFiles := map[string]bool{}
	visitedDirs := map[string]bool{}
	if err := s.listRecursive(ctx, URL, &out, seenFiles, visitedDirs); err != nil {
		return nil, err
	}
	sort.Strings(out)
	return out, nil
}

func (s *Service) listRecursive(ctx context.Context, URL string, out *[]string, seenFiles, visitedDirs map[string]bool) error {
	normalizedURL := normalizeResourcePath(URL)
	if visitedDirs[normalizedURL] {
		return nil
	}
	visitedDirs[normalizedURL] = true
	objects, err := s.fs.List(ctx, URL, s.options...)
	if err != nil {
		return err
	}
	for _, object := range objects {
		if err := ctx.Err(); err != nil {
			return err
		}
		candidate := object.URL()
		if sameResourcePath(URL, candidate) {
			continue
		}
		if object.IsDir() {
			if err := s.listRecursive(ctx, candidate, out, seenFiles, visitedDirs); err != nil {
				return err
			}
			continue
		}
		ext := strings.ToLower(filepath.Ext(object.Name()))
		normalizedCandidate := normalizeResourcePath(candidate)
		if (ext == ".yaml" || ext == ".yml") && !seenFiles[normalizedCandidate] {
			*out = append(*out, candidate)
			seenFiles[normalizedCandidate] = true
		}
	}
	return nil
}

func sameResourcePath(left, right string) bool {
	return normalizeResourcePath(left) == normalizeResourcePath(right)
}

func normalizeResourcePath(candidate string) string {
	candidate = strings.TrimPrefix(candidate, "file://localhost")
	candidate = strings.TrimPrefix(candidate, "file://")
	return filepath.Clean(filepath.FromSlash(candidate))
}

// Exists checks if the resolved URL exists.
func (s *Service) Exists(ctx context.Context, URL string) (bool, error) {
	return s.fs.Exists(ctx, s.resolve(URL), s.options...)
}

// Download returns the raw bytes for the resolved URL.
func (s *Service) Download(ctx context.Context, URL string) ([]byte, error) {
	return s.fs.DownloadWithURL(ctx, s.resolve(URL), s.options...)
}

// GetURL returns the resolved absolute URL/path for a possibly relative path.
func (s *Service) GetURL(p string) string { return s.resolve(p) }
