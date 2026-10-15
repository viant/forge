// SPDX-License-Identifier: Apache-2.0
// Provider implementation extracted from Viant Agently Core.
package service

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/viant/afs"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
)

func TestMetadataWindowCatalogGetPreservesLargeParametersAndTargetProof(t *testing.T) {
	const exactInteger = "9007199254740993"
	makeVariant := func(id string, parameters []map[string]interface{}) types.WindowResourceVariant {
		return types.WindowResourceVariant{
			Window: &types.Window{Parameters: parameters, View: types.View{Content: &types.Container{
				ID: id,
				Containers: []types.Container{{
					ID: "nested",
				}},
			}}, DataSource: map[string]types.DataSource{}},
			DataSources: map[string]json.RawMessage{},
		}
	}
	phoneParameters := []map[string]interface{}{{
		"name":    "AccountId",
		"default": json.Number(exactInteger),
		"nested":  map[string]interface{}{"default": json.Number(exactInteger)},
	}}
	variants := map[string]types.WindowResourceVariant{}
	targets := []types.WindowTargetBinding{}
	for _, item := range []struct {
		target  types.WindowTarget
		variant types.WindowResourceVariant
	}{{types.WindowTarget{}, makeVariant("desktop", nil)},
		{types.WindowTarget{Platform: "ios", FormFactor: "phone"}, makeVariant("phone", phoneParameters)}} {
		fingerprint, err := types.WindowVariantFingerprint(item.variant)
		if err != nil {
			t.Fatal(err)
		}
		variants[fingerprint] = item.variant
		targets = append(targets, types.WindowTargetBinding{Target: item.target, Variant: fingerprint})
	}
	envelope := types.WindowResourceEnvelope{SchemaVersion: 2, Format: types.WindowBundleFormat, Targets: targets, Variants: variants}
	raw, err := json.Marshal(envelope)
	if err != nil {
		t.Fatal(err)
	}
	selectedTarget := &types.WindowTarget{Platform: "ios", FormFactor: "phone", Surface: "app"}
	selected, err := types.SelectWindowResource(raw, selectedTarget)
	if err != nil {
		t.Fatal(err)
	}

	source := &canonicalSource{content: map[string]json.RawMessage{"1": raw}}
	policy := &windowPolicyFixture{binding: "verified-account", omitted: "1", allowed: true}
	resolver := &identity.ResourceResolver{Source: source, Policy: policy}
	root := t.TempDir()
	catalog, err := NewMetadataWindowCatalog(meta.New(afs.New(), root), root,
		[]SavedWindow{{WindowDefinitionSummary: WindowDefinitionSummary{WindowID: "precision", ResourceURI: "window://example/precision"}, Key: "unused"}},
		WithWindowResourceResolver(func(context.Context, string) (*identity.ResourceResolver, identity.ResourceRef, error) {
			return resolver, identity.ResourceRef{URI: "window://example/precision"}, nil
		}))
	if err != nil {
		t.Fatal(err)
	}

	got, err := catalog.Get(context.Background(), &WindowDefinitionGetInput{WindowID: "precision", Target: selectedTarget})
	if err != nil {
		t.Fatal(err)
	}
	if got.Definition.Resource == nil || got.Definition.Resource.ContentFingerprint != identity.ContentFingerprint(raw) {
		t.Fatalf("source pin changed: %+v", got.Definition.Resource)
	}
	if got.Definition.View.Content.ID != "phone" || len(got.Definition.View.Content.Containers) != 1 || got.Definition.View.Content.Containers[0].ID != "nested" {
		t.Fatalf("selected nested container changed: %+v", got.Definition.View.Content)
	}
	parameters := got.Definition.Parameters
	if len(parameters) != 1 || parameters[0]["default"] != json.Number(exactInteger) {
		t.Fatalf("large window parameter lost precision: %#v", parameters)
	}
	nested := parameters[0]["nested"].(map[string]interface{})
	if nested["default"] != json.Number(exactInteger) {
		t.Fatalf("nested window parameter lost precision: %#v", nested["default"])
	}
	if got.Definition.ResourceTarget == nil || got.Definition.ResourceTarget.SelectionToken == "" {
		t.Fatal("selected target proof was not returned")
	}
	if err := catalog.VerifyWindowTarget(context.Background(), *got.Definition.Resource, *got.Definition.ResourceTarget, selected.Fingerprint); err != nil {
		t.Fatalf("target proof did not bind to selected variant fingerprint %s: %v", selected.Fingerprint, err)
	}
}
