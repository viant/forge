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
)

func targetCatalogFixture(t *testing.T) (*MetadataWindowCatalog, *windowPolicyFixture) {
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
	catalog, err := NewMetadataWindowCatalog(meta.New(afs.New(), root), root, []SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "sales", ResourceURI: "window://example/sales"}, Key: "never-source-fallback"}}, WithWindowResourceResolver(func(context.Context, string) (*identity.ResourceResolver, identity.ResourceRef, error) {
		return resolver, identity.ResourceRef{URI: "window://example/sales"}, nil
	}))
	if err != nil {
		t.Fatal(err)
	}
	return catalog, policy
}
func TestWindowInstanceActionsAndSnapshotsRetainExactTarget(t *testing.T) {
	catalog, policy := targetCatalogFixture(t)
	target := &types.WindowTarget{Platform: "ios", FormFactor: "phone", Surface: "app"}
	definition, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "sales", Target: target})
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(&Config{WindowDefinitions: catalog})
	pin := windowResourcePin{WindowKey: "sales", Resource: *definition.Definition.Resource, Target: definition.Definition.ResourceTarget}
	key := windowPinKey{Namespace: "workspace", ClientID: "client", WindowID: "instance"}
	if err := svc.rememberWindowPin(context.Background(), key, pin); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.authorizePinnedCommand(context.Background(), "workspace", "client", "ui.datasource.refresh", map[string]any{"windowId": "instance", "target": pin.Target}); err != nil {
		t.Fatal(err)
	}
	changed := *pin.Target
	changed.Platform = "web"
	if _, err := svc.authorizePinnedCommand(context.Background(), "workspace", "client", "ui.datasource.refresh", map[string]any{"windowId": "instance", "target": changed}); err == nil {
		t.Fatal("instance action changed target under existing parent pin")
	}
	raw := json.RawMessage(`{"windows":[{"windowId":"instance","windowKey":"sales","metadata":{"view":{"content":{"id":"forgedDesktop"}}},"resourceTarget":{"platform":"web"}}]}`)
	filtered, err := svc.filterResourceSnapshot(context.Background(), "workspace", "client", raw)
	if err != nil {
		t.Fatal(err)
	}
	var snapshot struct {
		Windows []struct {
			Metadata types.Window       `json:"metadata"`
			Target   types.WindowTarget `json:"resourceTarget"`
		} `json:"windows"`
	}
	if json.Unmarshal(filtered, &snapshot) != nil || len(snapshot.Windows) != 1 || snapshot.Windows[0].Metadata.View.Content.ID != "phoneRoot" || !types.SameWindowTarget(&snapshot.Windows[0].Target, pin.Target) {
		t.Fatal("snapshot substituted target metadata")
	}
	policy.allowed = false
	if _, err := svc.authorizePinnedCommand(context.Background(), "workspace", "client", "ui.datasource.refresh", map[string]any{"windowId": "instance"}); err == nil {
		t.Fatal("revoked instance target remained executable")
	}
}
