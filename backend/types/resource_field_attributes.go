package types

// ResourceFieldValidation is a bounded browser contract, normalized from native
// validation tags. Unknown checks are retained for explicit client diagnostics.
type ResourceFieldValidation struct {
	Checks       []ResourceValidationCheck `json:"checks,omitempty" yaml:"checks,omitempty"`
	Pointer      bool                      `json:"pointer,omitempty" yaml:"pointer,omitempty"`
	PresenceOnly bool                      `json:"presenceOnly,omitempty" yaml:"presenceOnly,omitempty"`
	OmitEmpty    bool                      `json:"omitEmpty,omitempty" yaml:"omitEmpty,omitempty"`
}
type ResourceValidationCheck struct {
	Name       string   `json:"name" yaml:"name"`
	Parameters []string `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Message    string   `json:"message,omitempty" yaml:"message,omitempty"`
}

// ResourceTimeFormat carries native tagly formatting metadata. TimeZone applies
// to presentation of an instant, never wall-clock input conversion.
type ResourceTimeFormat struct {
	TimeLayout string `json:"timeLayout,omitempty" yaml:"timeLayout,omitempty"`
	TimeZone   string `json:"timeZone,omitempty" yaml:"timeZone,omitempty"`
	Nullable   *bool  `json:"nullable,omitempty" yaml:"nullable,omitempty"`
	OmitEmpty  bool   `json:"omitEmpty,omitempty" yaml:"omitEmpty,omitempty"`
}
