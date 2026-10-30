package types

import (
	"encoding/json"
	"fmt"
	identity "github.com/viant/forge/backend/resource"
)

// normalizeLegacyReferenceKeys validates stored variant keys before discarding
// legacy consumer hashes. Resource read authorization remains with the caller.
func normalizeLegacyReferenceKeys(raw json.RawMessage, envelope *WindowResourceEnvelope) error {
	type legacyReference struct {
		Resource           identity.ResourceRef `json:"resource"`
		ContentFingerprint string               `json:"contentFingerprint"`
		ProviderIdentity   string               `json:"providerIdentity"`
	}
	var stored struct {
		Variants map[string]struct {
			References map[string]legacyReference `json:"dataSourceResources"`
		} `json:"variants"`
	}
	if err := json.Unmarshal(raw, &stored); err != nil {
		return err
	}
	replacements := map[string]string{}
	for key, variant := range envelope.Variants {
		refs := stored.Variants[key].References
		legacy := false
		for _, ref := range refs {
			if ref.ContentFingerprint != "" {
				legacy = true
			}
		}
		if !legacy {
			continue
		}
		if variant.Window == nil {
			return fmt.Errorf("missing window")
		}
		window := *variant.Window
		window.SelectionBinding = nil
		descriptors := map[string]json.RawMessage{}
		for id, descriptor := range variant.DataSources {
			canonical, err := CanonicalWindowDescriptor(descriptor)
			if err != nil {
				return err
			}
			descriptors[id] = canonical
		}
		original := struct {
			Window      *Window                    `json:"window"`
			DataSources map[string]json.RawMessage `json:"dataSources"`
			References  map[string]legacyReference `json:"dataSourceResources,omitempty"`
		}{&window, descriptors, refs}
		encoded, err := json.Marshal(original)
		if err != nil {
			return err
		}
		if identity.ContentFingerprint(encoded) != key {
			return fmt.Errorf("window variant fingerprint mismatch")
		}
		normalized, err := WindowVariantFingerprint(variant)
		if err != nil {
			return err
		}
		replacements[key] = normalized
	}
	for old, key := range replacements {
		variant := envelope.Variants[old]
		delete(envelope.Variants, old)
		envelope.Variants[key] = variant
	}
	for i := range envelope.Targets {
		if key, ok := replacements[envelope.Targets[i].Variant]; ok {
			envelope.Targets[i].Variant = key
		}
	}
	return nil
}

// NormalizeWindowReferenceVariant reads an internally stored variant, verifies
// its original content key, and removes obsolete consumer reference hashes.
// The caller must separately authorize the owning stored resource.
func NormalizeWindowReferenceVariant(raw json.RawMessage, expected string) (*WindowResourceVariant, error) {
	var variant WindowResourceVariant
	if err := decodeWindowResourceJSON(raw, &variant); err != nil {
		return nil, err
	}
	fingerprint, err := WindowVariantFingerprint(variant)
	if err != nil {
		return nil, err
	}
	if fingerprint == expected {
		variant.Fingerprint = fingerprint
		return &variant, nil
	}
	encoded, err := json.Marshal(struct {
		Variants map[string]json.RawMessage `json:"variants"`
	}{map[string]json.RawMessage{expected: raw}})
	if err != nil {
		return nil, err
	}
	envelope := WindowResourceEnvelope{Variants: map[string]WindowResourceVariant{expected: variant}}
	if err = normalizeLegacyReferenceKeys(encoded, &envelope); err != nil {
		return nil, err
	}
	normalized, ok := envelope.Variants[fingerprint]
	if !ok {
		return nil, fmt.Errorf("window variant fingerprint mismatch")
	}
	normalized.Fingerprint = fingerprint
	return &normalized, nil
}
