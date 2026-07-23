package registry

import (
	"fmt"
	"strings"
)

const (
	DefaultRoot = "extension/forge/reporting"

	KindBuilder  = "forge.reporting.builder"
	KindPreset   = "forge.reporting.preset"
	KindFragment = "forge.reporting.fragment"

	legacyBuilderKind = "dashboard.reportBuilder"
)

// Asset is one workspace-owned reporting definition discovered under the
// configured reporting root. Raw remains generic so workspace metadata can
// evolve without introducing a backend release gate for every UI property.
type Asset struct {
	Kind        string         `json:"kind"`
	ID          string         `json:"id"`
	BuilderRef  string         `json:"builderRef,omitempty"`
	Label       string         `json:"label,omitempty"`
	Description string         `json:"description,omitempty"`
	SourcePath  string         `json:"sourcePath"`
	YAMLPath    string         `json:"yamlPath"`
	Legacy      bool           `json:"legacy,omitempty"`
	Raw         map[string]any `json:"raw,omitempty"`
}

// Registry is the immutable result of one successful discovery pass.
type Registry struct {
	Root      string
	Builders  []*Asset
	Presets   []*Asset
	Fragments []*Asset

	buildersByID  map[string]*Asset
	presetsByID   map[string]*Asset
	fragmentsByID map[string]*Asset
}

func (r *Registry) Builder(id string) *Asset {
	if r == nil {
		return nil
	}
	return r.buildersByID[normalizeID(id)]
}

func (r *Registry) Preset(id string) *Asset {
	if r == nil {
		return nil
	}
	return r.presetsByID[normalizeID(id)]
}

func (r *Registry) Fragment(id string) *Asset {
	if r == nil {
		return nil
	}
	return r.fragmentsByID[normalizeID(id)]
}

func (r *Registry) PresetsForBuilder(builderRef string) []*Asset {
	if r == nil {
		return nil
	}
	key := normalizeID(builderRef)
	result := make([]*Asset, 0)
	for _, preset := range r.Presets {
		if normalizeID(preset.BuilderRef) == key {
			result = append(result, preset)
		}
	}
	return result
}

type Diagnostic struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	SourcePath string `json:"sourcePath,omitempty"`
	YAMLPath   string `json:"yamlPath,omitempty"`
	Line       int    `json:"line,omitempty"`
	Column     int    `json:"column,omitempty"`
}

func (d Diagnostic) Error() string {
	location := strings.TrimSpace(d.SourcePath)
	if d.Line > 0 {
		location += fmt.Sprintf(":%d", d.Line)
		if d.Column > 0 {
			location += fmt.Sprintf(":%d", d.Column)
		}
	}
	if d.YAMLPath != "" {
		location += " " + d.YAMLPath
	}
	if location == "" {
		return d.Message
	}
	return location + ": " + d.Message
}

type ValidationError struct {
	Diagnostics []Diagnostic
}

func (e *ValidationError) Error() string {
	if e == nil || len(e.Diagnostics) == 0 {
		return "reporting registry validation failed"
	}
	if len(e.Diagnostics) == 1 {
		return e.Diagnostics[0].Error()
	}
	return fmt.Sprintf("reporting registry validation failed with %d issues; first: %s", len(e.Diagnostics), e.Diagnostics[0].Error())
}

func normalizeID(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
