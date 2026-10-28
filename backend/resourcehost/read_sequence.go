// SPDX-License-Identifier: Apache-2.0
// Forge MCP resource access extracted from Viant Agently Core.
package resource

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"reflect"
	"sort"
	"sync"
	"time"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	mcpclient "github.com/viant/mcp/client"
	authctx "github.com/viant/mcp/client/auth/link"
	cfg "github.com/viant/mcp/client/config"
)

// ReadFactsScope shares only a provider-owned active decision snapshot. Copy
// preserves caller pins/parameters and must verify the current credential.
type ReadFactsScope interface {
	BeginDecision(context.Context) (context.Context, func() error, error)
	WithoutDecision(context.Context) context.Context
	CopyDecision(context.Context, context.Context) (context.Context, error)
}

type resourceReadSequenceKey struct{}
type namespaceRead struct {
	key string
	cap capabilities
}
type resourceReadSequence struct {
	mu sync.Mutex
	// Serialize phase transitions, not producer calls. A concurrent dispatch
	// joins the open dispatch phase after its PRE transition has completed.
	transition                   sync.Mutex
	gateway                      *Gateway
	base                         context.Context
	facts                        ReadFactsScope
	factContext                  context.Context
	finishFacts                  func() error
	actor                        identity.VerifiedActor
	lease                        time.Time
	active, ending, closed       bool
	phases                       int
	dispatchDepth                int
	failed                       error
	reads                        map[string]namespaceRead
	originalReads                map[string]namespaceRead
	selection, originalSelection *selectedDatasourceBundle
	reportReads                  map[string]selectedResourceRead
}

// BeginReadSequence owns one operation's PRE/POST metadata facts. Resource
// Get, content, policy, credential and original-lease checks never use this memo.
func (g *Gateway) BeginReadSequence(ctx context.Context, facts ReadFactsScope) (context.Context, func() error, error) {
	if g == nil || ctx == nil || ctx.Err() != nil {
		return nil, nil, identity.ErrResourceDenied
	}
	if prior, _ := ctx.Value(resourceReadSequenceKey{}).(*resourceReadSequence); prior != nil {
		return nil, nil, identity.ErrResourceDenied
	}
	s := &resourceReadSequence{gateway: g, base: ctx, facts: facts, reads: map[string]namespaceRead{}, originalReads: map[string]namespaceRead{}}
	marked := context.WithValue(ctx, resourceReadSequenceKey{}, s)
	marked = requestctx.WithResourceReadDispatch(marked, s)
	if err := s.startPhase(marked); err != nil {
		_ = s.finish(marked)
		return nil, nil, err
	}
	return marked, func() error { return s.finish(marked) }, nil
}

// poisonReadSequence makes an observed selection failure terminal for the
// original operation, even if a subsequent fresh source check would succeed.
func poisonReadSequence(ctx context.Context, err error) {
	if err == nil {
		return
	}
	if sequence := sequenceFromContext(ctx); sequence != nil {
		sequence.mu.Lock()
		if sequence.failed == nil {
			sequence.failed = err
		}
		sequence.mu.Unlock()
	}
}

func sequenceFromContext(ctx context.Context) *resourceReadSequence {
	if ctx == nil {
		return nil
	}
	s, _ := ctx.Value(resourceReadSequenceKey{}).(*resourceReadSequence)
	return s
}

// ReadContext copies an active phase's opaque facts into a caller context.
// Its normal context values, including held resource/target pins, remain intact.
func ReadContext(ctx context.Context) (context.Context, error) {
	s := sequenceFromContext(ctx)
	if s == nil {
		return ctx, nil
	}
	s.mu.Lock()
	failed, closed, active, lease := s.failed, s.closed, s.active, s.lease
	facts, scoped := s.facts, s.factContext
	s.mu.Unlock()
	if failed != nil {
		return nil, failed
	}
	if closed || ctx.Err() != nil || !lease.IsZero() && !lease.After(s.gateway.now()) {
		return nil, identity.ErrResourceDenied
	}
	if facts != nil {
		ctx = facts.WithoutDecision(ctx)
		if active {
			copied, err := facts.CopyDecision(ctx, scoped)
			if err != nil {
				s.mu.Lock()
				s.failed = err
				s.mu.Unlock()
			}
			return copied, err
		}
	}
	return ctx, nil
}

func (s *resourceReadSequence) startPhase(ctx context.Context) error {
	s.mu.Lock()
	if s.closed || s.failed != nil || s.active {
		s.mu.Unlock()
		return identity.ErrResourceDenied
	}
	s.mu.Unlock()
	scoped, finish := s.base, func() error { return s.base.Err() }
	if s.facts != nil {
		var err error
		scoped, finish, err = s.facts.BeginDecision(s.facts.WithoutDecision(s.base))
		if err != nil {
			return err
		}
		if scoped == nil || finish == nil {
			if finish != nil {
				_ = finish()
			}
			return identity.ErrResourceDenied
		}
	}
	s.mu.Lock()
	s.factContext, s.finishFacts, s.active, s.reads = scoped, finish, true, map[string]namespaceRead{}
	s.selection = nil
	if s.originalSelection != nil {
		original := s.originalSelection
		fresh := *original
		fresh.resources = make(map[string]selectedResourceRead, len(original.resources))
		for id, read := range original.resources {
			read.result = primitive.GetResult{}
			fresh.resources[id] = read
		}
		s.selection = &fresh
	}
	s.phases++
	s.mu.Unlock()
	actor, err := s.gateway.actor(ctx)
	if err != nil {
		return err
	}
	s.mu.Lock()
	if s.actor.ValidUntil.IsZero() {
		s.actor, s.lease = actor, actor.ValidUntil
	}
	if deadline, ok := s.base.Deadline(); ok && deadline.Before(s.lease) {
		s.lease = deadline
	}
	s.mu.Unlock()
	return nil
}

func (s *resourceReadSequence) checkActor(actor identity.VerifiedActor) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.failed != nil || !s.lease.IsZero() && !s.lease.After(s.gateway.now()) {
		return identity.ErrResourceDenied
	}
	if !s.actor.ValidUntil.IsZero() && (actor.PublicRead != s.actor.PublicRead || actor.Subject != s.actor.Subject || actor.Issuer != s.actor.Issuer || actor.TenantID != s.actor.TenantID || actor.AccountID != s.actor.AccountID || actor.IdentityRevision != s.actor.IdentityRevision || actor.ValidUntil.Before(s.lease)) {
		s.failed = identity.ErrResourceDenied
		return identity.ErrResourceDenied
	}
	return nil
}

func (s *resourceReadSequence) constrainLease(lease time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lease = identity.MinimumMetadataExpiry(s.lease, lease)
}

func credentialDigest(ctx context.Context) [32]byte {
	tokens := authctx.TokensFromContext(ctx)
	var access, id string
	if tokens != nil {
		access, id = tokens.AccessToken, tokens.IDToken
	}
	encoded, _ := json.Marshal([]string{authctx.EffectiveUserID(ctx), authctx.CanonicalUserID(ctx), authctx.Bearer(ctx), authctx.IDToken(ctx), authctx.Provider(ctx), access, id})
	return sha256.Sum256(encoded)
}

func (g *Gateway) namespaceReadKey(ctx context.Context, actor identity.VerifiedActor, name string, options *cfg.MCPClient, client mcpclient.Interface) (string, error) {
	return g.namespaceReadKeyForCredential(ctx, actor, name, options, client, credentialDigest(g.Manager.WithAuthTokenContext(ctx, name)))
}

// The caller may share the effective credential only within one binding check.
func (g *Gateway) namespaceReadKeyForCredential(ctx context.Context, actor identity.VerifiedActor, name string, options *cfg.MCPClient, client mcpclient.Interface, authHash [32]byte, associationOverride ...[32]byte) (string, error) {
	if wrapped, ok := client.(*gatewayAuthClient); ok {
		client = wrapped.Interface
	}
	value := reflect.ValueOf(client)
	if !value.IsValid() || value.Kind() != reflect.Pointer || value.IsNil() {
		return "", identity.ErrResourceDenied
	}
	encoded, err := json.Marshal(options)
	if err != nil {
		return "", identity.ErrResourceDenied
	}
	optionsHash := sha256.Sum256(encoded)
	association := requestctx.ResourceReadAssociation(ctx)
	if len(associationOverride) > 0 {
		association = associationOverride[0]
	}
	return fmt.Sprintf("%s:%x:%x:%x:%T:%x", actorKey(actor, name, g.generation(name)), optionsHash, authHash, association, client, value.Pointer()), nil
}

func cloneCapabilities(c capabilities) capabilities {
	copy := c
	raw, _ := json.Marshal(c.namespaces)
	// Unmarshal must allocate detached slices/maps instead of reusing the
	// copied slice's original backing array and cached method maps.
	copy.namespaces = nil
	_ = json.Unmarshal(raw, &copy.namespaces)
	copy.installed = make(map[string]bool, len(c.installed))
	for name, installed := range c.installed {
		copy.installed[name] = installed
	}
	return copy
}

// Namespace/kind/version/operation lists are sets. Provider enumeration order
// is not a capability change and must not cause delivery-only false denials.
func sameNamespaceContracts(left, right []primitive.NamespaceCapabilities) bool {
	normalize := func(input []primitive.NamespaceCapabilities) []primitive.NamespaceCapabilities {
		cloned := cloneCapabilities(capabilities{namespaces: input}).namespaces
		sort.Slice(cloned, func(i, j int) bool { return cloned[i].Namespace < cloned[j].Namespace })
		for i := range cloned {
			sort.Slice(cloned[i].Kinds, func(a, b int) bool { return cloned[i].Kinds[a].Kind < cloned[i].Kinds[b].Kind })
			for j := range cloned[i].Kinds {
				kind := &cloned[i].Kinds[j]
				sort.Slice(kind.FormatVersions, func(a, b int) bool { return kind.FormatVersions[a] < kind.FormatVersions[b] })
				sort.Strings(kind.Operations)
			}
		}
		return cloned
	}
	return reflect.DeepEqual(normalize(left), normalize(right))
}

func (s *resourceReadSequence) lookup(name, key string) (capabilities, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.failed != nil {
		return capabilities{}, false, identity.ErrResourceDenied
	}
	if !s.active {
		return capabilities{}, false, nil
	}
	held, found := s.reads[name]
	if !found {
		return capabilities{}, false, nil
	}
	if held.key != key || !identity.MetadataExpiryValid(held.cap.expires, s.gateway.now()) || s.gateway.generation(name) != held.cap.connection.Generation {
		s.failed = identity.ErrResourceDenied
		return capabilities{}, false, identity.ErrResourceDenied
	}
	if s.gateway.Manager.ResourceCatalogGeneration(s.base, name) != held.cap.resourceVersion {
		// Native resource changes refresh the metadata contract. They do not
		// revoke the transport binding or substitute for the next owner Get.
		return capabilities{}, false, nil
	}
	return cloneCapabilities(held.cap), true, nil
}

func (s *resourceReadSequence) record(name, key string, c capabilities) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.failed != nil {
		return identity.ErrResourceDenied
	}
	if !s.active {
		return nil
	}
	if prior, found := s.reads[name]; found && prior.key != key {
		return identity.ErrResourceDenied
	}
	if original, found := s.originalReads[name]; found {
		if original.key != key || original.cap.connection != c.connection || !sameNamespaceContracts(original.cap.namespaces, c.namespaces) || !reflect.DeepEqual(original.cap.installed, c.installed) {
			s.failed = identity.ErrResourceDenied
			return identity.ErrResourceDenied
		}
	} else {
		s.originalReads[name] = namespaceRead{key: key, cap: cloneCapabilities(c)}
	}
	s.reads[name] = namespaceRead{key: key, cap: cloneCapabilities(c)}
	if c.expires.Before(s.lease) {
		s.lease = c.expires
	}
	return nil
}

func (s *resourceReadSequence) endPhase(ctx context.Context) (err error) {
	s.mu.Lock()
	if !s.active {
		prior := s.failed
		s.mu.Unlock()
		return prior
	}
	reads := make(map[string]namespaceRead, len(s.reads))
	for name, read := range s.reads {
		reads[name] = read
	}
	finishFacts := s.finishFacts
	s.mu.Unlock()
	defer func() {
		if finishErr := finishFacts(); err == nil && finishErr != nil {
			err = finishErr
		}
		s.mu.Lock()
		s.active, s.factContext, s.finishFacts, s.reads = false, nil, nil, nil
		s.selection = nil
		if err != nil {
			s.failed = err
		}
		s.mu.Unlock()
	}()
	actor, err := s.gateway.actor(ctx)
	if err != nil {
		return err
	}
	if err := s.checkSelectedAdmissions(ctx); err != nil {
		return err
	}
	for name, held := range reads {
		// Discovery is a cached method contract, not resource authority. Fence
		// transport/identity changes here; fresh owner Gets below decide access.
		binding, err := s.gateway.resolveReadBinding(ctx, actor, name)
		if err != nil {
			return err
		}
		if binding.key != held.key || s.gateway.generation(name) != held.cap.connection.Generation || !identity.MetadataExpiryValid(held.cap.expires, s.gateway.now()) {
			return identity.ErrResourceDenied
		}
		if err := s.gateway.checkReadBinding(ctx, actor, binding); err != nil {
			return err
		}
	}
	if err := s.refreshSelectedResources(ctx); err != nil {
		return err
	}
	if err := s.gateway.final(ctx, actor); err != nil {
		return err
	}
	return nil
}

func (s *resourceReadSequence) BeforeDispatch(ctx context.Context) error {
	s.transition.Lock()
	defer s.transition.Unlock()
	s.mu.Lock()
	if s.closed || s.failed != nil || s.ending {
		s.mu.Unlock()
		return identity.ErrResourceDenied
	}
	if s.dispatchDepth > 0 {
		s.dispatchDepth++
		s.mu.Unlock()
		return nil
	}
	if !s.active {
		s.mu.Unlock()
		return identity.ErrResourceDenied
	}
	s.ending = true
	s.mu.Unlock()
	if err := s.endPhase(ctx); err != nil {
		s.mu.Lock()
		s.ending = false
		s.mu.Unlock()
		return err
	}
	s.mu.Lock()
	s.dispatchDepth, s.ending = 1, false
	s.mu.Unlock()
	return nil
}

func (s *resourceReadSequence) AfterDispatch(ctx context.Context) error {
	s.transition.Lock()
	defer s.transition.Unlock()
	s.mu.Lock()
	if s.closed || s.failed != nil || s.dispatchDepth == 0 || s.active {
		s.mu.Unlock()
		return identity.ErrResourceDenied
	}
	s.dispatchDepth--
	if s.dispatchDepth > 0 {
		s.mu.Unlock()
		return nil
	}
	s.mu.Unlock()
	err := s.startPhase(ctx)
	if err != nil {
		s.mu.Lock()
		s.failed = err
		s.mu.Unlock()
	}
	return err
}

func (s *resourceReadSequence) BeforeRelease(ctx context.Context) error {
	s.transition.Lock()
	defer s.transition.Unlock()
	s.mu.Lock()
	if s.closed || s.failed != nil || s.ending || s.dispatchDepth != 0 || !s.active {
		s.mu.Unlock()
		return identity.ErrResourceDenied
	}
	if s.phases > 1 {
		s.mu.Unlock()
		return nil
	}
	s.ending = true
	s.mu.Unlock()
	err := s.endPhase(ctx)
	s.mu.Lock()
	s.ending = false
	s.mu.Unlock()
	if err != nil {
		return err
	}
	err = s.startPhase(ctx)
	if err != nil {
		s.mu.Lock()
		s.failed = err
		s.mu.Unlock()
	}
	return err
}

func (s *resourceReadSequence) finish(ctx context.Context) error {
	s.transition.Lock()
	defer s.transition.Unlock()
	s.mu.Lock()
	if s.closed || s.ending {
		s.failed = identity.ErrResourceDenied
		s.mu.Unlock()
		return identity.ErrResourceDenied
	}
	s.ending = true
	s.mu.Unlock()
	err := s.endPhase(ctx)
	if err == nil {
		err = s.refreshReportReads(ctx)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return identity.ErrResourceDenied
	}
	s.closed, s.reads, s.originalReads = true, nil, nil
	s.selection, s.originalSelection = nil, nil
	s.reportReads = nil
	if err == nil && s.failed != nil {
		err = s.failed
	}
	if err == nil && (s.dispatchDepth > 0 || ctx.Err() != nil || !identity.MetadataExpiryValid(s.lease, s.gateway.now())) {
		err = identity.ErrResourceDenied
	}
	return err
}
