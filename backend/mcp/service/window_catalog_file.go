package service

import (
	"bytes"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/viant/afs"
	"github.com/viant/forge/backend/service/meta"
	"gopkg.in/yaml.v3"
)

// LoadWindowCatalog reads the host's explicit allowlist, not caller input.
// Relative baseURL values are resolved beside the catalog file.
func LoadWindowCatalog(filename string, options ...WindowCatalogOption) (*MetadataWindowCatalog, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("read window catalog: %w", err)
	}
	var manifest struct {
		BaseURL string        `yaml:"baseURL"`
		Windows []SavedWindow `yaml:"windows"`
	}
	decoder := yaml.NewDecoder(bytes.NewReader(data))
	decoder.KnownFields(true)
	if err = decoder.Decode(&manifest); err != nil {
		return nil, fmt.Errorf("decode window catalog: %w", err)
	}
	var extra any
	if err = decoder.Decode(&extra); err != io.EOF {
		return nil, fmt.Errorf("window catalog must contain one YAML document")
	}
	root := strings.TrimSpace(manifest.BaseURL)
	if root == "" {
		return nil, fmt.Errorf("window catalog requires baseURL")
	}
	if !strings.Contains(root, "://") && !filepath.IsAbs(root) {
		root, err = filepath.Abs(filepath.Join(filepath.Dir(filename), root))
		if err != nil {
			return nil, err
		}
	}
	if !strings.Contains(root, "://") {
		root = (&url.URL{Scheme: "file", Path: filepath.ToSlash(root)}).String()
	}
	return NewMetadataWindowCatalog(meta.New(afs.New(), root), root, manifest.Windows, options...)
}
