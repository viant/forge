// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
// Package primitive defines neutral delegated authoring/discovery contracts.
// Standard MCP skills/prompts/resources remain their native SDK contracts.
// Authoring operations are ordinary tools advertised by tools/list and invoked
// through tools/call; similarly named native protocol methods retain their
// native result contracts.
package primitive

import (
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
)

const AuthoringExtension = "com.viant.resources/primitive"
const NamespaceMeta = "com.viant.resources/namespace"
const RevisionMeta = "com.viant.resources/revision"
const AuthoringResourcesMeta = "com.viant.resources/authoringResources"
const ResourcePinsMeta = "com.viant.resources/resourcePins"
const LegacyAuthoringExtension = "com.viant.ai-studio/authoring"
const LegacyNamespaceMeta = "com.viant.ai-studio/namespace"
const LegacyRevisionMeta = "com.viant.ai-studio/revision"
const LegacyAuthoringResourcesMeta = "com.viant.ai-studio/authoringResources"
const LegacyResourcePinsMeta = "com.viant.ai-studio/resourcePins"

type NamespaceListRequest struct {
	Cursor string `json:"cursor,omitempty"`
	Limit  int    `json:"limit,omitempty"`
}
type NamespaceGetRequest struct {
	Namespace string `json:"namespace"`
}
type NamespaceMetadata struct {
	Description string   `json:"description,omitempty"`
	UseCases    []string `json:"useCases,omitempty"`
}

type Namespace struct {
	SupportedKinds []KindSupport `json:"supportedKinds,omitempty"`
	NamespaceMetadata
	Name  string   `json:"name"`
	Kinds []string `json:"kinds,omitempty"`
}
type KindSupport struct {
	SchemaURI      string   `json:"schemaURI,omitempty"`
	Kind           string   `json:"kind"`
	FormatVersions []int64  `json:"formatVersions"`
	Operations     []string `json:"operations"`
	TestSupported  bool     `json:"testSupported"`
	// Methods explicitly maps installed operations to wire methods. Clients
	// use this declaration rather than guessing names for an unfamiliar kind.
	Methods map[string]string `json:"methods,omitempty"`
}
type NamespaceCapabilities struct {
	NamespaceMetadata
	ProviderIdentity string        `json:"providerIdentity"`
	Namespace        string        `json:"namespace"`
	Kinds            []KindSupport `json:"kinds"`
}
type NamespaceListResult struct {
	ProviderIdentity string      `json:"providerIdentity,omitempty"`
	Namespaces       []Namespace `json:"namespaces"`
	NextCursor       string      `json:"nextCursor,omitempty"`
	Complete         bool        `json:"complete"`
}
type ListRequest struct {
	Namespace string `json:"namespace,omitempty"`
	Cursor    string `json:"cursor,omitempty"`
	Limit     int    `json:"limit,omitempty"`
}
type GetRequest struct {
	URI         string `json:"uri"`
	Revision    string `json:"revision,omitempty"`
	WorkspaceID string `json:"workspaceId,omitempty"`
}

// Locator retains the delegated MCP owner next to a canonical resource pin.
// A locator never grants access; collisions must require an explicit owner.
type Locator struct {
	ProviderIdentity string               `json:"providerIdentity"`
	Method           string               `json:"method"`
	Resource         identity.ResourceRef `json:"resource"`
}
type ResourceState struct {
	MimeType      string          `json:"mimeType,omitempty"`
	Description   string          `json:"description,omitempty"`
	Stamp         int64           `json:"stamp,omitempty"`
	Kind          string          `json:"kind"`
	Namespace     string          `json:"namespace"`
	Name          string          `json:"name"`
	URI           string          `json:"uri"`
	WorkspaceID   string          `json:"workspaceId"`
	OwnerID       string          `json:"ownerId"`
	Title         string          `json:"title"`
	Lifecycle     string          `json:"lifecycle"`
	RowEtag       int64           `json:"rowEtag"`
	DraftRevision int64           `json:"draftRevision"`
	LatestStamp   int64           `json:"latestStamp"`
	Revision      string          `json:"revision,omitempty"`
	FormatVersion int64           `json:"formatVersion,omitempty"`
	Definition    json.RawMessage `json:"definition,omitempty"`
	// DefinitionBytes is the lossless base64 JSON carrier for approved stored
	// bytes. Definition is a convenient semantic projection; JSON transports
	// may compact or reorder it and must never rehash it as the original pin.
	DefinitionBytes    []byte          `json:"definitionBytes,omitempty"`
	ContentFingerprint string          `json:"contentFingerprint,omitempty"`
	Dependencies       []Dependency    `json:"dependencies,omitempty"`
	Replay             bool            `json:"replay,omitempty"`
	SourceManifest     json.RawMessage `json:"sourceManifest,omitempty"`
}
type Dependency struct {
	ProviderIdentity   string `json:"providerIdentity,omitempty"`
	URI                string `json:"uri"`
	Revision           string `json:"revision"`
	ContentFingerprint string `json:"contentFingerprint"`
	SchemaFingerprint  string `json:"schemaFingerprint,omitempty"`
}

// MenuProjection explicitly distinguishes visible bytes from the exact source pin.
// It contains no unfiltered source definition.
type MenuProjection struct {
	SchemaVersion      int64  `json:"schemaVersion"`
	DefinitionBytes    []byte `json:"definitionBytes"`
	ContentFingerprint string `json:"contentFingerprint"`
}

type GetResult struct {
	MenuProjection   *MenuProjection            `json:"menuProjection,omitempty"`
	Resource         *ResourceState             `json:"resource"`
	ResolvedResource *identity.ResolvedResource `json:"resolvedResource,omitempty"`
	// ExecutionProof is runtime-only provider provenance, never an ACL grant
	// or authored definition. A consumer still retains its own narrower lease.
	ExecutionProof *ExecutionProof `json:"executionProof,omitempty"`
}

// ExecutionProof binds one original provider pin to a provider-specific exact
// execution contract. Binding and Token are opaque to consumers. Providers must
// verify the original signature and separately refresh authorization.
type ExecutionProof struct {
	Resource identity.ResolvedResource `json:"resource"`
	Binding  string                    `json:"binding"`
	Token    string                    `json:"token"`
}
