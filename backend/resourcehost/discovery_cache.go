package resource

import identity "github.com/viant/forge/backend/resource"

const discoveryCacheCapacity = 256

func (g *Gateway) touchDiscovery(key string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if entry, ok := g.cache[key]; ok {
		g.cacheTick++
		entry.lastUsed = g.cacheTick
		g.cache[key] = entry
	}
}

// Caller holds mu. Only completed immutable discovery results live here;
// in-flight discovery coordination is separate and must never be evicted.
func (g *Gateway) storeDiscoveryLocked(key string, result capabilities) {
	if g.cache == nil {
		g.cache = map[string]capabilities{}
	}
	now := g.now()
	for k, entry := range g.cache {
		if !identity.MetadataExpiryValid(discoveryCacheUntil(entry), now) {
			delete(g.cache, k)
		}
	}
	if _, replacing := g.cache[key]; !replacing {
		for len(g.cache) >= discoveryCacheCapacity {
			var victim string
			var oldest uint64
			found := false
			for k, entry := range g.cache {
				if !found || entry.lastUsed < oldest {
					victim, oldest, found = k, entry.lastUsed, true
				}
			}
			delete(g.cache, victim)
		}
	}
	g.cacheTick++
	result.cacheKey, result.lastUsed = key, g.cacheTick
	g.cache[key] = result
}
