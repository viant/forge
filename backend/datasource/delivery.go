// SPDX-License-Identifier: Apache-2.0
// Generic Forge data execution extracted from Viant Agently Core.
package datasource

import (
	"bytes"
	"context"
	"encoding/json"
	"reflect"

	primitive "github.com/viant/forge/backend/provider/contract"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

// OriginalDelivery holds immutable selection provenance for a new interaction.
// Inputs and historical facts remain outside this preparation contract.
type OriginalDelivery struct {
	Resource         *identity.ResolvedResource
	Target           *types.WindowTarget
	ResourceProof    *primitive.ExecutionProof
	SelectionBinding *identity.SelectionBinding
	WindowParameters map[string]any
}

// PreparedDelivery is a detached, freshly verified artifact delivery context.
// Preparation grants no read/write business permission; managing MCP execution
// remains authoritative for each operation.
type PreparedDelivery struct {
	Resource      *identity.ResolvedResource
	Target        *types.WindowTarget
	ResourceProof *primitive.ExecutionProof
}

// NewDeliveryPreparer must verify the full original signed selection, fresh
// canonical actor, current namespace exposure and exact candidate, then mint
// fresh target/provider proofs. It must never retry a business operation.
// The returned context must derive from the supplied context to preserve managed
// MCP credentials, cache identity, conversation, and operation values. It may
// refresh trusted values but must not substitute an ambient/background context.
type NewDeliveryPreparer func(context.Context, OriginalDelivery) (context.Context, *PreparedDelivery, error)

func sameDeliveryArtifact(a, b *identity.ResolvedResource) bool {
	return a != nil && b != nil && a.ProviderIdentity == b.ProviderIdentity && a.URI == b.URI && a.ResourceCandidate == b.ResourceCandidate
}
func sameDeliveryTarget(a, b *types.WindowTarget) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	left, err := a.Normalize()
	if err != nil {
		return false
	}
	right, err := b.Normalize()
	if err != nil {
		return false
	}
	if left.Platform != right.Platform || left.FormFactor != right.FormFactor || left.Surface != right.Surface || !reflect.DeepEqual(left.Capabilities, right.Capabilities) || len(left.DependencyPins) != len(right.DependencyPins) {
		return false
	}
	for id, pin := range left.DependencyPins {
		other, ok := right.DependencyPins[id]
		if !ok || !sameDeliveryArtifact(&pin, &other) {
			return false
		}
	}
	return true
}

type newDeliveryContextKey struct{}
type newDeliveryContextMarker struct{ parent context.Context }

// Err checks the parent synchronously: AfterFunc eventually closes Done, but
// its asynchronous scheduling must never allow release after parent cancellation.
type parentBoundDeliveryContext struct {
	context.Context
	parent context.Context
}

func (c parentBoundDeliveryContext) Err() error {
	if err := c.parent.Err(); err != nil {
		return err
	}
	return c.Context.Err()
}

func deliveryInProgress(ctx context.Context) bool {
	return requestctx.HasResourceReadDispatch(ctx) || requestctx.ResourceReadAssociation(ctx) != ([32]byte{}) || requestctx.WindowReadDecisionActive(ctx)
}

func (s *Service) prepareNewDelivery(ctx context.Context, opts FetchOptions) (context.Context, FetchOptions, func(), error) {
	if opts.SelectionBinding == nil {
		return ctx, opts, func() {}, nil
	}
	if ctx == nil || ctx.Err() != nil || s.newDeliveryPreparer == nil || opts.Resource == nil || deliveryInProgress(ctx) {
		return nil, opts, nil, identity.ErrResourceDenied
	}
	// Detach every nested map/proof before handing provenance to a host callback.
	original := OriginalDelivery{opts.Resource, opts.Target, opts.ResourceProof, opts.SelectionBinding, opts.WindowParameters}
	raw, err := json.Marshal(original)
	if err != nil {
		return nil, opts, nil, identity.ErrResourceDenied
	}
	var detached OriginalDelivery
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if decoder.Decode(&detached) != nil {
		return nil, opts, nil, identity.ErrResourceDenied
	}
	// Keep an independent original selector snapshot: callbacks can modify their
	// detached arguments/context but never the body or subsequent selector hints.
	var frozen OriginalDelivery
	frozenDecoder := json.NewDecoder(bytes.NewReader(raw))
	frozenDecoder.UseNumber()
	if frozenDecoder.Decode(&frozen) != nil {
		return nil, opts, nil, identity.ErrResourceDenied
	}
	marker := &newDeliveryContextMarker{parent: ctx}
	callbackCtx := requestctx.WithWindowParameters(ctx, detached.WindowParameters)
	callbackCtx = context.WithValue(callbackCtx, newDeliveryContextKey{}, marker)
	freshCtx, fresh, err := s.newDeliveryPreparer(callbackCtx, detached)
	if err != nil {
		return nil, opts, nil, err
	}
	if ctx.Err() != nil || freshCtx == nil || freshCtx.Err() != nil || freshCtx.Value(newDeliveryContextKey{}) != marker || deliveryInProgress(freshCtx) || fresh == nil || !sameDeliveryArtifact(original.Resource, fresh.Resource) || !sameDeliveryTarget(original.Target, fresh.Target) || !identity.MetadataExpiryValid(fresh.Resource.ValidUntil, s.now()) || fresh.Resource.AuthorityBinding == "" {
		return nil, opts, nil, identity.ErrResourceDenied
	}
	// The preparer may renew leases and signatures but cannot introduce a new
	// provider-proof artifact. Full proof signatures are checked by the provider.
	if original.ResourceProof != nil && (fresh.ResourceProof == nil || !sameDeliveryArtifact(&original.ResourceProof.Resource, &fresh.ResourceProof.Resource) || original.ResourceProof.Binding != fresh.ResourceProof.Binding) {
		return nil, opts, nil, identity.ErrResourceDenied
	}
	if original.Target != nil && original.Target.ExecutionProof != nil && (fresh.Target.ExecutionProof == nil || !sameDeliveryArtifact(&original.Target.ExecutionProof.Resource, &fresh.Target.ExecutionProof.Resource) || original.Target.ExecutionProof.Binding != fresh.Target.ExecutionProof.Binding) {
		return nil, opts, nil, identity.ErrResourceDenied
	}
	proofs := []*primitive.ExecutionProof{fresh.ResourceProof}
	if fresh.Target != nil {
		proofs = append(proofs, fresh.Target.ExecutionProof)
	}
	for _, proof := range proofs {
		if proof != nil && (!sameDeliveryArtifact(fresh.Resource, &proof.Resource) || proof.Binding == "" || proof.Token == "" || !proof.Resource.ValidUntil.After(s.now()) || fresh.Resource.ValidUntil.After(proof.Resource.ValidUntil)) {
			return nil, opts, nil, identity.ErrResourceDenied
		}
	}
	if fresh.Target != nil {
		for _, pin := range fresh.Target.DependencyPins {
			if !identity.MetadataExpiryValid(pin.ValidUntil, s.now()) || pin.AuthorityBinding == "" {
				return nil, opts, nil, identity.ErrResourceDenied
			}
		}
	}
	opts.Resource, opts.Target, opts.ResourceProof = fresh.Resource, fresh.Target, fresh.ResourceProof
	// A host may derive and refresh context values, but cannot remove parent cancellation
	// or extend its deadline. Cleanup belongs to this new operation's caller.
	bounded, cancel := context.WithCancel(freshCtx)
	stopParent := context.AfterFunc(ctx, cancel)
	cancelDeadline := func() {}
	if deadline, ok := ctx.Deadline(); ok {
		var deadlineCancel context.CancelFunc
		bounded, deadlineCancel = context.WithDeadline(bounded, deadline)
		cancelDeadline = deadlineCancel
	}
	bounded = parentBoundDeliveryContext{Context: bounded, parent: ctx}
	bounded = requestctx.WithWindowParameters(bounded, frozen.WindowParameters)
	cleanup := func() { stopParent(); cancelDeadline(); cancel() }
	if ctx.Err() != nil || bounded.Err() != nil {
		cleanup()
		return nil, opts, nil, identity.ErrResourceDenied
	}
	return bounded, opts, cleanup, nil
}
