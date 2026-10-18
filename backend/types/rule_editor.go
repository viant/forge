package types

// RuleEditorSpec edits a form-bound predicate tree without owning its transport.
type RuleEditorSpec struct {
	DataSourceRef  string                 `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	Field          string                 `json:"field" yaml:"field"`
	Label          string                 `json:"label,omitempty" yaml:"label,omitempty"`
	ChildrenField  string                 `json:"childrenField,omitempty" yaml:"childrenField,omitempty"`
	OperatorField  string                 `json:"operatorField,omitempty" yaml:"operatorField,omitempty"`
	ParameterField string                 `json:"parameterField,omitempty" yaml:"parameterField,omitempty"`
	ValueField     string                 `json:"valueField,omitempty" yaml:"valueField,omitempty"`
	OptionsHandler string                 `json:"optionsHandler,omitempty" yaml:"optionsHandler,omitempty"`
	Groups         []RuleEditorChoice     `json:"groups,omitempty" yaml:"groups,omitempty"`
	Operators      []RuleEditorChoice     `json:"operators,omitempty" yaml:"operators,omitempty"`
	Fields         []RuleEditorChoice     `json:"fields,omitempty" yaml:"fields,omitempty"`
	DefaultRule    map[string]interface{} `json:"defaultRule,omitempty" yaml:"defaultRule,omitempty"`
	ReadOnlyWhen   map[string]interface{} `json:"readOnlyWhen,omitempty" yaml:"readOnlyWhen,omitempty"`
	MaxValueLength int                    `json:"maxValueLength,omitempty" yaml:"maxValueLength,omitempty"`
}
type RuleEditorChoice struct {
	Value     interface{}   `json:"value" yaml:"value"`
	Label     string        `json:"label" yaml:"label"`
	Operators []interface{} `json:"operators,omitempty" yaml:"operators,omitempty"`
}
