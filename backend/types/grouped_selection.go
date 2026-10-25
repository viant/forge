package types

// GroupedSelectionSpec renders controlled groups and emits generic editing intents.
// The named action owns validation, state updates and any persistence.
type GroupedSelectionSpec struct {
	DataSourceRef        string                    `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Scope                string                    `json:"scope,omitempty" yaml:"scope,omitempty"`
	Field                string                    `json:"field" yaml:"field"`
	Sections             []GroupedSelectionSection `json:"sections" yaml:"sections"`
	GroupIdentityField   string                    `json:"groupIdentityField,omitempty" yaml:"groupIdentityField,omitempty"`
	GroupLabelField      string                    `json:"groupLabelField,omitempty" yaml:"groupLabelField,omitempty"`
	ItemsField           string                    `json:"itemsField,omitempty" yaml:"itemsField,omitempty"`
	ItemIdentityField    string                    `json:"itemIdentityField,omitempty" yaml:"itemIdentityField,omitempty"`
	ItemLabelField       string                    `json:"itemLabelField,omitempty" yaml:"itemLabelField,omitempty"`
	ItemDescriptionField string                    `json:"itemDescriptionField,omitempty" yaml:"itemDescriptionField,omitempty"`
	ActiveGroupField     string                    `json:"activeGroupField,omitempty" yaml:"activeGroupField,omitempty"`
	CollapsedField       string                    `json:"collapsedField,omitempty" yaml:"collapsedField,omitempty"`
	AddGroupLabel        string                    `json:"addGroupLabel,omitempty" yaml:"addGroupLabel,omitempty"`
	EmptyMessage         string                    `json:"emptyMessage,omitempty" yaml:"emptyMessage,omitempty"`
	AllowRemoveGroups    *bool                     `json:"allowRemoveGroups,omitempty" yaml:"allowRemoveGroups,omitempty"`
	ReadOnly             *bool                     `json:"readOnly,omitempty" yaml:"readOnly,omitempty"`
	ReadOnlyWhen         map[string]interface{}    `json:"readOnlyWhen,omitempty" yaml:"readOnlyWhen,omitempty"`
	DetailFields         []RecordDetailField       `json:"detailFields,omitempty" yaml:"detailFields,omitempty"`
	DetailPathField      string                    `json:"detailPathField,omitempty" yaml:"detailPathField,omitempty"`
	OnAction             string                    `json:"onAction" yaml:"onAction"`
}
type GroupedSelectionSection struct {
	ID          string `json:"id" yaml:"id"`
	Label       string `json:"label,omitempty" yaml:"label,omitempty"`
	GroupsField string `json:"groupsField,omitempty" yaml:"groupsField,omitempty"`
	AddLabel    string `json:"addLabel,omitempty" yaml:"addLabel,omitempty"`
}
