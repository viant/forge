// SPDX-License-Identifier: Apache-2.0
// Forge resource client pooling extracted from Viant Agently Core.
package manager

import (
	"bytes"
	"context"
	"encoding/json"
	"sort"

	primitive "github.com/viant/forge/backend/provider/contract"
)

type visibleCatalogRepresentation struct {
	ready chan struct{}
	value any
}

// VisibleCatalogRepresentation retains validated immutable representations
// inside the existing namespace entry. codec is an explicit trusted schema ID,
// never a function-pointer identity or a target-dependent request closure.
func (m *Manager) VisibleCatalogRepresentation(ctx context.Context, key, entryKey, codec string, parse func(json.RawMessage) (any, error)) (any, error) {
	if ctx == nil || codec == "" || parse == nil {
		return nil, primitive.ErrCatalogCursor
	}
	for {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		m.mu.Lock()
		slot := m.visibleCatalogs[key]
		if slot == nil {
			m.mu.Unlock()
			return nil, primitive.ErrCatalogCursor
		}
		index := sort.Search(len(slot.entries), func(i int) bool { return slot.entries[i].key >= entryKey })
		if index >= len(slot.entries) || slot.entries[index].key != entryKey {
			m.mu.Unlock()
			return nil, primitive.ErrCatalogCursor
		}
		entry := slot.entries[index]
		if entry.representations == nil {
			entry.representations = map[string]*visibleCatalogRepresentation{}
		}
		existing := entry.representations[codec]
		if existing != nil {
			if existing.ready != nil {
				ready := existing.ready
				m.mu.Unlock()
				select {
				case <-ready:
					continue
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}
			result := existing.value
			m.mu.Unlock()
			return result, nil
		}
		pending := &visibleCatalogRepresentation{ready: make(chan struct{})}
		entry.representations[codec] = pending
		raw := bytes.Clone(entry.value)
		m.mu.Unlock()
		value, err := parse(raw)
		if err == nil {
			err = ctx.Err()
		}
		m.mu.Lock()
		if m.visibleCatalogs[key] != slot && err == nil {
			err = primitive.ErrCatalogCursor
		}
		if err == nil {
			pending.value = value
		} else {
			delete(entry.representations, codec)
		}
		close(pending.ready)
		pending.ready = nil
		m.mu.Unlock()
		return value, err
	}
}
