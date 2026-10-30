package datasource

// Operation declares a fixed action backend independently of the read backend.
// Callers supply only its name and logical inputs, never this declaration.
type Operation struct {
	Backend *Backend `json:"backend" yaml:"backend"`
}

// OperateResult preserves the producer payload without row projection or cache metadata.
type OperateResult struct {
	Result interface{} `json:"result"`
}
