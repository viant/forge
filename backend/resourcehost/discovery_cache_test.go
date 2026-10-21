package resource

import (
	"fmt"
	"testing"
	"time"
)

func TestDiscoveryCacheEvictsOnlyLeastRecentlyUsed(t *testing.T) {
	now := time.Now()
	g := &Gateway{Now: func() time.Time { return now }, discoveryInflight: map[string]*discoveryCall{"pending": {ready: make(chan struct{})}}}
	entry := capabilities{expires: now.Add(time.Minute)}
	for i := 0; i < discoveryCacheCapacity; i++ {
		g.storeDiscoveryLocked(fmt.Sprint(i), entry)
	}
	g.touchDiscovery("0")
	g.storeDiscoveryLocked("new", entry)
	if len(g.cache) != discoveryCacheCapacity {
		t.Fatalf("cache size %d", len(g.cache))
	}
	if _, ok := g.cache["0"]; !ok {
		t.Fatal("recently accessed entry evicted")
	}
	if _, ok := g.cache["1"]; ok {
		t.Fatal("least recently used entry retained")
	}
	for i := 2; i < discoveryCacheCapacity; i++ {
		if _, ok := g.cache[fmt.Sprint(i)]; !ok {
			t.Fatal("unrelated warm entry evicted")
		}
	}
	if g.discoveryInflight["pending"] == nil {
		t.Fatal("pending discovery removed")
	}
	g.storeDiscoveryLocked("0", entry)
	if len(g.cache) != discoveryCacheCapacity {
		t.Fatal("replacement evicted another entry")
	}
}

func TestDiscoveryCachePrunesExpiredAndDoesNotResurrect(t *testing.T) {
	now := time.Now()
	g := &Gateway{Now: func() time.Time { return now }}
	g.storeDiscoveryLocked("expired", capabilities{expires: now.Add(time.Second)})
	g.storeDiscoveryLocked("live", capabilities{expires: now.Add(time.Minute)})
	now = now.Add(2 * time.Second)
	g.storeDiscoveryLocked("next", capabilities{expires: now.Add(time.Minute)})
	g.touchDiscovery("expired")
	if _, ok := g.cache["expired"]; ok {
		t.Fatal("expired result resurrected")
	}
	if len(g.cache) != 2 {
		t.Fatal("unexpired cache entry lost")
	}
	g.Close()
	g.touchDiscovery("live")
	if len(g.cache) != 0 {
		t.Fatal("closed cache entry resurrected")
	}
}
