package view

// Spec is a workspace-defined dynamic UI view descriptor.
// It does not duplicate the Forge Window payload; it points to an
// existing windowKey and adds model-facing metadata for routing.
type Spec struct {
	// ResourceURI is admitted routing provenance, never authored authority.
	ResourceURI        string         `json:"-" yaml:"-"`
	ID                 string         `json:"id" yaml:"id"`
	Title              string         `json:"title,omitempty" yaml:"title,omitempty"`
	Description        string         `json:"description,omitempty" yaml:"description,omitempty"`
	WindowKey          string         `json:"windowKey" yaml:"windowKey"`
	Presentation       string         `json:"presentation,omitempty" yaml:"presentation,omitempty"`
	Region             string         `json:"region,omitempty" yaml:"region,omitempty"`
	OpenMode           string         `json:"openMode,omitempty" yaml:"openMode,omitempty"`
	IdentityScope      string         `json:"identityScope,omitempty" yaml:"identityScope,omitempty"`
	QuickSearch        *QuickSearch   `json:"quickSearch,omitempty" yaml:"quickSearch,omitempty"`
	IdentityParameters []string       `json:"identityParameters,omitempty" yaml:"identityParameters,omitempty"`
	WorkspaceSharePct  int            `json:"workspaceSharePct,omitempty" yaml:"workspaceSharePct,omitempty"`
	WorkspaceMinHeight int            `json:"workspaceMinHeight,omitempty" yaml:"workspaceMinHeight,omitempty"`
	RefreshOnOpen      *bool          `json:"refreshOnOpen,omitempty" yaml:"refreshOnOpen,omitempty"`
	ReportBuilderRef   string         `json:"reportBuilderRef,omitempty" yaml:"reportBuilderRef,omitempty"`
	Parameters         []Parameter    `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	ReportPresets      []ReportPreset `json:"reportPresets,omitempty" yaml:"reportPresets,omitempty"`
	Capabilities       Capabilities   `json:"capabilities,omitempty" yaml:"capabilities,omitempty"`
	Navigation         *Navigation    `json:"navigation,omitempty" yaml:"navigation,omitempty"`
}

// QuickSearch declares the one datasource filter a name-based browse may seed
// while opening the view. The agent supplies only the search text.
type QuickSearch struct {
	DataSourceRef string `json:"dataSourceRef" yaml:"dataSourceRef"`
	Field         string `json:"field" yaml:"field"`
}

type Navigation struct {
	Label string `json:"label,omitempty" yaml:"label,omitempty"`
	Icon  string `json:"icon,omitempty" yaml:"icon,omitempty"`
}

// ReportPreset describes a built-in, read-only report starter exposed by a view.
type ReportPreset struct {
	ID          string `json:"id" yaml:"id"`
	Label       string `json:"label" yaml:"label"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
}

// ReportPresetResolution describes how a requested report starter was resolved
// to the canonical ID sent to the view.
type ReportPresetResolution struct {
	Requested  string `json:"requested"`
	ResolvedID string `json:"resolvedId"`
	MatchedBy  string `json:"matchedBy"`
}

type Parameter struct {
	Name     string `json:"name" yaml:"name"`
	Type     string `json:"type,omitempty" yaml:"type,omitempty"`
	Required bool   `json:"required,omitempty" yaml:"required,omitempty"`
	BindTo   string `json:"bindTo,omitempty" yaml:"bindTo,omitempty"`
}

type Capabilities struct {
	Show       bool `json:"show,omitempty" yaml:"show,omitempty"`
	Inspect    bool `json:"inspect,omitempty" yaml:"inspect,omitempty"`
	Datasource bool `json:"datasource,omitempty" yaml:"datasource,omitempty"`
}
