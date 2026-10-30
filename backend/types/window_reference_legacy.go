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
