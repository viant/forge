// SPDX-License-Identifier: Apache-2.0
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	primitive "github.com/viant/forge/backend/provider/contract"
	"strings"
	"sync"

	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
)

// PublishedCodec describes a pure representation of already validated immutable
// publication bytes. ID must distinguish its type and all decode options. Decode
// may use context for cancellation/tracing, never caller-dependent projection.
// Mutable representations require Clone; Immutable is an explicit host promise
// that no caller will mutate the returned value or anything reachable from it.
type PublishedCodec[T any] struct {
	ID        string
	Decode    func(context.Context, string, json.RawMessage) (T, error)
	Clone     func(T) (T, error)
	Immutable bool
	// ExpectedVersion fences exact published dependency references. Leave zero
	// to read the ordinary selected content by its fingerprint.
	ExpectedVersion uint64
	// CaptureVersion projects the selected producer version when the source
	// publishes versioned roots.
	CaptureVersion bool
	// FenceSnapshot lets a composed read check its original source admission
	// after all of its dependent published reads complete.
	FenceSnapshot bool
}
type PublishedValue[T any] struct {
	Value    T
	Resource *identity.ResolvedResource
	// Metadata contains detached publication headers, without definition bodies.
	Metadata       *primitive.ResourceState
	MenuProjection *primitive.MenuProjection
	Version        uint64
	VerifySnapshot func(context.Context) error
}
type publishedCompiledKey struct{ provider, uri, hash, codec, admission string }
type publishedCompiledEntry struct {
	ready      chan struct{}
	value      any
	err        error
	immutable  bool
	bytes      int
	metadata   *primitive.ResourceState
	projection *primitive.MenuProjection
}
type publishedCompiledCache struct {
	mu      sync.Mutex
	entries map[publishedCompiledKey]*publishedCompiledEntry
	bytes   int
}

// OwnsPublishedMetadata checks a trusted namespace claim, never permission.
// Adapters may retain their ordinary path only for unclaimed URIs. Errors from
// Load for a claimed namespace are terminal and must never cause fallback.
func (g *Gateway) OwnsPublishedMetadata(uri string) bool {
	if g == nil {
		return false
	}
	parsed, err := identity.ParseResourceURI(uri)
	if err != nil {
		return false
	}
	_, ok := g.publishedNamespace(parsed.Namespace)
	return ok
}
func (g *Gateway) publishedCompiledCache() *publishedCompiledCache {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.publishedCompiled == nil {
		g.publishedCompiled = &publishedCompiledCache{entries: map[publishedCompiledKey]*publishedCompiledEntry{}}
	}
	return g.publishedCompiled
}

// Load selects a current locally admitted root, decodes once per immutable hash
// and codec, then fences the original session/root before release. No operation
// in this loader initiates synchronization. Source-backed navigation resolves
// current origin rows on every call and bypasses the shared representation cache.
// Cache entries hold representations only; authority is selected on every call.
func Load[T any](ctx context.Context, source *Gateway, uriText string, codec PublishedCodec[T]) (out *PublishedValue[T], failure error) {
	if ctx == nil || source == nil || codec.ID == "" || strings.TrimSpace(codec.ID) != codec.ID || codec.Decode == nil || (!codec.Immutable && codec.Clone == nil) {
		return nil, identity.ErrResource
	}
	uri, err := identity.ParseResourceURI(uriText)
	if err != nil {
		return nil, err
	}
	registration, claimed := source.publishedNamespace(uri.Namespace)
	if !claimed {
		return nil, ErrUnavailable
	}
	connection := registration.connection
	connection.Generation = source.generation(connection.Name)
	span := observe.Start(ctx, "artifact.load", observe.Labels{Provider: connection.Name, Kind: uri.Kind})
	status := observe.CacheMiss
	defer func() { span.End(observe.OutcomeFor(failure), status) }()
	actor, err := source.actor(ctx)
	if err != nil {
		return nil, err
	}
	admission, err := registration.source.AdmissionKey(ctx)
	if err != nil {
		return nil, err
	}
	if admission == "" {
		return nil, identity.ErrResourceDenied
	}
	currentHash := registration.source.CurrentHash
	var version uint64
	if codec.ExpectedVersion != 0 || codec.CaptureVersion {
		versioned, ok := registration.source.(interface {
			CurrentVersionHash(context.Context, string) (uint64, string, error)
		})
		if !ok && codec.ExpectedVersion != 0 {
			return nil, identity.ErrResourceDenied
		}
		if ok {
			version = codec.ExpectedVersion
			currentHash = func(ctx context.Context, uri string) (string, error) {
				currentVersion, hash, err := versioned.CurrentVersionHash(ctx, uri)
				if err != nil {
					return "", err
				}
				if currentVersion == 0 || version != 0 && currentVersion != version {
					return "", identity.ErrResourceStale
				}
				version = currentVersion
				return hash, nil
			}
		}
	}
	hash, err := currentHash(ctx, uriText)
	if err != nil {
		return nil, err
	}
	authority, err := publishedAuthority(ctx, actor, registration, uri, hash, admission)
	if err != nil {
		return nil, err
	}
	selected := identity.ResolvedResource{ProviderIdentity: connection.ProviderIdentity, URI: uriText, ResourceCandidate: identity.ResourceCandidate{Kind: identity.PublishedCandidate, ContentFingerprint: hash}, AuthorityBinding: authority, ValidUntil: actor.ValidUntil}
	if !selected.ResourceCandidate.Valid() {
		return nil, identity.ErrResourceDenied
	}
	var cache *publishedCompiledCache
	dynamic := false
	if menus, ok := registration.source.(PublishedParameterizedMenuSource); ok && uri.Kind == "navigation" {
		dynamic, err = menus.MenuSourceBacked(ctx, uriText)
		if err != nil {
			return nil, err
		}
	}
	if !dynamic {
		cache = source.publishedCompiledCache()
	}
	key := publishedCompiledKey{provider: connection.ProviderIdentity, uri: uriText, hash: hash, codec: codec.ID}
	// Navigation bytes are derived from this admitted root set while their
	// immutable source hash can stay identical across callers and selectors.
	if uri.Kind == "navigation" {
		key.admission = admission
	}
	entry := &publishedCompiledEntry{ready: make(chan struct{}), immutable: codec.Immutable}
	found := false
	if cache != nil {
		entry, found, err = cache.entry(ctx, key, codec.Immutable)
		if err != nil {
			return nil, err
		}
	}
	if found {
		status = observe.CacheHit
		select {
		case <-entry.ready:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	} else {
		got, readErr := Get[json.RawMessage](ctx, source, connection, identity.ResourceRef{URI: uriText}, &selected)
		if readErr == nil {
			entry.metadata = publishedMetadataHeader(got.Resource)
			entry.projection = clonePublishedMenu(got.MenuProjection)
			decode := observe.Start(ctx, "artifact.load.decode", observe.Labels{Provider: connection.Name, Kind: uri.Kind})
			entry.value, entry.err = codec.Decode(ctx, uriText, got.Definition)
			decode.End(observe.OutcomeFor(entry.err), observe.CacheMiss)
			entry.bytes = len(got.Definition)
		} else {
			entry.err = readErr
		}
		if cache != nil {
			cache.mu.Lock()
			if entry.err != nil {
				delete(cache.entries, key)
			} else {
				cache.bytes += entry.bytes
				// Eviction drops representations only. In-flight readers keep immutable
				// entry pointers and must still pass their own admission/selection fence.
				if cache.bytes > 32<<20 {
					for oldKey, old := range cache.entries {
						if cache.bytes <= 32<<20 {
							break
						}
						if old == entry {
							continue
						}
						select {
						case <-old.ready:
							delete(cache.entries, oldKey)
							cache.bytes -= old.bytes
						default:
						}
					}
					if cache.bytes > 32<<20 {
						delete(cache.entries, key)
						cache.bytes -= entry.bytes
					}
				}
			}
			close(entry.ready)
			cache.mu.Unlock()
		} else {
			close(entry.ready)
		}
	}
	if entry.err != nil {
		return nil, entry.err
	}
	if entry.immutable != codec.Immutable {
		return nil, identity.ErrResource
	}
	value, ok := entry.value.(T)
	if !ok {
		return nil, identity.ErrResource
	}
	if !codec.Immutable {
		clone := observe.Start(ctx, "artifact.load.clone", observe.Labels{Provider: connection.Name, Kind: uri.Kind})
		value, err = codec.Clone(value)
		clone.End(observe.OutcomeFor(err), observe.CacheHit)
		if err != nil {
			return nil, err
		}
	}
	if err = source.verifyPublishedPin(ctx, connection, selected, currentHash); err != nil {
		return nil, err
	}
	out = &PublishedValue[T]{Value: value, Resource: &selected, Metadata: publishedMetadataHeader(entry.metadata), MenuProjection: clonePublishedMenu(entry.projection), Version: version}
	if codec.FenceSnapshot {
		out.VerifySnapshot = func(ctx context.Context) error {
			if err := ctx.Err(); err != nil {
				return err
			}
			if err := source.final(ctx, actor); err != nil {
				return err
			}
			fresh, err := registration.source.AdmissionKey(ctx)
			if err != nil {
				return err
			}
			if fresh != admission || connection.Generation != source.generation(connection.Name) || !identity.MetadataExpiryValid(selected.ValidUntil, source.now()) {
				return identity.ErrResourceStale
			}
			return nil
		}
	}
	return out, nil
}

func clonePublishedMenu(value *primitive.MenuProjection) *primitive.MenuProjection {
	if value == nil {
		return nil
	}
	copy := *value
	copy.DefinitionBytes = bytes.Clone(value.DefinitionBytes)
	return &copy
}

// Bound retained and in-flight cache slots. A distinct cold key waits only when
// every slot is compiling; existing keys still coalesce on their original slot.
func (c *publishedCompiledCache) entry(ctx context.Context, key publishedCompiledKey, immutable bool) (*publishedCompiledEntry, bool, error) {
	for {
		c.mu.Lock()
		if entry, ok := c.entries[key]; ok {
			c.mu.Unlock()
			return entry, true, nil
		}
		if len(c.entries) < 128 {
			entry := &publishedCompiledEntry{ready: make(chan struct{}), immutable: immutable}
			c.entries[key] = entry
			c.mu.Unlock()
			return entry, false, nil
		}
		evicted := false
		var pending <-chan struct{}
		for oldKey, old := range c.entries {
			select {
			case <-old.ready:
				delete(c.entries, oldKey)
				c.bytes -= old.bytes
				evicted = true
			default:
				if pending == nil {
					pending = old.ready
				}
			}
			if evicted {
				break
			}
		}
		c.mu.Unlock()
		if evicted {
			continue
		}
		select {
		case <-pending:
		case <-ctx.Done():
			return nil, false, ctx.Err()
		}
	}
}

func publishedMetadataHeader(state *primitive.ResourceState) *primitive.ResourceState {
	if state == nil {
		return nil
	}
	copy := *state
	copy.Definition = nil
	copy.DefinitionBytes = nil
	copy.Dependencies = append([]primitive.Dependency(nil), state.Dependencies...)
	copy.SourceManifest = bytes.Clone(state.SourceManifest)
	return &copy
}
