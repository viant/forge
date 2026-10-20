package types

// ResultPreviewSpec binds a hierarchical JSON table/JSON preview to a datasource.
type ResultPreviewSpec struct {
	DataSourceRef string `json:"dataSourceRef,omitempty" yaml:"dataSourceRef,omitempty"`
	DataField     string `json:"dataField,omitempty" yaml:"dataField,omitempty"`
	Label         string `json:"label,omitempty" yaml:"label,omitempty"`
}
