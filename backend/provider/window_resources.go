// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/viant/forge/backend/requestctx"
	"strings"
	"time"

	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

type windowPinKey struct{ Namespace, ClientID, WindowID string }
type windowResourcePin struct {
	WindowKey string
	Resource  identity.ResolvedResource
	Target    *types.WindowTarget
	// PresentedTarget is the original integrity target delivered to this exact
	// native public instance; fresh server admission uses Target.
	PresentedTarget   *types.WindowTarget
	PresentedResource *identity.ResolvedResource
}

func (s *Service) canonicalWindowCatalog() bool {
	if s == nil || s.cfg == nil {
		return false
	}
	catalog, ok := s.cfg.WindowDefinitions.(interface{ UsesResourceResolution() bool })
	return ok && catalog.UsesResourceResolution()
}
func (c *MetadataWindowCatalog) RevalidateResource(ctx context.Context, windowKey string, pin identity.ResolvedResource) (*identity.ResolvedResource, error) {
	if c == nil || c.resolveResource == nil {
		return nil, identity.ErrResourceDenied
	}
	canonical, err := c.canonicalWindowKey(ctx, windowKey)
	if err != nil {
		return nil, identity.ErrResourceDenied
	}
	windowKey = canonical
	for _, entry := range c.entries {
		if entry.WindowID == windowKey {
			allowed, err := c.checkEntryAccess(ctx, entry)
			if err != nil || !allowed {
				return nil, identity.ErrResourceDenied
			}
			resolver, ref, err := c.resolveResource(ctx, windowKey)
			if err != nil || resolver == nil || ref.URI != pin.URI {
				return nil, identity.ErrResourceDenied
			}
			_, fresh, err := resolver.ReadResolved(ctx, pin)
			return fresh, err
		}
	}
	return nil, identity.ErrResourceDenied
}
func (s *Service) revalidateWindowPin(ctx context.Context, pin windowResourcePin) (*identity.ResolvedResource, error) {
	if catalog, ok := s.cfg.WindowDefinitions.(interface {
		RevalidateWindowResource(context.Context, string, identity.ResolvedResource, *types.WindowTarget) (*identity.ResolvedResource, error)
	}); ok {
		return catalog.RevalidateWindowResource(ctx, pin.WindowKey, pin.Resource, pin.Target)
	}
	catalog, ok := s.cfg.WindowDefinitions.(interface {
		RevalidateResource(context.Context, string, identity.ResolvedResource) (*identity.ResolvedResource, error)
	})
	if !ok {
		return nil, identity.ErrResourceDenied
	}
	return catalog.RevalidateResource(ctx, pin.WindowKey, pin.Resource)
}
func (s *Service) rememberWindowPin(ctx context.Context, key windowPinKey, pin windowResourcePin) error {
	if pin.Target != nil {
		normalized, err := pin.Target.Normalize()
		if err != nil {
			return err
		}
		pin.Target = &normalized
	}
	s.resourceMu.Lock()
	defer s.resourceMu.Unlock()
	if ctx == nil || ctx.Err() != nil || !identity.MetadataExpiryValid(pin.Resource.ValidUntil, time.Now()) {
		return identity.ErrResourceDenied
	}
	if s.resourcePins == nil {
		s.resourcePins = map[windowPinKey]windowResourcePin{}
	}
	for key, value := range s.resourcePins {
		if !identity.MetadataExpiryValid(value.Resource.ValidUntil, time.Now()) && !defaultPresentationPin(value) {
			delete(s.resourcePins, key)
		}
	}
	if len(s.resourcePins) >= 1024 {
		if _, exists := s.resourcePins[key]; !exists {
			return errors.New("window resource capacity exceeded")
		}
	}
	s.resourcePins[key] = pin
	return nil
}
func (s *Service) getWindowPin(key windowPinKey) (windowResourcePin, bool) {
	s.resourceMu.Lock()
	defer s.resourceMu.Unlock()
	pin, ok := s.resourcePins[key]
	return pin, ok
}
func (s *Service) authorizePinnedCommand(ctx context.Context, ns, clientID, method string, params any) (*windowResourcePin, error) {
	raw, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	var input map[string]any
	if json.Unmarshal(raw, &input) != nil {
		return nil, identity.ErrResourceDenied
	}
	id, _ := input["windowId"].(string)
	// Commands without an exact window instance cannot act on implicit selected
	// state in canonical mode. Read-only context uses guarded snapshot endpoints.
	if id == "" {
		return nil, errors.New("resolved window instance is required")
	}
	key := windowPinKey{Namespace: ns, ClientID: clientID, WindowID: id}
	pin, ok := s.getWindowPin(key)
	if !ok {
		return nil, identity.ErrResourceDenied
	}
	for _, key := range []string{"target", "resourceTarget"} {
		if value, exists := input[key]; exists {
			raw, err := json.Marshal(value)
			var target *types.WindowTarget
			if err != nil || json.Unmarshal(raw, &target) != nil || (!types.SameWindowTarget(target, pin.Target) && (pin.PresentedTarget == nil || !types.SameWindowTarget(target, pin.PresentedTarget))) {
				return nil, identity.ErrResourceDenied
			}
		}
	}
	var renewalErr error
	pin, renewalErr = s.renewDefaultPresentationPin(ctx, key, pin)
	if renewalErr != nil {
		return nil, renewalErr
	}

	fresh, err := s.revalidateWindowPin(ctx, pin)
	if err != nil {
		return nil, errors.New("window resource is unavailable")
	}
	if fresh == nil || fresh.URI != pin.Resource.URI || fresh.ProviderIdentity != pin.Resource.ProviderIdentity || fresh.ResourceCandidate != pin.Resource.ResourceCandidate || fresh.AuthorityBinding != pin.Resource.AuthorityBinding || identity.MetadataExpiryExtends(fresh.ValidUntil, pin.Resource.ValidUntil) || !identity.MetadataExpiryValid(fresh.ValidUntil, time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	return &pin, nil
}
func (s *Service) filterResourceSnapshot(ctx context.Context, ns, clientID string, raw json.RawMessage) (json.RawMessage, error) {
	envelope, err := decodeWindowEnvelope(raw)
	if err != nil {
		return nil, err
	}
	result := windowEnvelope{Windows: []json.RawMessage{}, ConversationID: envelope.ConversationID, ClientID: envelope.ClientID}
	for _, window := range envelope.Windows {
		item, err := decodeWindowIdentity(window)
		if err != nil {
			return nil, err
		}
		if item.WindowID == "chat/new" && item.WindowKey == "chat/new" {
			// A minimal system anchor permits a connected client to open its
			// first resource; browser metadata and data never become authority.
			result.Windows = append(result.Windows, json.RawMessage(`{"windowId":"chat/new","windowKey":"chat/new"}`))
			continue
		}
		pin, ok := s.getWindowPin(windowPinKey{Namespace: ns, ClientID: clientID, WindowID: item.WindowID})
		if !ok || item.WindowKey != pin.WindowKey {
			continue
		}
		pin, err = s.renewDefaultPresentationPin(ctx, windowPinKey{Namespace: ns, ClientID: clientID, WindowID: item.WindowID}, pin)
		if err != nil {
			continue
		}
		if _, err := s.revalidateWindowPin(ctx, pin); err != nil {
			continue
		}
		definition, err := s.cfg.WindowDefinitions.Get(ctx, &WindowDefinitionGetInput{WindowID: pin.WindowKey, ResolvedResource: &pin.Resource, Target: pin.Target})
		if err != nil || definition == nil || definition.Definition == nil {
			continue
		}
		// Snapshot resource text cannot replace the trusted server pin.
		var content map[string]any
		if json.Unmarshal(window, &content) != nil {
			return nil, identity.ErrResourceDenied
		}
		content["resource"] = pin.Resource
		content["resourceTarget"] = pin.Target
		content["metadata"] = definition.Definition
		if sources, ok := content["dataSources"].(map[string]any); ok {
			for id := range sources {
				if _, allowed := definition.Definition.DataSource[id]; !allowed {
					delete(sources, id)
				}
			}
		}
		encoded, err := json.Marshal(content)
		if err != nil {
			return nil, err
		}
		result.Windows = append(result.Windows, encoded)
		if envelope.Selected.WindowID == item.WindowID {
			result.Selected.WindowID = item.WindowID
		}
	}
	// Global controls/events/datasource snapshots can refer to revoked windows.
	// Keep only the explicitly admitted instance envelope in canonical mode.
	return json.Marshal(result)
}

// UsesWindowResourceResolution reports the trusted local-window resolver mode.
func (s *Service) UsesWindowResourceResolution() bool { return s.canonicalWindowCatalog() }

// FilterResourceSnapshot lets embedding UI registries apply the same server-held
// instance authority before ingesting bridge snapshots. Legacy mode is unchanged.
func (s *Service) FilterResourceSnapshot(ctx context.Context, namespace, clientID string, raw json.RawMessage) (json.RawMessage, error) {
	if !s.canonicalWindowCatalog() {
		return append(json.RawMessage(nil), raw...), nil
	}
	return s.filterResourceSnapshot(ctx, namespace, clientID, raw)
}

// WindowResource revalidates an exact server-held instance, including archived
// event callers with no currently published browser snapshot.
func (s *Service) WindowResource(ctx context.Context, namespace, clientID, windowID, windowKey string) (*identity.ResolvedResource, error) {
	if !s.canonicalWindowCatalog() {
		return nil, identity.ErrResourceDenied
	}
	pin, ok := s.getWindowPin(windowPinKey{Namespace: namespace, ClientID: clientID, WindowID: windowID})
	if !ok || windowKey != "" && pin.WindowKey != windowKey {
		return nil, identity.ErrResourceDenied
	}
	var renewalErr error
	pin, renewalErr = s.renewDefaultPresentationPin(ctx, windowPinKey{Namespace: namespace, ClientID: clientID, WindowID: windowID}, pin)
	if renewalErr != nil {
		return nil, renewalErr
	}
	// Only this exact pinned read shares verified facts. The local phase ends
	// before callers persist events or execute any component/datasource action.
	readCtx, stop := identity.WithMetadataExpiry(ctx, pin.Resource.ValidUntil)
	defer stop()
	finish := func() error { return nil }
	if !requestctx.WindowReadDecisionActive(readCtx) {
		var err error
		readCtx, finish, err = s.BeginWindowReadDecision(readCtx)
		if err != nil {
			return nil, err
		}
	}
	current, readErr := s.revalidateWindowPin(readCtx, pin)
	finalErr := finish()
	if readErr != nil {
		return nil, readErr
	}
	if finalErr != nil {
		return nil, finalErr
	}
	if readCtx.Err() != nil || !identity.MetadataExpiryValid(pin.Resource.ValidUntil, time.Now()) || current == nil || current.URI != pin.Resource.URI || current.ProviderIdentity != pin.Resource.ProviderIdentity || current.ResourceCandidate != pin.Resource.ResourceCandidate || current.AuthorityBinding != pin.Resource.AuthorityBinding || identity.MetadataExpiryExtends(current.ValidUntil, pin.Resource.ValidUntil) || !identity.MetadataExpiryValid(current.ValidUntil, time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	terminalLease := pin.Resource.ValidUntil
	terminalLease = identity.MinimumMetadataExpiry(terminalLease, current.ValidUntil)
	terminalCtx, stopTerminal := identity.WithMetadataExpiry(ctx, terminalLease)
	defer stopTerminal()
	if err := s.checkWindowContentCurrent(terminalCtx, pin); err != nil {
		return nil, err
	}
	if terminalCtx.Err() != nil || !identity.MetadataExpiryValid(current.ValidUntil, time.Now()) || !identity.MetadataExpiryValid(pin.Resource.ValidUntil, time.Now()) {
		return nil, identity.ErrResourceDenied
	}
	return current, nil
}

func (s *Service) checkWindowContentCurrent(ctx context.Context, pin windowResourcePin) error {
	if ctx == nil || ctx.Err() != nil || !identity.MetadataExpiryValid(pin.Resource.ValidUntil, time.Now()) {
		return identity.ErrResourceDenied
	}
	bounded, stop := identity.WithMetadataExpiry(ctx, pin.Resource.ValidUntil)
	defer stop()
	ctx = bounded
	if check, ok := s.cfg.WindowDefinitions.(interface {
		CheckWindowContent(context.Context, string, identity.ResolvedResource, *types.WindowTarget) error
	}); ok {
		if err := check.CheckWindowContent(ctx, pin.WindowKey, pin.Resource, pin.Target); err != nil {
			return err
		}
	} else {
		// Older trusted catalogs retain their original authorized pinned read. No
		// missing-hook success is allowed, and the parent remains outside our phase.
		terminal, err := s.revalidateWindowPin(ctx, pin)
		if err != nil {
			return err
		}
		if terminal == nil || terminal.URI != pin.Resource.URI || terminal.ProviderIdentity != pin.Resource.ProviderIdentity || terminal.ResourceCandidate != pin.Resource.ResourceCandidate || terminal.AuthorityBinding != pin.Resource.AuthorityBinding || identity.MetadataExpiryExtends(terminal.ValidUntil, pin.Resource.ValidUntil) || !identity.MetadataExpiryValid(terminal.ValidUntil, time.Now()) {
			return identity.ErrResourceDenied
		}
	}
	if ctx.Err() != nil || !identity.MetadataExpiryValid(pin.Resource.ValidUntil, time.Now()) {
		return identity.ErrResourceDenied
	}
	return nil
}

// BindAdmittedFrameworkWindow retains the existing local chat instance after
// the HTTP OPEN admission. Routing identifiers never supply resource authority.
func (s *Service) BindAdmittedFrameworkWindow(ctx context.Context, clientID, windowID, windowKey string, admitted *types.Window) error {
	clientID, windowID, windowKey = strings.TrimSpace(clientID), strings.TrimSpace(windowID), strings.TrimSpace(windowKey)
	if !s.canonicalWindowCatalog() || clientID == "" || windowID != "chat/new" || windowKey != "chat/new" || admitted == nil || admitted.Resource == nil {
		return identity.ErrResourceDenied
	}
	owner, err := s.ns.Identity(ctx)
	if err != nil {
		return err
	}
	if requestctx.UIBridgeSessionIDFromContext(ctx) != "" {
		_, session, err := s.nativePresentationSession(ctx)
		if err != nil || session.clientID != clientID {
			return identity.ErrResourceDenied
		}
	}
	if !containsClient(s.hub.ListClients(owner.Namespace), clientID) {
		return identity.ErrResourceDenied
	}
	if !owner.ValidUntil.IsZero() {
		var stop context.CancelFunc
		ctx, stop = context.WithDeadline(ctx, owner.ValidUntil)
		defer stop()
	}
	pin := *admitted.Resource
	if deadline, ok := ctx.Deadline(); ok && deadline.Before(pin.ValidUntil) {
		pin.ValidUntil = deadline
	}
	return s.rememberWindowPin(ctx, windowPinKey{Namespace: owner.Namespace, ClientID: clientID, WindowID: windowID}, windowResourcePin{WindowKey: windowKey, Resource: pin, Target: admitted.ResourceTarget})
}

func (s *Service) renewDefaultPresentationPin(ctx context.Context, key windowPinKey, pin windowResourcePin) (windowResourcePin, error) {
	if !identity.MetadataExpiryValid(pin.Resource.ValidUntil, time.Now()) {
		if !defaultPresentationPin(pin) {
			return windowResourcePin{}, identity.ErrResourceDenied
		}
		renewal, has := s.cfg.WindowDefinitions.(interface {
			RenewDefaultPresentation(context.Context, string, identity.ResolvedResource, *types.WindowTarget) (*WindowDefinitionGetOutput, error)
		})
		if !has {
			return windowResourcePin{}, identity.ErrResourceDenied
		}
		got, err := renewal.RenewDefaultPresentation(ctx, pin.WindowKey, pin.Resource, pin.Target)
		if err != nil || got == nil || got.Definition == nil || got.Definition.Resource == nil {
			return windowResourcePin{}, identity.ErrResourceDenied
		}
		fresh := got.Definition.Resource
		if fresh.URI != pin.Resource.URI || fresh.ProviderIdentity != pin.Resource.ProviderIdentity || fresh.ResourceCandidate != pin.Resource.ResourceCandidate || fresh.AuthorityBinding != pin.Resource.AuthorityBinding || !samePresentationDimensions(pin.Target, got.Definition.ResourceTarget) {
			return windowResourcePin{}, identity.ErrResourceDenied
		}
		s.resourceMu.Lock()
		held, exists := s.resourcePins[key]
		if ctx == nil || ctx.Err() != nil || !identity.MetadataExpiryValid(got.Definition.Resource.ValidUntil, time.Now()) || !exists || !identity.SameResolvedResource(held.Resource, pin.Resource) || !types.SameWindowTarget(held.Target, pin.Target) {
			s.resourceMu.Unlock()
			return windowResourcePin{}, identity.ErrResourceDenied
		}
		if pin.PresentedTarget == nil {
			pin.PresentedTarget = pin.Target
			previous := pin.Resource
			pin.PresentedResource = &previous
		}
		pin.Resource = *got.Definition.Resource
		pin.Target = got.Definition.ResourceTarget
		s.resourcePins[key] = pin
		s.resourceMu.Unlock()
	}
	return pin, nil
}

func defaultPresentationPin(pin windowResourcePin) bool {
	if pin.Resource.ProviderIdentity != "internal" || pin.Resource.AuthorityBinding != "public-local-definition" || pin.Target == nil || len(pin.Target.DependencyPins) != 0 || pin.Target.ExecutionProof != nil {
		return false
	}
	uri, err := identity.ParseResourceURI(pin.Resource.URI)
	return err == nil && uri.Kind == "window" && uri.Namespace == "workspace"
}

func samePresentationDimensions(a, b *types.WindowTarget) bool {
	if a == nil || b == nil {
		return false
	}
	left, right := *a, *b
	left.SelectionToken, right.SelectionToken = "", ""
	return types.SameWindowTarget(&left, &right)
}
