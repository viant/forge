package types

// ParameterEditorSpec composes reusable form controls for a typed parameter.
// Option discovery, field bindings, validation and mutations remain metadata-owned.
// No application endpoint, source kind, codec or authentication policy is implicit.
type ParameterEditorSpec struct {
	DataSourceRef string                   `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Label         string                   `json:"label,omitempty" yaml:"label,omitempty"`
	Fields        []*Item                  `json:"fields,omitempty" yaml:"fields,omitempty"`
	Sections      []ParameterEditorSection `json:"sections,omitempty" yaml:"sections,omitempty"`
	Draft         *DraftFormSpec           `json:"draft,omitempty" yaml:"draft,omitempty"`
	ReadOnlyWhen  map[string]interface{}   `json:"readOnlyWhen,omitempty" yaml:"readOnlyWhen,omitempty"`
}
type ParameterEditorSection struct {
	ID          string                 `json:"id" yaml:"id"`
	Label       string                 `json:"label" yaml:"label"`
	Open        bool                   `json:"open,omitempty" yaml:"open,omitempty"`
	Fields      []*Item                `json:"fields,omitempty" yaml:"fields,omitempty"`
	VisibleWhen map[string]interface{} `json:"visibleWhen,omitempty" yaml:"visibleWhen,omitempty"`
}
