package resource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	manager "github.com/viant/forge/backend/clientpool"
	"github.com/viant/jsonrpc"
)

func TestMCPReferenceReaderReportsListFailureAtOwningConnection(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{
		gateway:   &Gateway{Manager: &manager.Manager{}},
		OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure },
	}
	_, err := reader.rows(context.Background(), Connection{Name: "example"}, "workspace")
	require.Error(t, err)
	require.Equal(t, "list", reported.Operation)
	require.Equal(t, "example", reported.Connection)
	require.Equal(t, "other", reported.Category)
}

func TestMCPReferenceReaderFailureExcludesUpstreamPayload(t *testing.T) {
	var reported MCPReferenceFailure
	reader := &MCPReferenceReader{OnFailure: func(_ context.Context, failure MCPReferenceFailure) { reported = failure }}
	err := &jsonrpc.Error{Code: -32003, Message: "private-error-message", Data: json.RawMessage(`{"status":403,"token":"private-token"}`)}
	reader.reportFailure(context.Background(), "get_definition", "example", "mcp://workspace/example", err)
	require.Equal(t, "denied", reported.Category)
	require.Equal(t, -32003, reported.RPCCode)
	require.Equal(t, 403, reported.RPCStatus)
	raw, marshalErr := json.Marshal(reported)
	require.NoError(t, marshalErr)
	require.NotContains(t, string(raw), "private-error-message")
	require.NotContains(t, string(raw), "private-token")
}
