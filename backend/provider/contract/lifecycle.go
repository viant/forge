// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core; provider bindings are independent of agent execution.
package primitive

import (
	"context"
	"encoding/json"
	identity "github.com/viant/forge/backend/resource"
)

// Lifecycle inputs carry untrusted content and concurrency constraints only.
// A provider supplies verified identity and owns its persistence/validation.
type CreateResourceInput struct {
	URI            string          `json:"uri"`
	WorkspaceID    string          `json:"workspaceId"`
	Title          string          `json:"title"`
	GroupID        string          `json:"groupId,omitempty"`
	ACLMode        string          `json:"aclMode,omitempty"`
	FormatVersion  int64           `json:"formatVersion"`
	Definition     json.RawMessage `json:"definition"`
	SourceManifest json.RawMessage `json:"sourceManifest,omitempty"`
	IdempotencyKey string          `json:"idempotencyKey"`
}

type UpdateDraftInput struct {
	Title                      *string         `json:"title,omitempty"`
	ExpectedRowEtag            int64           `json:"expectedRowEtag,omitempty"`
	ExpectedContentFingerprint string          `json:"expectedContentFingerprint,omitempty"`
	ExpectedDraftRevision      int64           `json:"expectedDraftRevision"`
	FormatVersion              int64           `json:"formatVersion"`
	Definition                 json.RawMessage `json:"definition"`
	SourceManifest             json.RawMessage `json:"sourceManifest,omitempty"`
	IdempotencyKey             string          `json:"idempotencyKey"`
}

type StampResourceInput struct {
	ExpectedDependencies  []ResourceDependencyPin `json:"expectedDependencies,omitempty"`
	ExpectedRowEtag       int64                   `json:"expectedRowEtag,omitempty"`
	ExpectedDraftRevision int64                   `json:"expectedDraftRevision"`
	ContentFingerprint    string                  `json:"contentFingerprint"`
	IdempotencyKey        string                  `json:"idempotencyKey"`
}

type CloneResourceInput struct {
	ExpectedSourceFingerprint string               `json:"expectedSourceFingerprint"`
	Source                    identity.ResourceRef `json:"source"`
	TargetURI                 string               `json:"targetUri"`
	TargetWorkspaceID         string               `json:"targetWorkspaceId"`
	Title                     string               `json:"title"`
	IdempotencyKey            string               `json:"idempotencyKey"`
}

type ArchiveResourceInput struct {
	ExpectedHeadRevision int64  `json:"expectedHeadRevision"`
	IdempotencyKey       string `json:"idempotencyKey"`
}

type ResourceResult struct {
	Stamp              int64  `json:"stamp,omitempty"`
	URI                string `json:"uri"`
	RowEtag            int64  `json:"rowEtag"`
	DraftRevision      int64  `json:"draftRevision"`
	LatestStamp        int64  `json:"latestStamp"`
	ContentFingerprint string `json:"contentFingerprint,omitempty"`
	Replay             bool   `json:"replay"`
}

type ResourceDescriptor struct {
	ResourceResult
	WorkspaceID  string `json:"workspaceId"`
	ResourceKind string `json:"resourceKind"`
	Namespace    string `json:"namespace"`
	Name         string `json:"name"`
	OwnerID      string `json:"ownerId"`
	Title        string `json:"title"`
	Lifecycle    string `json:"lifecycle"`
}

type ResourceDependencyPin struct {
	ProviderIdentity   string `json:"providerIdentity,omitempty"`
	URI                string `json:"uri"`
	Revision           string `json:"revision"`
	ContentFingerprint string `json:"contentFingerprint"`
	SchemaFingerprint  string `json:"schemaFingerprint"`
}

// ResourceAuthoring is the optional provider-owned lifecycle contract. Runtime
// consumers do not receive SQL handles or select storage identities themselves.
type ResourceAuthoring interface {
	CreateResource(context.Context, CreateResourceInput) (*ResourceResult, error)
	UpdateDraft(context.Context, string, UpdateDraftInput) (*ResourceResult, error)
	StampResource(context.Context, string, StampResourceInput) (*ResourceResult, error)
	CloneResource(context.Context, CloneResourceInput) (*ResourceResult, error)
	ArchiveResource(context.Context, string, ArchiveResourceInput) (*ResourceResult, error)
	GetResource(context.Context, string) (*ResourceDescriptor, error)
}

// ResourceAuthoringFactory binds provider storage to the host's selected authority.
type ResourceAuthoringFactory func(identity.ResourceAuthority) (ResourceAuthoring, error)
