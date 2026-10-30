// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"time"
)

// PrepareNativePresentationRead restores the private selection held by the
// negotiated UI instance. Only expired public presentation leases can renew;
// private datasource and report leases retain their original deadlines.
func (s *Service) PrepareNativePresentationRead(ctx context.Context, resource *identity.ResolvedResource, target *types.WindowTarget) (*identity.ResolvedResource, *types.WindowTarget, error) {
	if resource == nil {
		return resource, target, nil
	}
	original := windowResourcePin{Resource: *resource, Target: target}
	if !identity.MetadataExpiryValid(resource.ValidUntil, time.Now()) && (!defaultPresentationPin(original) || s.ns.Resolver == nil) {
		return nil, nil, identity.ErrResourceDenied
	}
	bridge, session, err := s.nativePresentationSession(ctx)
	if err != nil {
		return nil, nil, err
	}
	sessionID := requestctx.UIBridgeSessionIDFromContext(ctx)
	conversation := requestctx.ConversationIDFromContext(ctx)
	requestedWindow := requestctx.UIWindowIDFromContext(ctx)
	s.resourceMu.Lock()
	candidates := map[windowPinKey]windowResourcePin{}
	for key, pin := range s.resourcePins {
		if key.Namespace != session.ns || key.ClientID != session.clientID || (requestedWindow != "" && key.WindowID != requestedWindow) {
			continue
		}
		same := identity.SameResolvedResource(pin.Resource, *resource) && (types.SameConsumerWindowTarget(target, pin.Target) || types.SameWindowTarget(pin.Target, target))
		if pin.PresentedResource != nil && identity.SameResolvedResource(*pin.PresentedResource, *resource) && (types.SameConsumerWindowTarget(target, pin.PresentedTarget) || types.SameWindowTarget(pin.PresentedTarget, target)) {
			same = true
		}
		if same {
			candidates[key] = pin
		}
	}
	s.resourceMu.Unlock()
	var selected windowPinKey
	var held windowResourcePin
	count := 0
	for key, pin := range candidates {
		if conversation != "" && s.authorizeConversationClient(ctx, key.Namespace, key.ClientID, conversation) != nil {
			continue
		}
		selected, held = key, pin
		count++
	}
	if count != 1 {
		return nil, nil, identity.ErrResourceDenied
	}
	fresh, err := s.renewDefaultPresentationPin(ctx, selected, held)
	if err != nil {
		return nil, nil, err
	}
	// A warm renewal still rechecks the owning catalog and original source.
	if _, err = s.revalidateWindowPin(ctx, fresh); err != nil {
		return nil, nil, identity.ErrResourceDenied
	}
	if bridge.sessionInfoByID(sessionID) != session || ctx.Err() != nil || !identity.MetadataExpiryValid(fresh.Resource.ValidUntil, time.Now()) {
		return nil, nil, identity.ErrResourceDenied
	}
	return &fresh.Resource, fresh.Target, nil
}

func (s *Service) nativePresentationSession(ctx context.Context) (*httpRPCBridge, *httpSessionInfo, error) {
	owner, err := s.ns.Identity(ctx)
	if err != nil || owner.Namespace == "" || !namespaceIdentityLive(owner, time.Now()) {
		return nil, nil, identity.ErrResourceDenied
	}
	sessionID := requestctx.UIBridgeSessionIDFromContext(ctx)
	s.hub.httpMu.Lock()
	bridge := s.hub.httpBridge
	s.hub.httpMu.Unlock()
	if bridge == nil || sessionID == "" {
		return nil, nil, identity.ErrResourceDenied
	}
	session := bridge.sessionInfoByID(sessionID)
	if session == nil || session.ns != owner.Namespace || session.receiver == nil {
		return nil, nil, identity.ErrResourceDenied
	}
	s.hub.mu.RLock()
	current := s.hub.clients[owner.Namespace][session.clientID]
	s.hub.mu.RUnlock()
	if current != session.receiver || current.ctx == nil || current.ctx.Err() != nil {
		return nil, nil, identity.ErrResourceDenied
	}
	receiverOwner, err := s.ns.Identity(current.ctx)
	if err != nil || receiverOwner.Namespace != owner.Namespace {
		return nil, nil, identity.ErrResourceDenied
	}
	return bridge, session, nil
}
