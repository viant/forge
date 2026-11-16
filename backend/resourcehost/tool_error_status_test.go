package resource

import (
	"context"
	"errors"
	"github.com/stretchr/testify/require"
	identity "github.com/viant/forge/backend/resource"
	producer "github.com/viant/forge/backend/resourcehost/producer"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	"testing"
	"time"
)

type statusResultClient struct {
	mcpclient.Interface
	result *schema.CallToolResult
}

func (c statusResultClient) CallTool(context.Context, *schema.CallToolRequestParams, ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	return c.result, nil
}
func TestGatewayToolErrorsUseExistingTypedStatusMetadata(t *testing.T) {
	for _, test := range []struct {
		status int
		cause  error
	}{{400, identity.ErrResource}, {403, identity.ErrResourceDenied}, {409, identity.ErrResourceStale}, {499, nil}, {503, ErrUnavailable}, {504, nil}, {501, errors.ErrUnsupported}, {401, nil}, {500, nil}, {404, producer.ErrCatalogNotFound}} {
		failed := true
		result := &schema.CallToolResult{IsError: &failed, StructuredContent: map[string]any{"message": "synthetic sensitive detail"}}
		require.True(t, schema.SetToolErrorHTTPStatus(result, test.status))
		raw, err := toolRaw(context.Background(), statusResultClient{result: result}, "reports/update", map[string]any{"uri": "report://example/summary"})
		require.Empty(t, raw)
		require.Error(t, err)
		require.NotContains(t, err.Error(), "synthetic sensitive detail")
		var status *jsonrpc.HTTPStatusError
		require.ErrorAs(t, err, &status)
		require.Equal(t, test.status, status.HTTPStatusCode())
		if test.cause != nil {
			require.ErrorIs(t, err, test.cause)
		}
		if test.status != 403 {
			require.NotErrorIs(t, err, identity.ErrResourceDenied)
		}
		require.Equal(t, test.status == 401, jsonrpc.IsUnauthorized(err))
		require.NotErrorIs(t, err, context.Canceled)
		require.NotErrorIs(t, err, context.DeadlineExceeded)
	}
	failed := true
	for _, result := range []*schema.CallToolResult{nil, {IsError: &failed, StructuredContent: map[string]any{"message": "denied"}}} {
		_, err := toolRaw(context.Background(), statusResultClient{result: result}, "reports/update", map[string]any{})
		require.Error(t, err)
		require.NotErrorIs(t, err, identity.ErrResourceDenied)
	}
}

func TestRemoteToolFailurePreservesActualCallerCancellation(t *testing.T) {
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	deadline, finish := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer finish()
	for _, ctx := range []context.Context{cancelled, deadline} {
		for _, status := range []int{499, 504} {
			failed := true
			result := &schema.CallToolResult{IsError: &failed}
			schema.SetToolErrorHTTPStatus(result, status)
			_, err := toolRaw(ctx, statusResultClient{result: result}, "reports/get", map[string]any{})
			require.ErrorIs(t, err, ctx.Err())
			var wire *jsonrpc.HTTPStatusError
			require.ErrorAs(t, err, &wire)
			require.Equal(t, status, wire.HTTPStatusCode())
		}
	}
}
