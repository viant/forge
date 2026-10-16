// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"strings"
)

// BindAdmittedNativePresentationWindow receives only the completed server OPEN
// frame. Query instance ids are routing hints checked against the existing
// negotiated transport session; browser snapshot contents grant nothing.
func (s *Service) BindAdmittedNativePresentationWindow(ctx context.Context, clientID, windowID, windowKey string, admitted *types.Window) (bool, error) {
	if requestctx.UIBridgeSessionIDFromContext(ctx) == "" {
		return false, nil
	}
	classifier, ok := s.cfg.WindowDefinitions.(interface {
		IsDefaultPresentationWindow(identity.ResolvedResource) bool
	})
	if !ok || admitted == nil || admitted.Resource == nil || !classifier.IsDefaultPresentationWindow(*admitted.Resource) {
		return false, nil
	}
	windowID, clientID = strings.TrimSpace(windowID), strings.TrimSpace(clientID)
	if windowID == "" || clientID == "" || !defaultPresentationPin(windowResourcePin{Resource: *admitted.Resource, Target: admitted.ResourceTarget}) {
		return true, identity.ErrResourceDenied
	}
	bridge, session, err := s.nativePresentationSession(ctx)
	if err != nil || session.clientID != clientID {
		return true, identity.ErrResourceDenied
	}
	key := windowPinKey{Namespace: session.ns, ClientID: clientID, WindowID: windowID}
	if old, exists := s.getWindowPin(key); exists && (old.Resource.URI != admitted.Resource.URI || old.Resource.ProviderIdentity != admitted.Resource.ProviderIdentity || old.Resource.ResourceCandidate != admitted.Resource.ResourceCandidate || old.Resource.AuthorityBinding != admitted.Resource.AuthorityBinding) {
		return true, identity.ErrResourceDenied
	}
	if bridge.sessionInfoByID(requestctx.UIBridgeSessionIDFromContext(ctx)) != session {
		return true, identity.ErrResourceDenied
	}
	return true, s.rememberWindowPin(ctx, key, windowResourcePin{WindowKey: windowKey, Resource: *admitted.Resource, Target: admitted.ResourceTarget})
}
