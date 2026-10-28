package resource

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	"github.com/viant/jsonrpc"
)

func TestMCPReferenceFailureSeparatesHTTPAndRPCStatus(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
	diagnostic.begin("outbound_request")
	diagnostic.observeCredential(manager.AuthSelection{ServerName: "example", Type: "id_token", Present: "true"})
	diagnostic.observeAttempt(manager.HTTPAttempt{ServerName: "example", RequestSent: true, StatusCode: 200, RequestID: "request-123"})
	err := &jsonrpc.Error{Code: -32003, Message: "private-message", Data: json.RawMessage(`{"status":403,"token":"private-token"}`)}
	markMCPReferenceFailure(ctx, "outbound_request", "resource_list_failed", err)
	reader.reportFailure(ctx, "list", "example", "", err)
	require.Equal(t, "remote_response", reported.Stage)
	require.Equal(t, "remote_rpc", reported.Origin)
	require.Equal(t, 200, reported.HTTPStatus)
	require.Equal(t, 403, reported.RPCStatus)
	require.Equal(t, "request-123", reported.RemoteRequestID)
	require.Equal(t, "id_token", reported.CredentialType)
	require.Equal(t, "true", reported.CredentialPresent)
	require.Len(t, reported.OperationID, 16)
	raw, marshalErr := json.Marshal(reported)
	require.NoError(t, marshalErr)
	require.NotContains(t, string(raw), "private-message")
	require.NotContains(t, string(raw), "private-token")
}

func TestMCPReferenceFailureUsesObservedHTTPStatus(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
	diagnostic.begin("connection_binding")
	diagnostic.observeAttempt(manager.HTTPAttempt{ServerName: "example", RequestSent: true, StatusCode: 403, RequestID: "request-403"})
	reader.reportFailure(ctx, "list", "example", "", errors.New("private-error"))
	require.Equal(t, "remote_http", reported.Origin)
	require.Equal(t, "remote_response", reported.Stage)
	require.Equal(t, 403, reported.HTTPStatus)
	require.Zero(t, reported.RPCStatus)
}

func TestMCPReferenceFailureMatchesCanonicalHTTPAttemptForAlias(t *testing.T) {
	for _, test := range []struct {
		name       string
		status     int
		err        error
		wantOrigin string
		wantRPC    int
	}{
		{name: "RPC denial over HTTP 200", status: 200, err: &jsonrpc.Error{Code: -32003, Data: json.RawMessage(`{"status":403}`)}, wantOrigin: "remote_rpc", wantRPC: 403},
		{name: "HTTP denial", status: 403, err: errors.New("denied"), wantOrigin: "remote_http"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var reported MCPReferenceFailure
			reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
			ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
			diagnostic.bindServiceName("alias", "mcp://example/supply")
			diagnostic.begin("outbound_request")
			diagnostic.observeCredential(manager.AuthSelection{ServerName: "alias", Type: "id_token", Present: "true"})
			diagnostic.observeAttempt(manager.HTTPAttempt{ServerName: "other", RequestSent: true, StatusCode: 500, RequestID: "unrelated"})
			diagnostic.observeAttempt(manager.HTTPAttempt{ServerName: "mcp://example/supply", RequestSent: true, StatusCode: test.status, RequestID: "request-123"})
			markMCPReferenceFailure(ctx, "outbound_request", "resource_list_failed", test.err)
			reader.reportFailure(ctx, "list", "alias", "", test.err)
			require.Equal(t, test.wantOrigin, reported.Origin)
			require.Equal(t, "remote_response", reported.Stage)
			require.Equal(t, test.status, reported.HTTPStatus)
			require.Equal(t, test.wantRPC, reported.RPCStatus)
			require.Equal(t, "request-123", reported.RemoteRequestID)
			require.Equal(t, "id_token", reported.CredentialType)
			require.Equal(t, "true", reported.CredentialPresent)
		})
	}
}

func TestMCPReferenceFailureUsesCredentialForFailingConnection(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
	diagnostic.begin("connection_binding")
	diagnostic.observeCredential(manager.AuthSelection{ServerName: "remote", Type: "id_token", Present: "true"})
	diagnostic.observeCredential(manager.AuthSelection{ServerName: "configuration", Type: "local_context", Present: "not_applicable"})
	diagnostic.observeAttempt(manager.HTTPAttempt{ServerName: "remote", RequestSent: true, StatusCode: 403, RequestID: "remote-request"})
	reader.reportFailure(ctx, "list", "remote", "", errors.New("private-error"))
	require.Equal(t, "remote_http", reported.Origin)
	require.Equal(t, "id_token", reported.CredentialType)
	require.Equal(t, "true", reported.CredentialPresent)
	require.Equal(t, "remote-request", reported.RemoteRequestID)
}

func TestMCPReferenceFailureDoesNotAttributeOtherConnection(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
	diagnostic.begin("connection_binding")
	diagnostic.observeCredential(manager.AuthSelection{ServerName: "configuration", Type: "local_context", Present: "not_applicable"})
	diagnostic.observeAttempt(manager.HTTPAttempt{ServerName: "configuration", RequestSent: true, StatusCode: 403, RequestID: "other-request"})
	reader.reportFailure(ctx, "list", "remote", "", errors.New("private-error"))
	require.Equal(t, "unknown", reported.Origin)
	require.Equal(t, "unknown", reported.CredentialType)
	require.Empty(t, reported.RemoteRequestID)
}

func TestMCPReferenceFailureDoesNotReuseSuccessfulHTTPForLocalPostcheck(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
	diagnostic.begin("outbound_request")
	diagnostic.observeAttempt(manager.HTTPAttempt{ServerName: "example", RequestSent: true, StatusCode: 200})
	diagnostic.begin("postcheck")
	err := errors.New("private-postcheck")
	markMCPReferenceFailure(ctx, "postcheck", "binding_changed", err)
	reader.reportFailure(ctx, "list", "example", "", err)
	require.Equal(t, "postcheck", reported.Stage)
	require.Equal(t, "local", reported.Origin)
	require.Zero(t, reported.HTTPStatus)
}

func TestMCPReferenceFailureDoesNotInferHTTP403FromRPCData(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
	diagnostic.begin("outbound_request")
	err := &jsonrpc.Error{Code: -32003, Data: json.RawMessage(`{"status":403}`)}
	reader.reportFailure(ctx, "list", "example", "", err)
	require.Equal(t, "unknown", reported.Origin)
	require.Zero(t, reported.HTTPStatus)
	require.Equal(t, 403, reported.RPCStatus)
}

func TestMCPReferenceFailureIdentifiesTransportWithoutResponse(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
	diagnostic.begin("outbound_request")
	diagnostic.observeAttempt(manager.HTTPAttempt{ServerName: "example", TransportError: true})
	reader.reportFailure(ctx, "list", "example", "", errors.New("private-transport-error"))
	require.Equal(t, "transport", reported.Origin)
	require.Equal(t, "outbound_request", reported.Stage)
	require.Zero(t, reported.HTTPStatus)
}

func TestMCPReferenceFailureDropsSuppressedEarlierAttempt(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
	diagnostic.begin("connection_binding")
	markMCPReferenceFailure(ctx, "connection_binding", "probe_failed", errors.New("suppressed"))
	diagnostic.begin("outbound_request")
	err := errors.New("current failure")
	markMCPReferenceFailure(ctx, "outbound_request", "resource_list_failed", err)
	reader.reportFailure(ctx, "list", "example", "", err)
	require.Equal(t, "outbound_request", reported.Stage)
	require.Equal(t, "resource_list_failed", reported.Reason)
}

func TestMCPReferenceFailureDistinguishesDeadlineFromCancellation(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	reader.reportFailure(context.Background(), "list", "example", "", context.DeadlineExceeded)
	require.Equal(t, "timeout", reported.Category)
	reader.reportFailure(context.Background(), "list", "example", "", context.Canceled)
	require.Equal(t, "canceled", reported.Category)
}

func TestMCPReferenceFailureIdentifiesLocalBindingMismatch(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	ctx, diagnostic := withMCPReferenceDiagnostic(context.Background())
	diagnostic.begin("connection_binding")
	err := errors.New("private mismatch")
	markMCPReferenceFailure(ctx, "connection_binding", "provider_identity_mismatch", err)
	reader.reportFailure(ctx, "list", "example", "", err)
	require.Equal(t, "local", reported.Origin)
	require.Zero(t, reported.HTTPStatus)
}
