// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"github.com/viant/forge/backend/requestctx"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
	"github.com/viant/jsonrpc"
	"github.com/viant/jsonrpc/transport/server/base"
	"testing"
	"time"
)

type presentationCatalog struct {
	WindowDefinitionCatalog
	pin      identity.ResolvedResource
	target   *types.WindowTarget
	denied   bool
	renewals int
}

func (c *presentationCatalog) RenewDefaultPresentation(_ context.Context, _ string, pin identity.ResolvedResource, target *types.WindowTarget) (*WindowDefinitionGetOutput, error) {
	if c.denied || !defaultPresentationPin(windowResourcePin{Resource: pin, Target: target}) {
		return nil, identity.ErrResourceDenied
	}
	c.renewals++
	fresh := pin
	fresh.ValidUntil = time.Now().Add(time.Minute)
	next := *target
	next.SelectionToken = "fresh"
	c.pin, c.target = fresh, &next
	return &WindowDefinitionGetOutput{Definition: &types.Window{Resource: &fresh, ResourceTarget: &next}}, nil
}
func (c *presentationCatalog) RevalidateWindowResource(_ context.Context, _ string, p identity.ResolvedResource, target *types.WindowTarget) (*identity.ResolvedResource, error) {
	if c.denied || !p.ValidUntil.After(time.Now()) || !types.SameWindowTarget(target, c.target) {
		return nil, identity.ErrResourceDenied
	}
	return &p, nil
}
func TestDefaultPresentationRolloverRetainsExactBrowserInstance(t *testing.T) {
	old := &types.WindowTarget{Platform: "web", SelectionToken: "original"}
	pin := identity.ResolvedResource{URI: "window://workspace/media", ProviderIdentity: "internal", AuthorityBinding: "public-local-definition", ValidUntil: time.Now().Add(-time.Second)}
	catalog := &presentationCatalog{}
	svc := NewService(&Config{WindowDefinitions: catalog})
	key := windowPinKey{Namespace: "default", ClientID: "client", WindowID: "media-instance"}
	svc.resourcePins = map[windowPinKey]windowResourcePin{key: {WindowKey: "media", Resource: pin, Target: old}}
	command := map[string]any{"windowId": key.WindowID, "target": old}
	for i := 0; i < 2; i++ {
		if _, err := svc.authorizePinnedCommand(context.Background(), key.Namespace, key.ClientID, "ui.state.patch", command); err != nil {
			t.Fatal(err)
		}
		held, _ := svc.getWindowPin(key)
		// Advance the held read lease past its deadline without changing identity,
		// target dimensions, source, or browser state.
		held.Resource.ValidUntil = time.Now().Add(-time.Second)
		svc.resourcePins[key] = held
	}
	if catalog.renewals != 2 {
		t.Fatalf("renewals=%d", catalog.renewals)
	}
	if _, err := svc.authorizePinnedCommand(context.Background(), key.Namespace, "foreign-client", "ui.state.patch", command); err == nil {
		t.Fatal("foreign client admitted")
	}
	if _, err := svc.authorizePinnedCommand(context.Background(), "foreign-namespace", key.ClientID, "ui.state.patch", command); err == nil {
		t.Fatal("foreign namespace admitted")
	}
	changed := *old
	changed.Platform = "ios"
	command["target"] = &changed
	if _, err := svc.authorizePinnedCommand(context.Background(), key.Namespace, key.ClientID, "ui.state.patch", command); err == nil {
		t.Fatal("target switch admitted")
	}
	command["target"] = old
	catalog.denied = true
	if _, err := svc.authorizePinnedCommand(context.Background(), key.Namespace, key.ClientID, "ui.state.patch", command); err == nil {
		t.Fatal("denied renewed presentation admitted")
	}
}

func TestPresentationReadRequiresExactCurrentAttachedClient(t *testing.T) {
	svc, ctx, _ := feedOwnershipFixture(t)
	svc.hub.httpStreamable()
	bridge := svc.hub.httpBridge
	sessionCtx := context.WithValue(ctx, jsonrpc.SessionKey, &base.Session{Id: "owned-session"})
	bridge.bindSession(sessionCtx, "client-a", "alice", nil, svc.hub.clients["alice"]["client-a"])
	ctx = requestctx.WithUIBridgeSessionID(ctx, "owned-session")
	old := &types.WindowTarget{Platform: "web", SelectionToken: "original"}
	original := identity.ResolvedResource{URI: "window://workspace/media", ProviderIdentity: "internal", AuthorityBinding: "public-local-definition", ValidUntil: time.Now().Add(-time.Second)}
	catalog := &presentationCatalog{}
	svc.cfg.WindowDefinitions = catalog
	key := windowPinKey{Namespace: "alice", ClientID: "client-a", WindowID: "media-instance"}
	svc.resourcePins = map[windowPinKey]windowResourcePin{key: {WindowKey: "media", Resource: original, Target: old}}
	fresh, target, err := svc.PrepareNativePresentationRead(ctx, &original, old)
	if err != nil || !fresh.ValidUntil.After(time.Now()) || target.SelectionToken != "fresh" {
		t.Fatalf("refresh failed: %v", err)
	}
	if original.ValidUntil.After(time.Now()) || old.SelectionToken != "original" {
		t.Fatal("mutated browser provenance")
	}
	if _, _, err = svc.PrepareNativePresentationRead(ctx, &original, old); err != nil {
		t.Fatal("original target continuity", err)
	}
	foreign := requestctx.WithConversationID(ctx, "foreign-conversation")
	if _, _, err = svc.PrepareNativePresentationRead(foreign, &original, old); err == nil {
		t.Fatal("foreign conversation admitted")
	}
	private := original
	private.AuthorityBinding = "private"
	if _, _, err = svc.PrepareNativePresentationRead(ctx, &private, old); err == nil {
		t.Fatal("private pin renewed")
	}
	standalone := requestctx.WithUIBridgeSessionID(context.WithValue(context.Background(), feedOwnerKey{}, "alice"), "owned-session")
	if _, _, err = svc.PrepareNativePresentationRead(standalone, &original, old); err != nil {
		t.Fatal("standalone transport-bound renewal", err)
	}
	duplicate := key
	duplicate.WindowID = "other-instance"
	svc.resourcePins[duplicate] = svc.resourcePins[key]
	if _, _, err = svc.PrepareNativePresentationRead(standalone, &original, old); err == nil {
		t.Fatal("ambiguous instance selected")
	}
	if _, _, err = svc.PrepareNativePresentationRead(requestctx.WithUIWindowID(standalone, key.WindowID), &original, old); err != nil {
		t.Fatal("session-owned exact window routing", err)
	}
	delete(svc.resourcePins, duplicate)
	if _, _, err = svc.PrepareNativePresentationRead(requestctx.WithUIWindowID(standalone, "unknown-instance"), &original, old); err == nil {
		t.Fatal("foreign window hint admitted")
	}
	for _, id := range []string{"", "unknown-session"} {
		foreign := requestctx.WithUIBridgeSessionID(standalone, id)
		if _, _, err = svc.PrepareNativePresentationRead(foreign, &original, old); err == nil {
			t.Fatal("unbound session", id)
		}
	}
	foreignClient := svc.hub.registerHTTPClient("alice", "client-other", standalone)
	bridge.bindSession(context.WithValue(standalone, jsonrpc.SessionKey, &base.Session{Id: "foreign-session"}), "client-other", "alice", nil, foreignClient)
	if _, _, err = svc.PrepareNativePresentationRead(requestctx.WithUIBridgeSessionID(standalone, "foreign-session"), &original, old); err == nil {
		t.Fatal("foreign session borrowed native pin")
	}
	catalog.denied = true
	if _, _, err = svc.PrepareNativePresentationRead(ctx, &original, old); err == nil {
		t.Fatal("role/source denial ignored")
	}
	catalog.denied = false
	bridge.onSessionClose(&base.Session{Id: "owned-session"})
	if _, _, err = svc.PrepareNativePresentationRead(standalone, &original, old); err == nil {
		t.Fatal("closed session reused")
	}
}

func TestConsumerTargetRestoresOnlyOwnedPrivateSelection(t *testing.T) {
	svc, ctx, _ := feedOwnershipFixture(t)
	svc.hub.httpStreamable()
	bridge := svc.hub.httpBridge
	bridge.bindSession(context.WithValue(ctx, jsonrpc.SessionKey, &base.Session{Id: "private-session"}), "client-a", "alice", nil, svc.hub.clients["alice"]["client-a"])
	ctx = requestctx.WithUIBridgeSessionID(ctx, "private-session")
	child := identity.ResolvedResource{URI: "datasource://example/rows", ProviderIdentity: "owner", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte("private-source"))}, AuthorityBinding: "actor", ValidUntil: time.Now().Add(time.Minute)}
	private := &types.WindowTarget{Platform: "web", SelectionToken: "opaque", DependencyPins: map[string]identity.ResolvedResource{"rows": child}}
	pin := child
	pin.URI = "window://example/view"
	catalog := &presentationCatalog{pin: pin, target: private}
	svc.cfg.WindowDefinitions = catalog
	key := windowPinKey{Namespace: "alice", ClientID: "client-a", WindowID: "instance"}
	svc.resourcePins = map[windowPinKey]windowResourcePin{key: {WindowKey: "view", Resource: pin, Target: private}}
	public := types.ConsumerWindowTarget(private)
	_, actual, err := svc.PrepareNativePresentationRead(ctx, &pin, public)
	if err != nil || actual.DependencyPins["rows"] != child {
		t.Fatalf("private selection not restored: %v", err)
	}
	if len(public.DependencyPins) != 0 {
		t.Fatal("consumer target mutated")
	}
	counterfeit := *public
	counterfeit.SelectionToken = "counterfeit"
	if _, _, err = svc.PrepareNativePresentationRead(ctx, &pin, &counterfeit); err == nil {
		t.Fatal("counterfeit selection admitted")
	}
	catalog.denied = true
	if _, _, err = svc.PrepareNativePresentationRead(ctx, &pin, public); err == nil {
		t.Fatal("backend denial ignored")
	}
}
