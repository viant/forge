package types

import (
	"encoding/json"
	"fmt"
	identity "github.com/viant/forge/backend/resource"
)

// CompiledWindowResource is validated immutable source metadata. It keeps
// variants private; Select returns detached caller-owned presentation data.
type CompiledWindowResource struct {
	historical *WindowResourceVariant
	envelope   WindowResourceEnvelope
}

func (c *CompiledWindowResource) IndependentDefinitions() bool {
	return c != nil && c.envelope.SchemaVersion == WindowReferenceSchemaVersion
}

func CompileWindowResource(raw json.RawMessage) (*CompiledWindowResource, error) {
	var header struct {
		Format string `json:"format"`
	}
	if json.Unmarshal(raw, &header) != nil {
		return nil, fmt.Errorf("invalid window resource")
	}
	result := &CompiledWindowResource{}
	if header.Format == "" {
		var window Window
		if decodeWindowResourceJSON(raw, &window) != nil || window.View.Content == nil || window.SelectionBinding != nil {
			return nil, fmt.Errorf("invalid historical window")
		}
		result.historical = &WindowResourceVariant{Window: &window, Fingerprint: identity.ContentFingerprint(raw)}
		return result, nil
	}
	if header.Format != WindowBundleFormat && header.Format != WindowReferencesFormat {
		return nil, fmt.Errorf("unsupported window format")
	}
	if err := decodeWindowResourceJSON(raw, &result.envelope); err != nil {
		return nil, err
	}
	if err := normalizeLegacyReferenceKeys(raw, &result.envelope); err != nil {
		return nil, err
	}
	if err := result.envelope.Validate(); err != nil {
		return nil, err
	}
	return result, nil
}
func (c *CompiledWindowResource) Select(requested *WindowTarget) (*WindowResourceVariant, error) {
	if c == nil {
		return nil, fmt.Errorf("invalid compiled window")
	}
	target := WindowTarget{}
	if requested != nil {
		target = *requested
	}
	normalized, err := target.Normalize()
	if err != nil {
		return nil, err
	}
	var original WindowResourceVariant
	if c.historical != nil {
		presentation := normalized
		presentation.SelectionToken = ""
		presentation.ExecutionProof = nil
		if !SameWindowTarget(&presentation, nil) {
			return nil, fmt.Errorf("historical window supports default target only")
		}
		original = *c.historical
	} else {
		found := false
		for _, binding := range c.envelope.Targets {
			if binding.Target.ProfileKey() == normalized.ProfileKey() {
				original = c.envelope.Variants[binding.Variant]
				original.Fingerprint = binding.Variant
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("unsupported window target")
		}
	}
	// Clone only the selected validated JSON-origin variant. Mutable maps,
	// slices, raw bytes and pointers remain private to this caller.
	selected, err := cloneJSONMetadata(original)
	if err != nil {
		return nil, err
	}
	selected.Fingerprint = original.Fingerprint
	selected.Window.ResourceTarget = &normalized
	return &selected, nil
}
