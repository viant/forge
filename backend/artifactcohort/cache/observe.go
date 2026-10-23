package cache

import "github.com/viant/forge/backend/provider/contract/observe"

// Fixed trusted phase names; no URI, hash, principal or payload labels.
const (
	PhaseGet       observe.Phase = "artifact.cache.get"
	PhasePut       observe.Phase = "artifact.cache.put"
	PhaseHas       observe.Phase = "artifact.cache.has"
	PhaseLookup    observe.Phase = "artifact.cache.scache.lookup"
	PhaseMiss      observe.Phase = "artifact.cache.miss"
	PhaseInflate   observe.Phase = "artifact.cache.gzip.inflate"
	PhaseDecode    observe.Phase = "artifact.cache.bintly.decode"
	PhaseFileLoad  observe.Phase = "artifact.cache.file.load"
	PhaseFileStore observe.Phase = "artifact.cache.file.store"
)

var cacheLabels = observe.Labels{Kind: "artifact"}
