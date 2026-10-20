package types

// ReaderWorkbenchSpec configures a reusable Datly graph/SQL authoring renderer.
// Provider endpoints, DTO mappings, lookups and resource namespaces are metadata.
type ReaderWorkbenchSpec struct {
	DataSourceRef       string                            `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	ReportField         string                            `json:"reportField,omitempty" yaml:"reportField,omitempty"`
	NamespaceField      string                            `json:"namespaceField,omitempty" yaml:"namespaceField,omitempty"`
	OpenResourcesField  string                            `json:"openResourcesField,omitempty" yaml:"openResourcesField,omitempty"`
	ResourceActionField string                            `json:"resourceActionField,omitempty" yaml:"resourceActionField,omitempty"`
	ResourceNamespace   string                            `json:"resourceNamespace,omitempty" yaml:"resourceNamespace,omitempty"`
	Defaults            map[string]interface{}            `json:"defaults,omitempty" yaml:"defaults,omitempty"`
	Operations          map[string]WorkbenchMethodBinding `json:"operations" yaml:"operations"`
	Lookups             map[string]WorkbenchMethodBinding `json:"lookups,omitempty" yaml:"lookups,omitempty"`
	OnBack              string                            `json:"onBack,omitempty" yaml:"onBack,omitempty"`
	OnReportUpdated     string                            `json:"onReportUpdated,omitempty" yaml:"onReportUpdated,omitempty"`
	OnResourcesClosed   string                            `json:"onResourcesClosed,omitempty" yaml:"onResourcesClosed,omitempty"`
}
type WorkbenchMethodBinding struct {
	DataSourceRef    string                       `json:"dataSourceRef" yaml:"dataSourceRef"`
	Parameters       map[string]WorkbenchArgument `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	SpreadArg        *int                         `json:"spreadArg,omitempty" yaml:"spreadArg,omitempty"`
	ResponseSelector string                       `json:"responseSelector,omitempty" yaml:"responseSelector,omitempty"`
	ResponseDefault  interface{}                  `json:"responseDefault,omitempty" yaml:"responseDefault,omitempty"`
	Mutation         bool                         `json:"mutation,omitempty" yaml:"mutation,omitempty"`
}
type WorkbenchArgument struct {
	Arg      *int        `json:"arg,omitempty" yaml:"arg,omitempty"`
	Selector string      `json:"selector,omitempty" yaml:"selector,omitempty"`
	Default  interface{} `json:"default,omitempty" yaml:"default,omitempty"`
	Value    interface{} `json:"value,omitempty" yaml:"value,omitempty"`
}
