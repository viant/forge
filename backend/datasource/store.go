// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"sync"

	dsproto "github.com/viant/forge/backend/datasource/contract"
)

// MemoryStore is a minimal thread-safe Store implementation suitable for
// tests and for callers that manage datasources in-process. Production
// wiring loads from extension/forge/datasources/*.yaml via the workspace
// repository; that repository's List() output feeds MemoryStore.Replace.
type MemoryStore struct {
	mu sync.RWMutex
	m  map[string]*dsproto.DataSource
}

func NewMemoryStore() *MemoryStore { return &MemoryStore{m: make(map[string]*dsproto.DataSource)} }

// Put registers a datasource.
func (s *MemoryStore) Put(ds *dsproto.DataSource) {
	if ds == nil || ds.ID == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[ds.ID] = ds
}

// Get fetches a datasource by id.
func (s *MemoryStore) Get(id string) (*dsproto.DataSource, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ds, ok := s.m[id]
	return ds, ok
}

// Replace swaps the full set of datasources atomically.
func (s *MemoryStore) Replace(items []*dsproto.DataSource) {
	next := make(map[string]*dsproto.DataSource, len(items))
	for _, it := range items {
		if it == nil || it.ID == "" {
			continue
		}
		next[it.ID] = it
	}
	s.mu.Lock()
	s.m = next
	s.mu.Unlock()
}

// List returns a snapshot of known datasource ids.
func (s *MemoryStore) List() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.m))
	for k := range s.m {
		out = append(out, k)
	}
	return out
}
