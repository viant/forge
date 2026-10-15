// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package datasource

import "fmt"

// UpstreamAuthorizationError preserves numeric MCP error provenance. Producers'
// text, browser payloads and generic status mapping cannot create this decision.
type UpstreamAuthorizationError struct {
	Status int
	Cause  error
}

func (e *UpstreamAuthorizationError) Error() string {
	return fmt.Sprintf("upstream datasource authorization failed (%d)", e.Status)
}
func (e *UpstreamAuthorizationError) Unwrap() error { return e.Cause }

type datasourceDenied struct{}

func (datasourceDenied) Error() string {
	return "Datasource access denied. Adjust the filter or retry."
}
func (datasourceDenied) DatasetScopedDenial() bool { return true }

// ErrDatasourceDenied represents a trusted managing-MCP dataset denial after
// datasource dispatch. Artifact admission is a separate, earlier concern.
var ErrDatasourceDenied error = datasourceDenied{}
