package file

import (
	"bytes"
	"context"
	"fmt"
	"github.com/viant/afs"
	"github.com/viant/afs/file"
	"github.com/viant/afs/storage"
	"github.com/viant/afs/url"
	"path"
	"strings"
)

type (
	// Service is our abstraction that uses github.com/viant/afs
	// to list files from a root.
	Service struct {
		root       string
		showHidden bool
		options    []storage.Option
		service    afs.Service
	}

	// File represents a file or directory item.
	File struct {
		Name       string `json:"name"`
		IsFolder   bool   `json:"isFolder"`
		URI        string `json:"uri"`
		ChildNodes []File `json:"childNodes"`
	}
)

// New creates a new Service.
func New(root string, options ...storage.Option) *Service {
	return &Service{
		root:    root,
		options: options,
		service: afs.New(), // this creates a new default AFS service
	}
}

// List returns the files and directories at requestedPath (relative to Service.root).
func (f *Service) List(ctx context.Context, opts ...Option) ([]File, error) {
	// Build the full path by combining the root and the requested path.
	options := newOptions(opts...)
	uri := options.uri

	parentURL := f.ensureURL(uri)
	if uri == "" {
		parentURL = f.root
	}
	parent, err := f.service.Object(ctx, parentURL)
	if err != nil {
		return nil, err
	}
	parentURL = parent.URL()

	var parts []string
	if uri != "" {
		parts = append(parts, uri)
	}
	URL := url.Join(f.root, parts...)

	// Check if the path actually exists.
	exists, _ := f.service.Exists(ctx, URL)
	if !exists {
		return nil, fmt.Errorf("path %q does not exist", URL)
	}

	objects, err := f.service.List(context.Background(), URL)
	if err != nil {
		return nil, err
	}

	var items []File
	for _, obj := range objects {
		if url.Equals(URL, obj.URL()) {
			continue
		}
		if options.onlyFolder && !obj.IsDir() {
			continue
		}
		name := obj.Name()
		if !f.showHidden && strings.HasPrefix(name, ".") {
			continue
		}
		// Some providers might return full aPath in Name(), so you may want to trim
		// to the last aPath segment.
		name = path.Base(name)

		// Exclude "." or empty strings if they appear in certain filesystems.
		if strings.TrimSpace(name) == "" || name == "." {
			continue
		}

		aPath := obj.URL()[len(parentURL):]

		items = append(items, File{
			Name:     name,
			IsFolder: obj.IsDir(),
			URI:      url.Join(uri, aPath),
		})
	}

	// If uri is empty, we don't need to wrap the items in a parent directory.
	if uri == "" {
		return items, nil
	}
	name := uri
	if strings.HasPrefix(uri, "/") {
		name = uri[1:]
	}
	if strings.Contains(name, "/") {
		_, name = path.Split(name)
	}
	return []File{
		{
			URI:        uri,
			Name:       name,
			ChildNodes: items,
			IsFolder:   true,
		},
	}, nil
}

// Exists checks if a file exists at the specified uri.
func (f *Service) Exists(ctx context.Context, requestedPath string) (bool, error) {
	URL := f.ensureURL(requestedPath)
	return f.service.Exists(ctx, URL, f.options...)
}

// Download downloads a file from the specified uri.
func (f *Service) Download(ctx context.Context, uri string) ([]byte, error) {
	URL := f.ensureURL(uri)
	return f.service.DownloadWithURL(ctx, URL, f.options...)
}

func (f *Service) ensureURL(uri string) string {
	URL := uri
	if url.IsRelative(uri) {
		URL = url.Join(f.root, uri)
	}
	return URL
}

// Upload uploads a file to the specified uri.
func (f *Service) Upload(ctx context.Context, uri string, payload []byte) error {
	URL := url.Join(f.root, uri)
	return f.service.Upload(ctx, URL, file.DefaultFileOsMode, bytes.NewReader(payload), f.options...)
}
