package resource

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"time"

	"github.com/viant/forge/backend/provider/contract/observe"
	identity "github.com/viant/forge/backend/resource"
	mcpcfg "github.com/viant/mcp/client/config"
)

// The memo keeps only a URI's previously verified owning connection. The
// normal Gateway Get still checks the current actor, credential, producer
// proof, content fingerprint and lease on every use; definition bytes remain
// in the existing scoped manager cache.
type mcpReferenceMemoKey struct {
	uri        string
	actor      [32]byte
	credential [32]byte
	generation string
}
type mcpReferenceMemoEntry struct {
	connection Connection
	credential [32]byte
	until      time.Time
}

func selectionReason(ctx context.Context, reason string) {
	span := observe.Start(ctx, observe.Phase("mcp.definition.selection."+reason), observe.Labels{})
	span.End(observe.OK, observe.CacheUnknown)
}

func (r *MCPReferenceReader) memoKey(ctx context.Context, uri string) (mcpReferenceMemoKey, identity.VerifiedActor, error) {
	actor, err := r.gateway.actor(ctx)
	if err != nil {
		return mcpReferenceMemoKey{}, identity.VerifiedActor{}, err
	}
	// The verified actor can intentionally be public for configuration reads.
	// Keep selections for distinct caller credentials separate so an unrelated
	// request cannot evict the owning user's validated URI selection.
	key := mcpReferenceMemoKey{uri: uri, actor: sha256.Sum256([]byte(actorKey(actor, "", 0))), credential: credentialDigest(ctx), generation: r.DefinitionContentGeneration(ctx)}
	return key, actor, nil
}

func (r *MCPReferenceReader) memoLoad(ctx context.Context, uri identity.ResourceURI) (*mcpcfg.MCPClient, bool, error) {
	span := observe.Start(ctx, "mcp.definition.selection", observe.Labels{})
	key, actor, err := r.memoKey(ctx, uri.String())
	if err != nil {
		span.End(observe.OutcomeFor(err), observe.CacheUnknown)
		return nil, false, err
	}
	r.memoMu.RLock()
	entry, found := r.memo[key]
	missReason := "missing"
	if !found {
		for previous := range r.memo {
			if previous.uri != key.uri {
				continue
			}
			missReason = "actor_changed"
			if previous.actor == key.actor {
				if previous.generation != key.generation {
					missReason = "generation_changed"
				} else if previous.credential != key.credential {
					missReason = "credential_scope_changed"
				}
				break
			}
		}
	}
	r.memoMu.RUnlock()
	if !found {
		selectionReason(ctx, missReason)
		span.End(observe.OK, observe.CacheMiss)
		return nil, false, nil
	}
	credential := credentialDigest(r.gateway.Manager.WithAuthTokenContext(ctx, entry.connection.Name))
	reason := ""
	switch {
	case !actor.ReadValid(r.gateway.now()) || !identity.MetadataExpiryValid(entry.until, r.gateway.now()):
		reason = "expired"
	case credential != entry.credential:
		reason = "credential_changed"
	case r.gateway.generation(entry.connection.Name) != entry.connection.Generation:
		reason = "connection_changed"
	}
	if reason != "" {
		r.memoDelete(key)
		selectionReason(ctx, reason)
		span.End(observe.OK, observe.CacheMiss)
		return nil, false, nil
	}
	span.End(observe.OK, observe.CacheHit)
	readCtx := context.WithValue(ctx, mcpReferenceProofKey{}, mcpReferenceProof{connection: entry.connection, uri: uri.String()})
	result, err := Get[*mcpcfg.MCPClient](readCtx, r.gateway, entry.connection, identity.ResourceRef{URI: uri.String()}, nil, func(raw json.RawMessage) (*mcpcfg.MCPClient, error) { return DecodeMCPDefinition(1, raw) })
	if err != nil || result == nil || result.ResolvedResource == nil {
		r.memoDelete(key)
		selectionReason(ctx, "deleted_read_failure")
		if err == nil {
			err = identity.ErrResourceDenied
		}
		return nil, true, err
	}
	result.Definition.ResolvedIdentity = &mcpcfg.ResolvedServiceIdentity{ServiceName: uri.String(), ResourceURI: uri.String(), ProviderIdentity: entry.connection.ProviderIdentity}
	options, err := r.effectiveOptions(ctx, entry.connection, uri.Namespace, result.Definition)
	if err != nil {
		r.memoDelete(key)
		selectionReason(ctx, "deleted_options_failure")
		return nil, true, err
	}
	return options, true, nil
}

func (r *MCPReferenceReader) memoSave(ctx context.Context, selected *Located[json.RawMessage], lease time.Time, selectionStart mcpReferenceMemoKey) {
	if selected == nil || selected.Connection.Name == "" || selected.Resource.URI == "" || !identity.MetadataExpiryValid(lease, r.gateway.now()) {
		selectionReason(ctx, "save_invalid")
		return
	}
	uri, err := identity.ParseResourceURI(selected.Resource.URI)
	if err != nil || uri.Kind != "mcp" || !r.memoEligible(ctx, selected.Connection, uri) {
		selectionReason(ctx, "save_ineligible")
		return
	}
	key, actor, err := r.memoKey(ctx, uri.String())
	if err != nil || key != selectionStart || !actor.ReadValid(r.gateway.now()) {
		selectionReason(ctx, "save_changed")
		return
	}
	if !actor.ValidUntil.IsZero() && actor.ValidUntil.Before(lease) {
		lease = actor.ValidUntil
	}
	entry := mcpReferenceMemoEntry{connection: selected.Connection, credential: credentialDigest(r.gateway.Manager.WithAuthTokenContext(ctx, selected.Connection.Name)), until: lease}
	r.memoMu.Lock()
	if r.memo == nil {
		r.memo = map[mcpReferenceMemoKey]mcpReferenceMemoEntry{}
	}
	reset := false
	if len(r.memo) >= 512 {
		r.memo = map[mcpReferenceMemoKey]mcpReferenceMemoEntry{}
		reset = true
	}
	r.memo[key] = entry
	r.memoMu.Unlock()
	if reset {
		selectionReason(ctx, "capacity_reset")
	}
	selectionReason(ctx, "saved")
}

func (r *MCPReferenceReader) memoEligible(ctx context.Context, connection Connection, uri identity.ResourceURI) bool {
	options, err := r.gateway.Manager.Options(ctx, connection.Name)
	if err != nil || options == nil || options.PrimitiveProviderIdentity != connection.ProviderIdentity || len(options.PrimitiveNamespaces) != 1 || options.PrimitiveNamespaces[0] != "ns://"+uri.Namespace {
		return false
	}
	client, err := r.gateway.client(ctx, connection.Name)
	return err == nil && resourceFiltersSupported(ctx, client) && standardResourceReadSupported(ctx, client)
}

func (r *MCPReferenceReader) memoDelete(key mcpReferenceMemoKey) {
	r.memoMu.Lock()
	delete(r.memo, key)
	r.memoMu.Unlock()
}
