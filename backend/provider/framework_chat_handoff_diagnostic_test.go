// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"github.com/viant/afs"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
	"testing"
	"time"
)

func frameworkChatCatalogFixture(t *testing.T) (*MetadataWindowCatalog, *windowPolicyFixture) {
	t.Helper()
	envelope := types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Variants: map[string]types.WindowResourceVariant{}}
	for _, p := range []struct {
		target types.WindowTarget
		id     string
	}{{types.WindowTarget{}, "desktopRoot"}, {types.WindowTarget{Platform: "ios", FormFactor: "phone"}, "phoneRoot"}} {
		variant := types.WindowResourceVariant{Window: &types.Window{View: types.View{Content: &types.Container{ID: p.id}}, DataSource: map[string]types.DataSource{}}, DataSources: map[string]json.RawMessage{}}
		raw, _ := json.Marshal(variant)
		key := identity.ContentFingerprint(raw)
		envelope.Variants[key] = variant
		envelope.Targets = append(envelope.Targets, types.WindowTargetBinding{Target: p.target, Variant: key})
	}
	raw, _ := json.Marshal(envelope)
	source := &canonicalSource{content: map[string]json.RawMessage{"1": raw}}
	policy := &windowPolicyFixture{binding: "verified-account", omitted: "1", allowed: true}
	resolver := &identity.ResourceResolver{Source: source, Policy: policy}
	root := t.TempDir()
	catalog, err := NewMetadataWindowCatalog(meta.New(afs.New(), root), root, []SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "chat/new", ResourceURI: "window://agently/chat-new"}, Key: "never-source-fallback"}}, WithWindowResourceResolver(func(context.Context, string) (*identity.ResourceResolver, identity.ResourceRef, error) {
		return resolver, identity.ResourceRef{URI: "window://agently/chat-new"}, nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	return catalog, policy
}
func TestFrameworkChatAnchorNeedsTrustedExactInstanceHandoff(t *testing.T) {
	ctx := context.Background()
	catalog, policy := frameworkChatCatalogFixture(t)
	svc := NewService(&Config{WindowDefinitions: catalog})
	raw := json.RawMessage(`{"conversationId":"owned-conversation","windows":[{"windowId":"chat/new","windowKey":"chat/new","metadata":{"forged":true}}]}`)
	filtered, err := svc.FilterResourceSnapshot(ctx, "owned-namespace", "owned-client", raw)
	if err != nil {
		t.Fatal(err)
	}
	var snapshot struct {
		Windows []map[string]any `json:"windows"`
	}
	if err := json.Unmarshal(filtered, &snapshot); err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Windows) != 1 || len(snapshot.Windows[0]) != 2 {
		t.Fatal("anchor must contain only routing identity")
	}
	if pin, err := svc.WindowResource(ctx, "owned-namespace", "owned-client", "chat/new", "chat/new"); err == nil || pin != nil {
		t.Fatal("snapshot anchor acquired authority")
	}
	definition, err := svc.WindowDefinitionGet(ctx, &WindowDefinitionGetInput{WindowID: "chat/new"})
	if err != nil {
		t.Fatal(err)
	}
	if pin, err := svc.WindowResource(ctx, "owned-namespace", "owned-client", "chat/new", "chat/new"); err == nil || pin != nil {
		t.Fatal("definition GET implicitly bound browser instance")
	}
	admitted, err := svc.ProjectWindow(ctx, definition.Definition)
	if err != nil {
		t.Fatal(err)
	}
	key := windowPinKey{Namespace: "owned-namespace", ClientID: "owned-client", WindowID: "chat/new"}
	if err := svc.rememberWindowPin(ctx, key, windowResourcePin{WindowKey: "chat/new", Resource: *admitted.Resource, Target: admitted.ResourceTarget}); err != nil {
		t.Fatal(err)
	}
	current, err := svc.WindowResource(ctx, key.Namespace, key.ClientID, key.WindowID, "chat/new")
	if err != nil || current == nil || current.URI != "window://agently/chat-new" {
		t.Fatal("trusted admitted instance handoff failed", err)
	}
	for _, other := range []windowPinKey{{Namespace: "foreign", ClientID: key.ClientID, WindowID: key.WindowID}, {Namespace: key.Namespace, ClientID: "foreign", WindowID: key.WindowID}, {Namespace: key.Namespace, ClientID: key.ClientID, WindowID: "other"}} {
		if pin, err := svc.WindowResource(ctx, other.Namespace, other.ClientID, other.WindowID, "chat/new"); err == nil || pin != nil {
			t.Fatal("pin crossed exact identity boundary")
		}
	}
	policy.allowed = false
	if pin, err := svc.WindowResource(ctx, key.Namespace, key.ClientID, key.WindowID, "chat/new"); err == nil || pin != nil {
		t.Fatal("existing managing authority denial ignored")
	}
}

type delayedFrameworkHandoffCatalog struct{ narrowWindowReadCatalog }

func (c *delayedFrameworkHandoffCatalog) RevalidateWindowResource(_ context.Context, _ string, pin identity.ResolvedResource, _ *types.WindowTarget) (*identity.ResolvedResource, error) {
	time.Sleep(30 * time.Millisecond)
	return &pin, nil
}
func TestFrameworkHandoffCannotInstallPinAfterAdmissionExpires(t *testing.T) {
	pin := identity.ResolvedResource{ProviderIdentity: "owned", URI: "window://agently/chat-new", ResourceCandidate: identity.ResourceCandidate{Kind: identity.WorkingCandidate, ContentFingerprint: "owned-content"}, AuthorityBinding: "owned-actor", ValidUntil: time.Now().Add(time.Minute)}
	catalog := &delayedFrameworkHandoffCatalog{}
	svc := NewService(&Config{WindowDefinitions: catalog})
	svc.hub.registerHTTPClient("default", "owned-client", context.Background())
	// Binding must reject an already expired admission, independent of
	// incidental latency from a redundant source read.
	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Millisecond))
	defer cancel()
	if err := svc.BindAdmittedFrameworkWindow(ctx, "owned-client", "chat/new", "chat/new", &types.Window{Resource: &pin}); err == nil {
		t.Fatal("expired admission handoff succeeded")
	}
	if _, ok := svc.getWindowPin(windowPinKey{Namespace: "default", ClientID: "owned-client", WindowID: "chat/new"}); ok {
		t.Fatal("expired handoff installed a pin")
	}
}
