// SPDX-License-Identifier: Apache-2.0
package resource

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"

	manager "github.com/viant/forge/backend/clientpool"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
)

type mcpReferenceDiagnosticKey struct{}

// This state belongs to one reference inventory read. It contains metadata
// only and is never retained in a shared catalog or client pool.
type mcpReferenceDiagnostic struct {
	mu          sync.Mutex
	operation   string
	stage       string
	reason      string
	marked      bool
	attempts    map[string]manager.HTTPAttempt
	credentials map[string]manager.AuthSelection
	serviceName map[string]string
}

func withMCPReferenceDiagnostic(ctx context.Context) (context.Context, *mcpReferenceDiagnostic) {
	var id [8]byte
	_, _ = rand.Read(id[:])
	diagnostic := &mcpReferenceDiagnostic{operation: hex.EncodeToString(id[:]), stage: "unknown"}
	ctx = context.WithValue(ctx, mcpReferenceDiagnosticKey{}, diagnostic)
	ctx = manager.WithHTTPAttemptObserver(ctx, diagnostic.observeAttempt)
	ctx = manager.WithAuthSelectionObserver(ctx, diagnostic.observeCredential)
	return ctx, diagnostic
}

func mcpReferenceDiagnosticFromContext(ctx context.Context) *mcpReferenceDiagnostic {
	if ctx == nil {
		return nil
	}
	diagnostic, _ := ctx.Value(mcpReferenceDiagnosticKey{}).(*mcpReferenceDiagnostic)
	return diagnostic
}

func (d *mcpReferenceDiagnostic) begin(stage string) {
	if d == nil {
		return
	}
	d.mu.Lock()
	d.stage = stage
	d.reason = ""
	d.marked = false
	d.attempts = nil
	d.credentials = nil
	d.mu.Unlock()
}

func (d *mcpReferenceDiagnostic) observeAttempt(attempt manager.HTTPAttempt) {
	d.mu.Lock()
	if attempt.ServerName != "" {
		if d.attempts == nil {
			d.attempts = make(map[string]manager.HTTPAttempt)
		}
		d.attempts[attempt.ServerName] = attempt
	}
	d.mu.Unlock()
}

func (d *mcpReferenceDiagnostic) observeCredential(selection manager.AuthSelection) {
	d.mu.Lock()
	if selection.ServerName != "" {
		if d.credentials == nil {
			d.credentials = make(map[string]manager.AuthSelection)
		}
		d.credentials[selection.ServerName] = selection
	}
	d.mu.Unlock()
}

func (d *mcpReferenceDiagnostic) bindServiceName(connection, service string) {
	if d == nil || connection == "" || service == "" {
		return
	}
	d.mu.Lock()
	if d.serviceName == nil {
		d.serviceName = make(map[string]string)
	}
	d.serviceName[connection] = service
	d.mu.Unlock()
}

func markMCPReferenceFailure(ctx context.Context, stage, reason string, err error) {
	if err == nil {
		return
	}
	diagnostic := mcpReferenceDiagnosticFromContext(ctx)
	if diagnostic == nil {
		return
	}
	diagnostic.mu.Lock()
	if !diagnostic.marked {
		diagnostic.stage = stage
		diagnostic.reason = reason
		diagnostic.marked = true
	}
	diagnostic.mu.Unlock()
}

func (d *mcpReferenceDiagnostic) enrichFailure(failure *MCPReferenceFailure, err error) {
	if d == nil || failure == nil {
		return
	}
	d.mu.Lock()
	service := failure.Connection
	if canonical := d.serviceName[service]; canonical != "" {
		service = canonical
	}
	stage, reason, attempt, credential, operation := d.stage, d.reason, d.attempts[service], d.credentials[failure.Connection], d.operation
	d.mu.Unlock()
	failure.OperationID = operation
	failure.Stage = stage
	failure.Origin = "unknown"
	failure.Reason = reason
	failure.CredentialType = "unknown"
	failure.CredentialPresent = "unknown"
	if credential.ServerName == failure.Connection {
		failure.CredentialType = credential.Type
		failure.CredentialPresent = credential.Present
	}
	if attempt.RequestSent && attempt.StatusCode >= 400 && stage != "actor" && stage != "postcheck" {
		failure.Stage = "remote_response"
		failure.Origin = "remote_http"
		failure.HTTPStatus = attempt.StatusCode
		failure.RemoteRequestID = attempt.RequestID
		return
	}
	var rpc *jsonrpc.Error
	if attempt.RequestSent && attempt.StatusCode > 0 && errors.As(err, &rpc) && stage != "actor" && stage != "postcheck" {
		failure.Stage = "remote_response"
		failure.Origin = "remote_rpc"
		failure.HTTPStatus = attempt.StatusCode
		failure.RemoteRequestID = attempt.RequestID
		return
	}
	if attempt.TransportError && stage != "actor" && stage != "postcheck" {
		failure.Stage = "outbound_request"
		failure.Origin = "transport"
		return
	}
	if stage == "actor" || stage == "credential_selection" || stage == "postcheck" || stage == "connection_binding" && (errors.Is(err, identity.ErrResourceDenied) || reason == "invalid_root" || reason == "provider_identity_mismatch" || reason == "invalid_namespace") {
		failure.Origin = "local"
	}
}
