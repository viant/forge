package primitive

import "encoding/json"

// NamespaceSyncCapability advertises the startup protocol without exposing the
// host-only policy catalog to ordinary namespace discovery clients.
type NamespaceSyncCapability struct {
	Version     int    `json:"version"`
	Method      string `json:"method"`
	FetchMethod string `json:"fetchMethod"`
}

// NamespaceSyncRequest is an explicit host startup/background operation, never
// an interactive metadata miss. Artifact payloads use the separately advertised
// immutable fetch method instead of inflating ordinary namespace responses.
type NamespaceSyncRequest struct {
	KnownHash string `json:"knownHash,omitempty"`
}

// NamespaceSyncResult preserves the producer's exact JSON bytes. Catalog
// contains the complete cohort/policy manifest or compact unchanged response;
// FetchMethod names the exact immutable artifact download method.
type NamespaceSyncResult struct {
	Catalog     json.RawMessage `json:"catalog,omitempty"`
	FetchMethod string          `json:"fetchMethod"`
}
