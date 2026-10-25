package types

// ChoiceBrowserSpec presents a record list with controlled navigation/selection.
type ChoiceBrowserSpec struct {
	DataSourceRef           string                 `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Scope                   string                 `json:"scope,omitempty" yaml:"scope,omitempty"`
	Field                   string                 `json:"field,omitempty" yaml:"field,omitempty"`
	Label                   string                 `json:"label,omitempty" yaml:"label,omitempty"`
	IdentityField           string                 `json:"identityField,omitempty" yaml:"identityField,omitempty"`
	LabelField              string                 `json:"labelField,omitempty" yaml:"labelField,omitempty"`
	SelectableField         string                 `json:"selectableField,omitempty" yaml:"selectableField,omitempty"`
	SelectedField           string                 `json:"selectedField,omitempty" yaml:"selectedField,omitempty"`
	DisabledField           string                 `json:"disabledField,omitempty" yaml:"disabledField,omitempty"`
	SelectionDisabledField  string                 `json:"selectionDisabledField,omitempty" yaml:"selectionDisabledField,omitempty"`
	NavigationDisabledField string                 `json:"navigationDisabledField,omitempty" yaml:"navigationDisabledField,omitempty"`
	DisabledReasonField     string                 `json:"disabledReasonField,omitempty" yaml:"disabledReasonField,omitempty"`
	SecondaryField          string                 `json:"secondaryField,omitempty" yaml:"secondaryField,omitempty"`
	PathField               string                 `json:"pathField,omitempty" yaml:"pathField,omitempty"`
	MaxPathItems            int                    `json:"maxPathItems,omitempty" yaml:"maxPathItems,omitempty"`
	DetailPathField         string                 `json:"detailPathField,omitempty" yaml:"detailPathField,omitempty"`
	DetailEnabledField      string                 `json:"detailEnabledField,omitempty" yaml:"detailEnabledField,omitempty"`
	DetailFields            []RecordDetailField    `json:"detailFields,omitempty" yaml:"detailFields,omitempty"`
	ReadOnly                *bool                  `json:"readOnly,omitempty" yaml:"readOnly,omitempty"`
	Disabled                *bool                  `json:"disabled,omitempty" yaml:"disabled,omitempty"`
	ReadOnlyWhen            map[string]interface{} `json:"readOnlyWhen,omitempty" yaml:"readOnlyWhen,omitempty"`
	DisabledWhen            map[string]interface{} `json:"disabledWhen,omitempty" yaml:"disabledWhen,omitempty"`
	LoadingWhen             map[string]interface{} `json:"loadingWhen,omitempty" yaml:"loadingWhen,omitempty"`
	LoadingMessage          string                 `json:"loadingMessage,omitempty" yaml:"loadingMessage,omitempty"`
	EmptyMessage            string                 `json:"emptyMessage,omitempty" yaml:"emptyMessage,omitempty"`
	EmptyMessageField       string                 `json:"emptyMessageField,omitempty" yaml:"emptyMessageField,omitempty"`
	OnAction                string                 `json:"onAction" yaml:"onAction"`
}
type RecordDetailField struct {
	Field     string `json:"field" yaml:"field"`
	Label     string `json:"label,omitempty" yaml:"label,omitempty"`
	Format    string `json:"format,omitempty" yaml:"format,omitempty"`
	Currency  string `json:"currency,omitempty" yaml:"currency,omitempty"`
	EmptyText string `json:"emptyText,omitempty" yaml:"emptyText,omitempty"`
}
