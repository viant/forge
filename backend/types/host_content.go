package types

// HostContentSpec refers to an optional renderer explicitly installed by a host.
// It cannot import application code or choose a remote destination.
type HostContentSpec struct {
	Slot       string                 `json:"slot" yaml:"slot"`
	Properties map[string]interface{} `json:"properties,omitempty" yaml:"properties,omitempty"`
	On         []*Execute             `json:"on,omitempty" yaml:"on,omitempty"`
}
