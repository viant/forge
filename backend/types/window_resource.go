package types

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	primitive "github.com/viant/agently-core/protocol/primitive"
	identity "github.com/viant/agently-core/protocol/resource"
)

const WindowBundleFormat = "window.bundle"
const WindowReferencesFormat = "window.references"

// WindowTarget is presentation input, never an identity or an entitlement.
type WindowTarget struct {
	SelectionToken string `json:"selectionToken,omitempty"`
	// DependencyPins are runtime-only exact child authority snapshots. The
	// target proof signs them; authored target declarations must omit them.
	DependencyPins map[string]identity.ResolvedResource `json:"dependencyPins,omitempty"`
	Platform       string                               `json:"platform,omitempty"`
	FormFactor     string                               `json:"formFactor,omitempty"`
	Surface        string                               `json:"surface,omitempty"`
	Capabilities   []string                             `json:"capabilities,omitempty"`
}

func (t WindowTarget) Normalize() (WindowTarget, error) {
	if len(t.SelectionToken) > 256 || strings.TrimSpace(t.SelectionToken) != t.SelectionToken {
		return WindowTarget{}, fmt.Errorf("invalid window selection token")
	}
	for _, value := range []string{t.Platform, t.FormFactor, t.Surface} {
		if strings.TrimSpace(value) != value || len(value) > 64 || strings.ContainsAny(value, "/\\:\x00?#*") {
			return WindowTarget{}, fmt.Errorf("invalid window target")
		}
	}
	if len(t.Capabilities) > 128 {
		return WindowTarget{}, fmt.Errorf("invalid window capabilities")
	}
	t.Capabilities = slices.Clone(t.Capabilities)
	for _, value := range t.Capabilities {
		if value == "" || strings.TrimSpace(value) != value || len(value) > 128 {
			return WindowTarget{}, fmt.Errorf("invalid window capabilities")
		}
	}
	slices.Sort(t.Capabilities)
	t.Capabilities = slices.Compact(t.Capabilities)
	if len(t.Capabilities) == 0 {
		t.Capabilities = nil
	}
	if len(t.DependencyPins) > 128 {
		return WindowTarget{}, fmt.Errorf("invalid dependency pins")
	}
	if len(t.DependencyPins) > 0 {
		pins := make(map[string]identity.ResolvedResource, len(t.DependencyPins))
		for id, pin := range t.DependencyPins {
			uri, e := identity.ParseResourceURI(pin.URI)
			if id == "" || strings.TrimSpace(id) != id || len(id) > 256 || e != nil || uri.Kind != "datasource" || !pin.ResourceCandidate.Valid() || pin.ProviderIdentity == "" || strings.TrimSpace(pin.ProviderIdentity) != pin.ProviderIdentity || pin.AuthorityBinding == "" || pin.ValidUntil.IsZero() {
				return WindowTarget{}, fmt.Errorf("invalid dependency pin")
			}
			pin.ValidUntil = pin.ValidUntil.UTC()
			pins[id] = pin
		}
		t.DependencyPins = pins
	} else {
		t.DependencyPins = nil
	}
	return t, nil
}

// ProfileKey follows the existing import branch semantics. For known platforms,
// surface/capabilities do not influence import resolution. Generic app surfaces
// select the mobile branch explicitly; capabilities remain rendering hints.
func (t WindowTarget) ProfileKey() string {
	surface := ""
	if t.Platform != "web" && t.Platform != "ios" && t.Platform != "android" && t.FormFactor != "phone" && t.FormFactor != "tablet" && t.FormFactor != "foldable" && t.Surface == "app" {
		surface = "app"
	}
	return t.Platform + "|" + t.FormFactor + "|" + surface
}
func SameWindowTarget(a, b *WindowTarget) bool {
	left, right := WindowTarget{}, WindowTarget{}
	if a != nil {
		left = *a
	}
	if b != nil {
		right = *b
	}
	left, e1 := left.Normalize()
	right, e2 := right.Normalize()
	leftPins, _ := json.Marshal(left.DependencyPins)
	rightPins, _ := json.Marshal(right.DependencyPins)
	return e1 == nil && e2 == nil && string(leftPins) == string(rightPins) && left.SelectionToken == right.SelectionToken && left.Platform == right.Platform && left.FormFactor == right.FormFactor && left.Surface == right.Surface && slices.Equal(left.Capabilities, right.Capabilities)
}

type WindowTargetBinding struct {
	Target  WindowTarget `json:"target"`
	Variant string       `json:"variant"`
}
type WindowResourceVariant struct {
	Fingerprint         string                                   `json:"-"`
	Window              *Window                                  `json:"window"`
	DataSources         map[string]json.RawMessage               `json:"dataSources"`
	DataSourceResources map[string]primitive.DataSourceReference `json:"dataSourceResources,omitempty"`
}
type WindowResourceEnvelope struct {
	SchemaVersion int                              `json:"schemaVersion"`
	Format        string                           `json:"format"`
	Targets       []WindowTargetBinding            `json:"targets"`
	Variants      map[string]WindowResourceVariant `json:"variants"`
}

func (e *WindowResourceEnvelope) Validate() error {
	if e == nil || !(e.SchemaVersion == 2 && e.Format == WindowBundleFormat || e.SchemaVersion == 3 && e.Format == WindowReferencesFormat) || len(e.Targets) == 0 || len(e.Targets) > 128 || len(e.Variants) == 0 || len(e.Variants) > 128 {
		return fmt.Errorf("invalid window bundle")
	}
	seen, used := map[string]bool{}, map[string]bool{}
	for _, binding := range e.Targets {
		target, err := binding.Target.Normalize()
		if err != nil || len(target.Capabilities) > 0 || target.SelectionToken != "" || len(target.DependencyPins) > 0 {
			return fmt.Errorf("invalid declared target")
		}
		key := target.ProfileKey()
		if seen[key] {
			return fmt.Errorf("ambiguous window target")
		}
		seen[key] = true
		variant, ok := e.Variants[binding.Variant]
		if !ok {
			return fmt.Errorf("missing window variant")
		}
		fingerprint, err := WindowVariantFingerprint(variant)
		if err != nil || fingerprint != binding.Variant {
			return fmt.Errorf("window variant fingerprint mismatch")
		}
		used[binding.Variant] = true
	}
	if !seen[(WindowTarget{}).ProfileKey()] || len(used) != len(e.Variants) {
		return fmt.Errorf("window bundle requires explicit default and no orphan variants")
	}
	for _, v := range e.Variants {
		if len(v.DataSourceResources) > 0 && e.SchemaVersion != 3 {
			return fmt.Errorf("datasource resource references require window format 3")
		}
		for id, ref := range v.DataSourceResources {
			if ref.Validate(false) != nil {
				return fmt.Errorf("invalid datasource resource reference")
			}
			if _, ok := v.DataSources[id]; !ok {
				return fmt.Errorf("unmaterialized datasource reference")
			}
		}
		if v.Window == nil || v.Window.View.Content == nil || v.Window.Resource != nil || v.Window.ResourceTarget != nil || len(v.DataSources) != len(v.Window.DataSource) || len(v.Window.ResourceDependencies) != len(v.Window.DataSource) {
			return fmt.Errorf("invalid complete window variant")
		}
		if err := ValidateResourceModelStructure(v.Window); err != nil {
			return err
		}
		for id := range v.Window.DataSource {
			raw := v.DataSources[id]
			var object map[string]json.RawMessage
			var descriptorID string
			fingerprint, err := WindowDescriptorFingerprint(raw)
			if err != nil || id == "" || json.Unmarshal(raw, &object) != nil || object == nil || json.Unmarshal(object["id"], &descriptorID) != nil || descriptorID != id || v.Window.ResourceDependencies[id] != fingerprint {
				return fmt.Errorf("window datasource fingerprint mismatch")
			}
		}
	}
	return nil
}

// SelectWindowResource reads only approved immutable bytes. A historical
// singleton supports its default presentation exclusively; it cannot acquire
// unstored mobile content from a current source directory.
func SelectWindowResource(raw json.RawMessage, requested *WindowTarget) (*WindowResourceVariant, error) {
	return selectWindowResource(raw, requested, false)
}

// SelectWindowResourceWithReferences is explicit opt-in for hosts that verify
// every referenced datasource and retain/revalidate its original authority pin.
// Ordinary consumers reject this format rather than treating refs as inline.
func SelectWindowResourceWithReferences(raw json.RawMessage, requested *WindowTarget) (*WindowResourceVariant, error) {
	return selectWindowResource(raw, requested, true)
}
func selectWindowResource(raw json.RawMessage, requested *WindowTarget, references bool) (*WindowResourceVariant, error) {
	target := WindowTarget{}
	if requested != nil {
		target = *requested
	}
	normalized, err := target.Normalize()
	if err != nil {
		return nil, err
	}
	var header struct {
		Format        string `json:"format"`
		SchemaVersion int    `json:"schemaVersion"`
	}
	if json.Unmarshal(raw, &header) != nil {
		return nil, fmt.Errorf("invalid window resource")
	}
	if header.Format == "" {
		presentation := normalized
		presentation.SelectionToken = ""
		if !SameWindowTarget(&presentation, nil) {
			return nil, fmt.Errorf("historical window supports default target only")
		}
		var window Window
		if json.Unmarshal(raw, &window) != nil || window.View.Content == nil {
			return nil, fmt.Errorf("invalid historical window")
		}
		return &WindowResourceVariant{Window: &window, Fingerprint: identity.ContentFingerprint(raw)}, nil
	}
	if header.Format != WindowBundleFormat && header.Format != WindowReferencesFormat {
		return nil, fmt.Errorf("unsupported window format")
	}
	if header.Format == WindowReferencesFormat && !references {
		return nil, fmt.Errorf("window references require an installed dependency verifier")
	}
	var envelope WindowResourceEnvelope
	if json.Unmarshal(raw, &envelope) != nil {
		return nil, fmt.Errorf("invalid window bundle")
	}
	if err := envelope.Validate(); err != nil {
		return nil, err
	}
	for _, binding := range envelope.Targets {
		if binding.Target.ProfileKey() == normalized.ProfileKey() {
			variant := envelope.Variants[binding.Variant]
			variant.Fingerprint = binding.Variant
			variant.Window.ResourceTarget = &normalized
			return &variant, nil
		}
	}
	return nil, fmt.Errorf("unsupported window target")
}
