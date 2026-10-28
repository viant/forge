package resource

import (
	"context"
	"encoding/json"
	"sort"
	"strconv"
)

// PublishedMetadataGeneration is an optional local partition fence. Sources
// without it deliberately disable request-local definition memo reuse; omission
// must never let an old definition survive a notification the source observed.
type PublishedMetadataGeneration interface {
	MetadataGeneration(context.Context, string) (string, error)
}

func (r *MCPReferenceReader) publishedDefinitionGeneration(ctx context.Context) string {
	sources := r.gateway.publishedRegistrations()
	if len(sources) == 0 {
		return ""
	}
	sort.Slice(sources, func(i, j int) bool { return sources[i].connection.Name < sources[j].connection.Name })
	type stamp struct{ Connection, Provider, Admission, Generation string }
	stamps := make([]stamp, 0, len(sources))
	for _, source := range sources {
		admission, err := source.source.AdmissionKey(ctx)
		generation := ""
		versioned, ok := source.source.(PublishedMetadataGeneration)
		if err == nil && admission != "" && ok {
			generation, err = versioned.MetadataGeneration(ctx, "mcp")
		}
		if err != nil || admission == "" || !ok || generation == "" {
			// Generation APIs return strings, not errors. A unique local miss key
			// forces the next Load through its actual source/admission boundary.
			r.memoMu.Lock()
			r.localGenerationNonce++
			nonce := r.localGenerationNonce
			r.memoMu.Unlock()
			generation = "unavailable:" + strconv.FormatUint(nonce, 10)
		}
		stamps = append(stamps, stamp{source.connection.Name, source.connection.ProviderIdentity, admission, generation})
	}
	raw, _ := json.Marshal(stamps)
	return "|published:" + string(raw)
}
