package uicontext

// LiveControl is passive current state from a mounted Forge registration.
// SupportedActions names registered handlers; availability is rechecked on
// Operate. Declared metadata is exposed separately by the metadata API.
type LiveControl struct {
	ControlID         string                 `json:"controlId"`
	DataSourceRef     string                 `json:"dataSourceRef,omitempty"`
	Label             string                 `json:"label,omitempty"`
	Type              string                 `json:"type,omitempty"`
	Scope             string                 `json:"scope,omitempty"`
	BindingPath       string                 `json:"bindingPath,omitempty"`
	DataField         string                 `json:"dataField,omitempty"`
	Value             interface{}            `json:"value,omitempty"`
	Options           interface{}            `json:"options,omitempty"`
	Constraints       map[string]interface{} `json:"constraints,omitempty"`
	Visible           bool                   `json:"visible"`
	Disabled          bool                   `json:"disabled"`
	ReadOnly          bool                   `json:"readOnly"`
	Sensitive         bool                   `json:"sensitive,omitempty"`
	SupportedActions  []string               `json:"supportedActions"`
	UnavailableReason string                 `json:"unavailableReason,omitempty"`
	OperationState    *ControlOperationState `json:"operationState,omitempty"`
}

// ControlOperationState observes a pending UI continuation without exposing
// handler payloads or errors. It does not authorize a subsequent operation.
type ControlOperationState struct {
	Status   string `json:"status"`
	Kind     string `json:"kind,omitempty"`
	TargetID string `json:"targetId,omitempty"`
}
