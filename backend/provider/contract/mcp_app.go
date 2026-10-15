// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import identity "github.com/viant/forge/backend/resource"

// MCPAppClosure identifies the producer's complete immutable compiled asset set.
// It is authored resource data, never an MCP request metadata extension.
type MCPAppClosure struct {
	Fingerprint string `json:"fingerprint" yaml:"fingerprint"`
	EntryPath   string `json:"entryPath" yaml:"entryPath"`
	EntrySHA256 string `json:"entrySHA256" yaml:"entrySHA256"`
}

// MCPAppOpenRequest is an ordinary registered tool input. References and proofs
// do not grant authority; the producer verifies the current actor and candidate.
type MCPAppOpenRequest struct {
	Resource       identity.ResolvedResource `json:"resource"`
	ExecutionProof *ExecutionProof           `json:"executionProof"`
	ResourceURI    string                    `json:"resourceURI"`
	// AssetClosure is derived from the exact selected authored variant by the
	// host. The producer must independently verify its immutable declaration.
	// Nil is compatible only with the producer's documented default variant.
	AssetClosure *MCPAppClosure `json:"assetClosure,omitempty"`
}
type MCPAppOpenResult struct {
	ProviderIdentity string                    `json:"providerIdentity"`
	Resource         identity.ResolvedResource `json:"resource"`
	ResourceURI      string                    `json:"resourceURI"`
	ReadResourceURI  string                    `json:"readResourceURI"`
	AssetClosure     MCPAppClosure             `json:"assetClosure"`
	RendererURL      string                    `json:"rendererURL"`
	Sandbox          string                    `json:"sandbox"`
}
