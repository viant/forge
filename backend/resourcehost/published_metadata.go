// SPDX-License-Identifier: Apache-2.0
package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"sort"
	"strings"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
)

// PublishedMetadataSource reads a preloaded, locally admitted namespace. Methods
// must fail closed after revocation or stale synchronization and never use a
// remote metadata fallback. This is a trusted host boundary: the producer
// validates publication and the replica verifies hashes during synchronization.
// Returned states and bytes are request-owned and already match their declared
// fingerprint; Gateway does not revalidate their bodies. Data execution is
// outside this contract.
type PublishedMetadataSource interface {
	// AdmissionKey identifies the current verified session and locally admitted
	// source/policy generation. It performs no remote read or policy evaluation.
	AdmissionKey(context.Context) (string, error)
	Namespaces(context.Context) ([]primitive.NamespaceCapabilities, error)
	List(context.Context, string, string) ([]primitive.ResourceState, error)
	Get(context.Context, string) (*primitive.ResourceState, error)
	// CurrentHash fences an immutable selection using local admission and active
	// root pointers only, without hydrating or decoding the artifact body.
	CurrentHash(context.Context, string) (string, error)
}
type publishedMetadataRegistration struct {
	connection Connection
	namespaces map[string]bool
	source     PublishedMetadataSource
	aliases    map[string]bool
}

// RegisterPublishedMetadataSource is trusted setup before serving requests.
// Claims remain authoritative even when the source subsequently loses a root.
func (g *Gateway) RegisterPublishedMetadataSource(connection Connection, namespaces []string, source PublishedMetadataSource, aliases ...string) error {
	if g == nil || source == nil || reflect.ValueOf(source).Kind() == reflect.Pointer && reflect.ValueOf(source).IsNil() || connection.Name == "" || connection.ProviderIdentity == "" || connection.ProviderIdentity == g.GatewayProviderIdentity || len(namespaces) == 0 {
		return identity.ErrResource
	}
	names := map[string]bool{connection.Name: true}
	if strings.TrimSpace(connection.Name) != connection.Name {
		return identity.ErrResource
	}
	for _, alias := range aliases {
		if alias == "" || strings.TrimSpace(alias) != alias {
			return identity.ErrResource
		}
		if names[alias] {
			return ErrCollision
		}
		names[alias] = true
	}
	claims := map[string]bool{}
	for _, namespace := range namespaces {
		if namespace == "" || strings.TrimSpace(namespace) != namespace || strings.ContainsAny(namespace, "/:?#") || claims[namespace] {
			return identity.ErrResource
		}
		claims[namespace] = true
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.closed {
		return identity.ErrResourceDenied
	}
	for _, registered := range g.publishedMetadata {
		if registered.connection.ProviderIdentity == connection.ProviderIdentity {
			return ErrCollision
		}
		for name := range names {
			if registered.matchesName(name) {
				return ErrCollision
			}
		}
		for namespace := range claims {
			if registered.namespaces[namespace] {
				return ErrCollision
			}
		}
	}
	connection.Generation = g.generations[connection.Name]
	g.publishedMetadata = append(g.publishedMetadata, publishedMetadataRegistration{connection: connection, namespaces: claims, source: source, aliases: names})
	return nil
}
func (g *Gateway) publishedRegistrations() []publishedMetadataRegistration {
	g.mu.Lock()
	defer g.mu.Unlock()
	return append([]publishedMetadataRegistration(nil), g.publishedMetadata...)
}
func (g *Gateway) publishedByName(name string) (publishedMetadataRegistration, bool) {
	for _, source := range g.publishedRegistrations() {
		if source.matchesName(name) {
			return source, true
		}
	}
	return publishedMetadataRegistration{}, false
}
func (g *Gateway) publishedNamespace(namespace string) (publishedMetadataRegistration, bool) {
	for _, source := range g.publishedRegistrations() {
		if source.namespaces[namespace] {
			return source, true
		}
	}
	return publishedMetadataRegistration{}, false
}
func (g *Gateway) publishedForURI(connection Connection, uri identity.ResourceURI) (publishedMetadataRegistration, bool, error) {
	for _, source := range g.publishedRegistrations() {
		if source.namespaces[uri.Namespace] {
			if !source.matchesName(connection.Name) || connection.ProviderIdentity != source.connection.ProviderIdentity || connection.Generation != g.generation(connection.Name) {
				return source, true, identity.ErrResourceDenied
			}
			return source, true, nil
		}
	}
	if _, ok := g.publishedByName(connection.Name); ok {
		return publishedMetadataRegistration{}, true, identity.ErrResourceDenied
	}
	return publishedMetadataRegistration{}, false, nil
}
func (g *Gateway) publishedCapabilities(ctx context.Context, source publishedMetadataRegistration, names ...string) (capabilities, error) {
	namespaces, err := source.source.Namespaces(ctx)
	if err != nil {
		return capabilities{}, err
	}
	seen := map[string]bool{}
	for _, namespace := range namespaces {
		if !source.namespaces[namespace.Namespace] || namespace.ProviderIdentity != source.connection.ProviderIdentity || seen[namespace.Namespace] {
			return capabilities{}, identity.ErrResourceDenied
		}
		seen[namespace.Namespace] = true
	}
	connection := source.connection
	if len(names) > 0 {
		if len(names) > 1 || !source.matchesName(names[0]) {
			return capabilities{}, identity.ErrResourceDenied
		}
		connection.Name = names[0]
	}
	connection.Generation = g.generation(connection.Name)
	return cloneCapabilities(capabilities{connection: connection, namespaces: namespaces, published: true}), nil
}
func publishedAuthority(actor identity.VerifiedActor, source publishedMetadataRegistration, uri identity.ResourceURI, hash, admission string) string {
	raw, _ := json.Marshal([]any{"published.metadata.v1", actor.PublicRead, actor.Issuer, actor.Subject, actor.TenantID, actor.AccountID, actor.IdentityRevision, source.connection.Name, source.connection.ProviderIdentity, uri.Namespace, hash, admission})
	return identity.ContentFingerprint(raw)
}
func publishedState(state *primitive.ResourceState, uri identity.ResourceURI, definition bool) (*primitive.ResourceState, error) {
	if state == nil || state.URI != uri.String() || state.Kind != uri.Kind || state.Namespace != uri.Namespace || state.Name != uri.Name || state.Revision != "" {
		return nil, identity.ErrResourceDenied
	}
	if !(identity.ResourceCandidate{Kind: identity.PublishedCandidate, ContentFingerprint: state.ContentFingerprint}).Valid() {
		return nil, identity.ErrResourceDenied
	}
	if definition {
		raw := state.DefinitionBytes
		if len(raw) == 0 {
			raw = state.Definition
		}
		if len(raw) == 0 {
			return nil, identity.ErrResourceDenied
		}
		state.Definition = raw
		state.DefinitionBytes = raw
	}
	return state, nil
}
func getPublished[T any](ctx context.Context, g *Gateway, source publishedMetadataRegistration, connection Connection, uri identity.ResourceURI, ref identity.ResourceRef, pin *identity.ResolvedResource, actor identity.VerifiedActor, decoders ...DefinitionDecoder[T]) (*Result[T], error) {
	if ref.Revision != "" || len(decoders) > 1 || pin != nil && freshMetadataSelection(ctx) {
		return nil, identity.ErrResourceDenied
	}
	admission, err := source.source.AdmissionKey(ctx)
	if err != nil {
		return nil, err
	}
	if admission == "" {
		return nil, identity.ErrResourceDenied
	}
	state, err := source.source.Get(ctx, ref.URI)
	if err != nil {
		return nil, err
	}
	state, err = publishedState(state, uri, true)
	if err != nil {
		return nil, err
	}
	actual := &identity.ResolvedResource{ProviderIdentity: connection.ProviderIdentity, URI: ref.URI, ResourceCandidate: identity.ResourceCandidate{Kind: identity.PublishedCandidate, ContentFingerprint: state.ContentFingerprint}, AuthorityBinding: publishedAuthority(actor, source, uri, state.ContentFingerprint, admission), ValidUntil: actor.ValidUntil}
	if pin != nil {
		if pin.ProviderIdentity != actual.ProviderIdentity || pin.URI != actual.URI || pin.ResourceCandidate != actual.ResourceCandidate || pin.AuthorityBinding != actual.AuthorityBinding || !identity.MetadataExpiryValid(pin.ValidUntil, g.now()) {
			return nil, identity.ErrResourceDenied
		}
		actual.ValidUntil = identity.MinimumMetadataExpiry(actual.ValidUntil, pin.ValidUntil)
	}
	var value T
	if len(decoders) == 1 {
		if decoders[0] == nil {
			return nil, identity.ErrResource
		}
		// Host decoders may mutate their input. Keep the selected owned bytes intact.
		value, err = decoders[0](bytes.Clone(state.Definition))
	} else {
		value, err = decodeDefinition[T](state.Definition)
	}
	if err != nil {
		return nil, err
	}
	// Parsing can race admission or publication changes. Fence the selected
	// pointer without rereading, hashing, or decoding the immutable body.
	currentHash, err := source.source.CurrentHash(ctx, ref.URI)
	if err != nil {
		return nil, err
	}
	if currentHash != state.ContentFingerprint {
		return nil, identity.ErrResourceStale
	}
	freshAdmission, err := source.source.AdmissionKey(ctx)
	if err != nil {
		return nil, err
	}
	if freshAdmission != admission {
		return nil, identity.ErrResourceDenied
	}
	if err = g.final(ctx, actor); err != nil {
		return nil, err
	}
	if connection.Generation != g.generation(connection.Name) || !identity.MetadataExpiryValid(actual.ValidUntil, g.now()) {
		return nil, identity.ErrResourceStale
	}
	if sequence := sequenceFromContext(ctx); sequence != nil {
		sequence.constrainLease(actual.ValidUntil)
	}
	return &Result[T]{GetResult: primitive.GetResult{Resource: state, ResolvedResource: actual}, Definition: value}, nil
}
func (g *Gateway) listPublished(ctx context.Context, source publishedMetadataRegistration, kind, namespace string, locators ...Connection) ([]LocatedResource, error) {
	rows, err := source.source.List(ctx, kind, namespace)
	if err != nil {
		return nil, err
	}
	result := make([]LocatedResource, 0, len(rows))
	seen := map[string]bool{}
	for _, row := range rows {
		uri, err := identity.ParseResourceURI(row.URI)
		if err != nil || !source.namespaces[uri.Namespace] || uri.Kind != kind || namespace != "" && uri.Namespace != namespace || seen[row.URI] {
			return nil, identity.ErrResourceDenied
		}
		state, err := publishedState(&row, uri, false)
		if err != nil {
			return nil, err
		}
		seen[row.URI] = true
		connection := source.connection
		if len(locators) > 0 {
			if len(locators) > 1 || !source.matchesName(locators[0].Name) || locators[0].ProviderIdentity != "" && locators[0].ProviderIdentity != connection.ProviderIdentity {
				return nil, ErrCollision
			}
			connection.Name = locators[0].Name
		}
		connection.Generation = g.generation(connection.Name)
		result = append(result, LocatedResource{Connection: connection, Resource: *state})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Resource.URI < result[j].Resource.URI })
	return result, nil
}

// Every local catalog cursor is scoped to the source's actual admitted session,
// including gateways whose ordinary metadata actor is intentionally public.
func (g *Gateway) publishedAdmissionKeys(ctx context.Context) (string, error) {
	keys := []string{}
	for _, source := range g.publishedRegistrations() {
		key, err := source.source.AdmissionKey(ctx)
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		if purePublishedDenial(err) {
			// Denied providers contribute no catalog entries. Record the state so
			// granting/revoking access invalidates pagination without blocking peers.
			keys = append(keys, source.connection.Name+"\x00denied")
			continue
		}
		if err != nil {
			return "", err
		}
		if key == "" {
			return "", identity.ErrResourceDenied
		}
		keys = append(keys, source.connection.Name+"\x00admitted\x00"+key)
	}
	sort.Strings(keys)
	raw, _ := json.Marshal(keys)
	return identity.ContentFingerprint(raw), nil
}

// Only a pure producer admission denial is optional during aggregate discovery.
// Never hide joined failures, cancellation or malformed publication evidence.
func purePublishedDenial(err error) bool {
	denied := false
	for current := err; current != nil; current = errors.Unwrap(current) {
		if _, joined := current.(interface{ Unwrap() []error }); joined {
			return false
		}
		if current == context.Canceled || current == context.DeadlineExceeded || current == identity.ErrInvalid || current == identity.ErrResourceStale || current == identity.ErrResource {
			return false
		}
		if current == identity.ErrResourceDenied {
			denied = true
		}
		// Cohort metadata exposes producer denial as HTTP 403 without wrapping
		// the resource sentinel. Honor that existing typed contract, not text.
		if status, ok := current.(interface{ HTTPStatusCode() int }); ok && status.HTTPStatusCode() == 403 {
			denied = true
		}
	}
	return denied
}

type publishedDiscoveryDenied struct{ error }

func (e *publishedDiscoveryDenied) Unwrap() error { return e.error }

func (g *Gateway) aggregatePublishedCapabilities(ctx context.Context, source publishedMetadataRegistration, name string) (capabilities, error) {
	_, err := source.source.AdmissionKey(ctx)
	if ctx.Err() != nil {
		return capabilities{}, ctx.Err()
	}
	if purePublishedDenial(err) {
		return capabilities{}, &publishedDiscoveryDenied{err}
	}
	if err != nil {
		return capabilities{}, err
	}
	return g.publishedCapabilities(ctx, source, name)
}

func isPublishedDiscoveryDenied(err error) bool {
	_, ok := err.(*publishedDiscoveryDenied)
	return ok
}

func (s publishedMetadataRegistration) matchesName(name string) bool {
	return s.connection.Name == name || s.aliases[name]
}

// Caller holds g.mu. Alias names are trusted registration data, never inferred
// from URIs or resolved through transport configuration on an interactive read.
func (g *Gateway) publishedCanonicalNameLocked(name string) string {
	for _, source := range g.publishedMetadata {
		if source.matchesName(name) {
			return source.connection.Name
		}
	}
	return name
}
