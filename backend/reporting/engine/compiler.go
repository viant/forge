// SPDX-License-Identifier: Apache-2.0
// Extracted from Viant Agently Core.
package reporting

import (
	"bytes"
	"context"
	"encoding/json"

	"fmt"

	identity "github.com/viant/forge/backend/resource"

	"github.com/viant/forge/backend/reporting/registry"

	"strings"
)

// Compile runs the configured canonical compiler.
func (s *Service) compileUnscoped(ctx context.Context, request *CompileRequest) (*CompileResult, error) {
	if request == nil {
		return nil, fmt.Errorf("reporting compile: request is required")
	}
	if s.compiler == nil {
		return nil, fmt.Errorf("reporting compile: compiler not configured")
	}
	var pin *identity.ResolvedResource
	var resolver ResourceReader
	if request.Resource != nil || request.ResolvedResource != nil {
		var err error
		request, pin, resolver, err = s.compileResolved(ctx, request)
		if err != nil {
			return nil, err
		}
	}
	if len(bytes.TrimSpace(request.Document)) == 0 {
		return nil, fmt.Errorf("reporting compile: document is required")
	}
	result, err := s.compiler.Compile(ctx, cloneCompileRequest(request))
	if err != nil {
		return nil, err
	}
	if result == nil {
		return nil, fmt.Errorf("reporting compile: compiler returned nil result")
	}
	if pin != nil {
		raw, fresh, err := resolver.ReadResolved(ctx, *pin)
		if err != nil {
			return nil, err
		}
		pin = fresh
		var envelope registry.ReportEnvelope
		if json.Unmarshal(raw, &envelope) != nil {
			return nil, identity.ErrResourceDenied
		}
		if err = s.verifyDependencies(ctx, *pin, envelope, request.DependencyPins, request.DependencyToken); err != nil {
			return nil, err
		}
	}
	next := cloneCompileResult(result)
	if pin != nil {
		next.Resource = pin
		next.DependencyPins = cloneDependencyPins(request.DependencyPins)
		next.DependencyToken = request.DependencyToken
		next.ArtifactRef = pin.URI
	}
	if next.CompiledAt.IsZero() {
		next.CompiledAt = s.now().UTC()
	}
	s.recordAudit(ctx, &AuditEvent{
		EventType:   "report.compile",
		ArtifactRef: strings.TrimSpace(next.ArtifactRef),
		ActorID:     s.actorID(ctx),
		OccurredAt:  s.now().UTC(),
		Metadata: map[string]interface{}{
			"sourceKind": strings.TrimSpace(request.SourceKind),
		},
	})
	return next, nil
}

func cloneJSON(value json.RawMessage) json.RawMessage {
	if len(value) == 0 {
		return nil
	}
	out := make([]byte, len(value))
	copy(out, value)
	return out
}

func cloneDiagnostics(input []Diagnostic) []Diagnostic {
	if len(input) == 0 {
		return nil
	}
	out := make([]Diagnostic, len(input))
	copy(out, input)
	return out
}

func cloneCompileRequest(input *CompileRequest) *CompileRequest {
	if input == nil {
		return nil
	}
	return &CompileRequest{DependencyPins: cloneDependencyPins(input.DependencyPins), DependencyToken: input.DependencyToken, ResolvedResource: cloneResolvedResource(input.ResolvedResource), Resource: cloneResourceRef(input.Resource),
		Parameters:  cloneJSONMap(input.Parameters),
		ArtifactRef: strings.TrimSpace(input.ArtifactRef),
		SourceKind:  strings.TrimSpace(input.SourceKind),
		Document:    cloneJSON(input.Document),
	}
}

func cloneCompileResult(input *CompileResult) *CompileResult {
	if input == nil {
		return nil
	}
	return &CompileResult{DependencyPins: cloneDependencyPins(input.DependencyPins), DependencyToken: input.DependencyToken, Resource: cloneResolvedResource(input.Resource),
		ArtifactRef: strings.TrimSpace(input.ArtifactRef),
		ReportSpec:  cloneJSON(input.ReportSpec),
		Diagnostics: cloneDiagnostics(input.Diagnostics),
		CompiledAt:  input.CompiledAt,
	}
}

func cloneAuditEvent(input *AuditEvent) *AuditEvent {
	if input == nil {
		return nil
	}
	out := &AuditEvent{
		EventType:   strings.TrimSpace(input.EventType),
		ArtifactRef: strings.TrimSpace(input.ArtifactRef),
		Version:     input.Version,
		JobID:       strings.TrimSpace(input.JobID),
		ArtifactID:  strings.TrimSpace(input.ArtifactID),
		ActorID:     strings.TrimSpace(input.ActorID),
		ActorRef:    strings.TrimSpace(input.ActorRef),
		OccurredAt:  input.OccurredAt,
	}
	if len(input.Metadata) > 0 {
		out.Metadata = make(map[string]interface{}, len(input.Metadata))
		for key, value := range input.Metadata {
			out.Metadata[key] = value
		}
	}
	return out
}
