package types

// WorkspaceSummarySpec presents metadata-owned collections as actionable lists.
type WorkspaceSummarySpec struct {
	Appearance         string                    `json:"appearance,omitempty" yaml:"appearance,omitempty"`
	TitleField         string                    `json:"titleField,omitempty" yaml:"titleField,omitempty"`
	DescriptionField   string                    `json:"descriptionField,omitempty" yaml:"descriptionField,omitempty"`
	Title              string                    `json:"title,omitempty" yaml:"title,omitempty"`
	Description        string                    `json:"description,omitempty" yaml:"description,omitempty"`
	StateDataSourceRef string                    `json:"stateDataSourceRef,omitempty" yaml:"stateDataSourceRef,omitempty"`
	ErrorField         string                    `json:"errorField,omitempty" yaml:"errorField,omitempty"`
	Actions            []WorkspaceSummaryAction  `json:"actions,omitempty" yaml:"actions,omitempty"`
	Sections           []WorkspaceSummarySection `json:"sections,omitempty" yaml:"sections,omitempty"`
}
type WorkspaceSummaryAction struct {
	ID      string `json:"id,omitempty" yaml:"id,omitempty"`
	Label   string `json:"label,omitempty" yaml:"label,omitempty"`
	Icon    string `json:"icon,omitempty" yaml:"icon,omitempty"`
	Intent  string `json:"intent,omitempty" yaml:"intent,omitempty"`
	Handler string `json:"handler,omitempty" yaml:"handler,omitempty"`
}
type WorkspaceSummarySection struct {
	ID            string                            `json:"id" yaml:"id"`
	Title         string                            `json:"title,omitempty" yaml:"title,omitempty"`
	DataSourceRef string                            `json:"dataSourceRef" yaml:"dataSourceRef"`
	LabelField    string                            `json:"labelField" yaml:"labelField"`
	DetailFields  []string                          `json:"detailFields,omitempty" yaml:"detailFields,omitempty"`
	StatusField   string                            `json:"statusField,omitempty" yaml:"statusField,omitempty"`
	StatusFirst   bool                              `json:"statusFirst,omitempty" yaml:"statusFirst,omitempty"`
	Statuses      map[string]WorkspaceSummaryStatus `json:"statuses,omitempty" yaml:"statuses,omitempty"`
	DateField     string                            `json:"dateField,omitempty" yaml:"dateField,omitempty"`
	Handler       string                            `json:"handler,omitempty" yaml:"handler,omitempty"`
	EmptyText     string                            `json:"emptyText,omitempty" yaml:"emptyText,omitempty"`
	FullWidth     bool                              `json:"fullWidth,omitempty" yaml:"fullWidth,omitempty"`
	Action        *WorkspaceSummaryAction           `json:"action,omitempty" yaml:"action,omitempty"`
}
type WorkspaceSummaryStatus struct {
	Intent string `json:"intent,omitempty" yaml:"intent,omitempty"`
	Icon   string `json:"icon,omitempty" yaml:"icon,omitempty"`
}
