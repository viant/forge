// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package reporting

import (
	"context"
	"encoding/json"

	identity "github.com/viant/forge/backend/resource"

	"time"
)

// Diagnostic is the structured backend diagnostic shape used across compile
// and export operations.
type Diagnostic struct {
	Code         string `json:"code,omitempty"`
	Severity     string `json:"severity,omitempty"`
	Path         string `json:"path,omitempty"`
	Message      string `json:"message,omitempty"`
	SuggestedFix string `json:"suggestedFix,omitempty"`
	// Cause contains the underlying operational error when a diagnostic is
	// produced from a failed integration step. It is intentionally optional so
	// existing diagnostics remain compact and do not expose implementation
	// details unless the producer explicitly opts in.
	Cause string `json:"cause,omitempty"`
}

// CompileRequest carries an authored artifact into the backend compile seam.
type CompileRequest struct {
	Parameters       map[string]interface{}               `json:"parameters,omitempty"`
	DependencyPins   map[string]identity.ResolvedResource `json:"-"`
	DependencyToken  string                               `json:"-"`
	ResolvedResource *identity.ResolvedResource           `json:"resolvedResource,omitempty"`
	Resource         *identity.ResourceRef                `json:"resource,omitempty"`
	ArtifactRef      string                               `json:"artifactRef,omitempty"`
	SourceKind       string                               `json:"sourceKind,omitempty"`
	Document         json.RawMessage                      `json:"document,omitempty"`
}

// CompileResult is the canonical compile response.
type CompileResult struct {
	DependencyPins  map[string]identity.ResolvedResource `json:"-"`
	DependencyToken string                               `json:"-"`
	Resource        *identity.ResolvedResource           `json:"resource,omitempty"`
	ArtifactRef     string                               `json:"artifactRef,omitempty"`
	ReportSpec      json.RawMessage                      `json:"reportSpec,omitempty"`
	Diagnostics     []Diagnostic                         `json:"diagnostics,omitempty"`
	CompiledAt      time.Time                            `json:"compiledAt,omitempty"`
}

// Compiler lowers authored artifacts into canonical ReportSpec payloads.
type Compiler interface {
	Compile(ctx context.Context, request *CompileRequest) (*CompileResult, error)
}

// AuditEvent is the generic reporting audit payload emitted by the service.
type AuditEvent struct {
	EventType   string                 `json:"eventType,omitempty"`
	ArtifactRef string                 `json:"artifactRef,omitempty"`
	Version     int                    `json:"version,omitempty"`
	JobID       string                 `json:"jobId,omitempty"`
	ArtifactID  string                 `json:"artifactId,omitempty"`
	ActorID     string                 `json:"actorId,omitempty"`
	ActorRef    string                 `json:"actorRef,omitempty"`
	OccurredAt  time.Time              `json:"occurredAt,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AuditSink records reporting lifecycle events.
type AuditSink interface {
	Record(ctx context.Context, event *AuditEvent) error
}
