// SPDX-License-Identifier: Apache-2.0
package resource

import (
	"bytes"
	"context"
	"encoding/json"

	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/forge/backend/types"
)

type windowDefinitionRead struct {
	result      *Result[json.RawMessage]
	variant     *types.WindowResourceVariant
	independent bool
}

// publishedWindowTemplate is immutable representation metadata, never authority.
// Publication already validated the closure; the original content hash keys it.
type publishedWindowTemplate struct {
	resource   primitive.ResourceState
	historical bool
	targets    []types.WindowTargetBinding
	variants   map[string]json.RawMessage
}

// OpenPublishedWindowVariantForProvider adapts the shared typed loader to
// browser delivery while retaining the binding's trusted producer identity.
// Returned variants and descriptor bytes belong to the caller; only immutable
// producer representations are cached. A covered failure never falls back.
func (g *Gateway) OpenPublishedWindowVariantForProvider(ctx context.Context, expectedProvider, uriText string, target *types.WindowTarget) (*types.WindowResourceVariant, string, error) {
	if g == nil || ctx == nil || ctx.Err() != nil || expectedProvider == "" {
		return nil, "", identity.ErrResourceDenied
	}
	uri, err := identity.ParseResourceURI(uriText)
	if err != nil || uri.Kind != "window" {
		return nil, "", identity.ErrResourceDenied
	}
	source, claimed := g.publishedNamespace(uri.Namespace)
	if !claimed || source.connection.ProviderIdentity != expectedProvider {
		return nil, "", identity.ErrResourceDenied
	}
	connection := source.connection
	connection.Generation = g.generation(connection.Name)
	selected, err := g.readPublishedWindow(ctx, connection, identity.ResourceRef{URI: uriText}, nil, target)
	if err != nil {
		return nil, "", err
	}
	return selected.variant, selected.result.ResolvedResource.ContentFingerprint, nil
}

func (c *WindowCatalog) readWindow(ctx context.Context, connection Connection, ref identity.ResourceRef, pin *identity.ResolvedResource, target *types.WindowTarget) (*windowDefinitionRead, error) {
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil {
		return nil, err
	}
	if _, covered := c.Gateway.publishedNamespace(uri.Namespace); covered {
		return c.Gateway.readPublishedWindow(ctx, connection, ref, pin, target)
	}
	got, err := GetWithCodec[*types.CompiledWindowResource](ctx, c.Gateway, connection, ref, pin, DefinitionCodec[*types.CompiledWindowResource]{ID: "forge.window.resource.v1", Parse: types.CompileWindowResource})
	if err != nil {
		return nil, err
	}
	variant, err := got.Definition.Select(target)
	if err != nil {
		return nil, err
	}
	return &windowDefinitionRead{result: &Result[json.RawMessage]{GetResult: got.GetResult, definitionCache: got.definitionCache}, variant: variant, independent: got.Definition.IndependentDefinitions()}, nil
}
func (g *Gateway) readPublishedWindow(ctx context.Context, connection Connection, ref identity.ResourceRef, pin *identity.ResolvedResource, target *types.WindowTarget) (*windowDefinitionRead, error) {
	uri, err := identity.ParseResourceURI(ref.URI)
	if err != nil || uri.Kind != "window" || ref.Revision != "" {
		return nil, identity.ErrResourceDenied
	}
	if _, covered, err := g.publishedForURI(connection, uri); !covered || err != nil {
		if err != nil {
			return nil, err
		}
		return nil, identity.ErrResourceDenied
	}
	loaded, err := Load[*publishedWindowTemplate](ctx, g, ref.URI, PublishedCodec[*publishedWindowTemplate]{ID: "forge.published-window.v1", Immutable: true, Decode: func(_ context.Context, _ string, raw json.RawMessage) (*publishedWindowTemplate, error) {
		var envelope struct {
			Format   string                      `json:"format"`
			Targets  []types.WindowTargetBinding `json:"targets"`
			Variants map[string]json.RawMessage  `json:"variants"`
		}
		if err := json.Unmarshal(raw, &envelope); err != nil {
			return nil, err
		}
		return &publishedWindowTemplate{historical: envelope.Format == "", targets: envelope.Targets, variants: envelope.Variants, resource: primitive.ResourceState{Definition: raw}}, nil
	}})
	if err != nil {
		return nil, err
	}
	template := loaded.Value
	selected := *loaded.Resource
	if pin != nil {
		if pin.URI != selected.URI || pin.ProviderIdentity != selected.ProviderIdentity || pin.ResourceCandidate != selected.ResourceCandidate || pin.AuthorityBinding != selected.AuthorityBinding {
			return nil, identity.ErrResourceDenied
		}
		selected = *pin
	}
	normalized := types.WindowTarget{}
	if target != nil {
		normalized = *target
	}
	normalized, err = normalized.Normalize()
	if err != nil {
		return nil, err
	}
	var variant types.WindowResourceVariant
	if template.historical {
		presentation := normalized
		presentation.SelectionToken = ""
		presentation.ExecutionProof = nil
		if !types.SameWindowTarget(&presentation, nil) {
			return nil, identity.ErrResourceDenied
		}
		variant.Window = &types.Window{}
		decoder := json.NewDecoder(bytes.NewReader(template.resource.Definition))
		decoder.UseNumber()
		if err = decoder.Decode(variant.Window); err != nil {
			return nil, err
		}
		variant.Fingerprint = selected.ContentFingerprint
	} else {
		var raw json.RawMessage
		for _, binding := range template.targets {
			if binding.Target.ProfileKey() == normalized.ProfileKey() {
				raw = template.variants[binding.Variant]
				variant.Fingerprint = binding.Variant
				break
			}
		}
		if len(raw) == 0 {
			return nil, identity.ErrResourceDenied
		}
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.UseNumber()
		if err = decoder.Decode(&variant); err != nil {
			return nil, err
		}
	}
	if variant.Window == nil {
		return nil, identity.ErrResourceDenied
	}
	variant.Window.ResourceTarget = &normalized
	if err = g.verifyPublishedPin(ctx, connection, selected); err != nil {
		return nil, err
	}
	state := primitive.ResourceState{URI: ref.URI, Kind: uri.Kind, Namespace: uri.Namespace, Name: uri.Name, Lifecycle: identity.PublishedCandidate, ContentFingerprint: selected.ContentFingerprint}
	if sequence := sequenceFromContext(ctx); sequence != nil {
		sequence.constrainLease(selected.ValidUntil)
	}
	return &windowDefinitionRead{result: &Result[json.RawMessage]{GetResult: primitive.GetResult{Resource: &state, ResolvedResource: &selected}}, variant: &variant}, nil
}
