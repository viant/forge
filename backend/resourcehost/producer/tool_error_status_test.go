package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/stretchr/testify/require"
	primitive "github.com/viant/forge/backend/provider/contract"
	identity "github.com/viant/forge/backend/resource"
	"github.com/viant/jsonrpc"
	"github.com/viant/mcp"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
	"net/http"
	"net/http/httptest"
	"testing"
)

type nativeValidationStatus struct{}

func (nativeValidationStatus) Error() string   { return "synthetic validation conflict" }
func (nativeValidationStatus) StatusCode() int { return 409 }

type failingAuthor struct {
	*catalogWriter
	failure error
}

func (w failingAuthor) CreateResource(context.Context, primitive.CreateResourceInput) (*primitive.ResourceResult, error) {
	return nil, w.failure
}

func TestNativeMCPResourceErrorsRetainTypedStatus(t *testing.T) {
	cases := []struct {
		name   string
		cause  error
		status int
	}{
		{"validation", identity.ErrResource, 400}, {"denied", identity.ErrResourceDenied, 403},
		{"stale", identity.ErrResourceStale, 409}, {"cancelled", context.Canceled, 499},
		{"deadline", context.DeadlineExceeded, 504}, {"unavailable", ErrUnavailable, 503},
		{"authentication", jsonrpc.NewUnauthorizedError(401, nil), 401},
		{"nativeStatus", nativeValidationStatus{}, 409},
		{"unknown", errors.New("synthetic sensitive error detail"), 500},
	}
	for _, test := range cases {
		for _, network := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/http=%v", test.name, network), func(t *testing.T) {
				p, writer, ctx := authoringFixture(t)
				config := p.ConfigurationSnapshot()
				config.Authoring = failingAuthor{writer, test.cause}
				p, err := NewLocalProvider(config)
				require.NoError(t, err)
				var client mcpclient.Interface
				if network {
					handler, err := NewLocalMCPHandler(p, func(next http.Handler) http.Handler {
						return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { next.ServeHTTP(w, r.WithContext(ctx)) })
					})
					require.NoError(t, err)
					server := httptest.NewServer(handler)
					defer server.Close()
					remote, err := mcp.NewClient(nil, &mcp.ClientOptions{Name: "status-test", Version: "1", ProtocolVersion: schema.LatestProtocolVersion, Transport: mcp.ClientTransport{Type: "streamable", ClientTransportHTTP: mcp.ClientTransportHTTP{URL: server.URL + "/mcp"}}})
					require.NoError(t, err)
					_, err = remote.Initialize(context.Background())
					require.NoError(t, err)
					client = remote
				} else {
					client, err = NewLocalMCPClient(p)
					require.NoError(t, err)
				}
				if closer, ok := client.(interface{ Close() error }); ok {
					defer closer.Close()
				}
				result, err := client.CallTool(ctx, &schema.CallToolRequestParams{Name: "reports/create", Arguments: map[string]any{"uri": "report://users/alice/new", "formatVersion": 1, "definition": map[string]any{"schemaVersion": 1, "reportDocument": map[string]any{"title": "Example"}}}})
				require.NoError(t, err)
				require.True(t, *result.IsError)
				status, ok := schema.ToolErrorHTTPStatus(result)
				require.True(t, ok)
				require.Equal(t, test.status, status)
				encoded, err := json.Marshal(result)
				require.NoError(t, err)
				require.NotContains(t, string(encoded), "synthetic sensitive error detail")
			})
		}
	}
}

func TestWriteValidationPreservesTypedFailureBeforeBadInputClassification(t *testing.T) {
	cases := []struct {
		cause  error
		status int
	}{{errors.New("synthetic malformed definition"), 400}, {context.Canceled, 499}, {ErrUnavailable, 503}, {nativeValidationStatus{}, 409}, {jsonrpc.NewHTTPStatusError(503), 503}}
	for _, test := range cases {
		p, writer, ctx := authoringFixture(t)
		config := p.ConfigurationSnapshot()
		config.Validators = map[string]LocalResourceValidator{"report": func(int64, json.RawMessage) error { return test.cause }}
		p, err := NewLocalProvider(config)
		require.NoError(t, err)
		client, err := NewLocalMCPClient(p)
		require.NoError(t, err)
		defer client.(interface{ Close() error }).Close()
		result, err := client.CallTool(ctx, &schema.CallToolRequestParams{Name: "reports/create", Arguments: map[string]any{"uri": "report://users/alice/new", "formatVersion": 1, "definition": map[string]any{"title": "Example"}}})
		require.NoError(t, err)
		status, ok := schema.ToolErrorHTTPStatus(result)
		require.True(t, ok)
		require.Equal(t, test.status, status)
		require.Zero(t, writer.writes.Load())
	}
}
