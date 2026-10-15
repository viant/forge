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

type admittedPresentationCatalog struct {
	WindowDefinitionCatalog
	reads int
}

func (*admittedPresentationCatalog) IsDefaultPresentationWindow(pin identity.ResolvedResource) bool {
	return pin.ProviderIdentity == "internal"
}
func (c *admittedPresentationCatalog) RevalidateWindowResource(_ context.Context, _ string, pin identity.ResolvedResource, _ *types.WindowTarget) (*identity.ResolvedResource, error) {
	c.reads++
	return &pin, nil
}

func TestNativePresentationBindsServerAdmittedSnapshotWithoutReload(t *testing.T) {
	svc, ctx, _ := feedOwnershipFixture(t)
	svc.hub.httpStreamable()
	bridge := svc.hub.httpBridge
	bridge.bindSession(context.WithValue(ctx, jsonrpc.SessionKey, &base.Session{Id: "owned-session"}), "client-a", "alice", nil, svc.hub.clients["alice"]["client-a"])
	ctx = requestctx.WithUIBridgeSessionID(ctx, "owned-session")
	catalog := &admittedPresentationCatalog{}
	svc.cfg.WindowDefinitions = catalog
	pin := identity.ResolvedResource{URI: "window://workspace/media", ProviderIdentity: "internal", AuthorityBinding: "public-local-definition", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: identity.ContentFingerprint([]byte(`{"original":true}`))}, ValidUntil: time.Now().Add(time.Minute)}
	admitted := &types.Window{Resource: &pin, ResourceTarget: &types.WindowTarget{Platform: "web", SelectionToken: "original"}}
	handled, err := svc.BindAdmittedNativePresentationWindow(ctx, "client-a", "instance", "media", admitted)
	if !handled || err != nil || catalog.reads != 0 {
		t.Fatalf("binding reloaded admitted source: handled=%t err=%v reads=%d", handled, err, catalog.reads)
	}
	held, ok := svc.getWindowPin(windowPinKey{Namespace: "alice", ClientID: "client-a", WindowID: "instance"})
	if !ok || held.Resource != pin || !types.SameWindowTarget(held.Target, admitted.ResourceTarget) {
		t.Fatal("admitted original pin/target lost")
	}
	if _, err = svc.BindAdmittedNativePresentationWindow(ctx, "foreign-client", "instance", "media", admitted); err == nil {
		t.Fatal("foreign client borrowed instance")
	}
	foreign := requestctx.WithUIBridgeSessionID(context.WithValue(context.Background(), feedOwnerKey{}, "bob"), "owned-session")
	if _, err = svc.BindAdmittedNativePresentationWindow(foreign, "client-a", "instance", "media", admitted); err == nil {
		t.Fatal("foreign owner borrowed session")
	}
	changed := pin
	changed.ContentFingerprint = identity.ContentFingerprint([]byte(`{"changed":true}`))
	if _, err = svc.BindAdmittedNativePresentationWindow(ctx, "client-a", "instance", "media", &types.Window{Resource: &changed, ResourceTarget: admitted.ResourceTarget}); err == nil {
		t.Fatal("existing instance candidate replaced")
	}
}
