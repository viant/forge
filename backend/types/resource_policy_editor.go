package types

// ResourcePolicyEditorSpec configures a reusable revisioned policy editor.
// Its datasources own authenticated reads/writes and authoritative decisions.
type ResourcePolicyEditorSpec struct {
	ActionsByKindField string                 `json:"actionsByKindField,omitempty" yaml:"actionsByKindField,omitempty"`
	ChoicesField       string                 `json:"choicesField,omitempty" yaml:"choicesField,omitempty"`
	DataSourceRef      string                 `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	ResourceField      string                 `json:"resourceField,omitempty" yaml:"resourceField,omitempty"`
	DisplayNameField   string                 `json:"displayNameField,omitempty" yaml:"displayNameField,omitempty"`
	Actions            []string               `json:"actions,omitempty" yaml:"actions,omitempty"`
	ActionsByKind      map[string][]string    `json:"actionsByKind,omitempty" yaml:"actionsByKind,omitempty"`
	PublicActions      []string               `json:"publicActions,omitempty" yaml:"publicActions,omitempty"`
	RelatedActions     []string               `json:"relatedActions,omitempty" yaml:"relatedActions,omitempty"`
	ApplyGroupLabel    string                 `json:"applyGroupLabel,omitempty" yaml:"applyGroupLabel,omitempty"`
	Choices            map[string]interface{} `json:"choices,omitempty" yaml:"choices,omitempty"`
	Operations         map[string]string      `json:"operations" yaml:"operations"`
	ReadOnly           bool                   `json:"readOnly,omitempty" yaml:"readOnly,omitempty"`
	OnStateChange      string                 `json:"onStateChange,omitempty" yaml:"onStateChange,omitempty"`
}
