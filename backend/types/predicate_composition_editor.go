package types

type PredicateCompositionEditorSpec struct {
	GroupsField       string `json:"groupsField,omitempty" yaml:"groupsField,omitempty"`
	OnGroupSave       string `json:"onGroupSave,omitempty" yaml:"onGroupSave,omitempty"`
	DataSourceRef     string `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	CompositionsField string `json:"compositionsField,omitempty" yaml:"compositionsField,omitempty"`
	ProtectedGroups   []int  `json:"protectedGroups,omitempty" yaml:"protectedGroups,omitempty"`
	OnSave            string `json:"onSave" yaml:"onSave"`
}
