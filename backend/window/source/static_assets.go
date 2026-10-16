// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sync"

	wsmeta "github.com/viant/forge/backend/window/source/internal/meta"
)

// StaticAssetCompilation is owned by one serialized static source compilation.
// It contains parsed authored assets only, never actors, grants or result rows.
// The host must discard it at the end of the confined source generation.
type StaticAssetCompilation struct {
	mu         sync.Mutex
	root       string
	catalog    *workspaceCatalog
	hydrations uint64
}

func NewStaticAssetCompilation() *StaticAssetCompilation { return &StaticAssetCompilation{} }
func (s *StaticAssetCompilation) HydrationCount() uint64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.hydrations
}
func (s *StaticAssetCompilation) load(ctx context.Context, root string, svc *wsmeta.Service) (*workspaceCatalog, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.catalog != nil {
		if s.root != root {
			return nil, fmt.Errorf("static asset compilation cannot cross source roots")
		}
		return s.catalog, nil
	}
	catalog, err := loadWorkspaceCatalog(ctx, svc)
	if err != nil {
		return nil, err
	}
	s.catalog = catalog
	s.root = root
	s.hydrations++
	return catalog, nil
}
func cloneStaticValue[T any](value T) (T, error) {
	var clone T
	raw, err := json.Marshal(value)
	if err != nil {
		return clone, err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	err = decoder.Decode(&clone)
	return clone, err
}
func (o LoaderOptions) catalog(ctx context.Context, root string, svc *wsmeta.Service) (*workspaceCatalog, error) {
	if o.SourceCatalog != nil {
		o.SourceCatalog(true)
		defer o.SourceCatalog(false)
	}
	if o.StaticAssets == nil {
		return loadWorkspaceCatalog(ctx, svc)
	}
	parsed, err := o.StaticAssets.load(ctx, root, svc)
	if err != nil {
		return nil, err
	}
	// Resolution only reads the immutable compilation catalog; attachment clones
	// the requested transitive closure, never every unrelated workspace asset.
	return parsed, nil
}
