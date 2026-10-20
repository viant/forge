package types

type GateRequirementsEditorSpec struct {
	DataSourceRef         string            `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	ResourceField         string            `json:"resourceField,omitempty" yaml:"resourceField,omitempty"`
	ActionField           string            `json:"actionField,omitempty" yaml:"actionField,omitempty"`
	PreviewSelectionField string            `json:"previewSelectionField,omitempty" yaml:"previewSelectionField,omitempty"`
	Operations            map[string]string `json:"operations" yaml:"operations"`
	ReadOnly              bool              `json:"readOnly,omitempty" yaml:"readOnly,omitempty"`
	OnStateChange         string            `json:"onStateChange,omitempty" yaml:"onStateChange,omitempty"`
}
