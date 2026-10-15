package resource

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/provider/contract/observe"
	"github.com/viant/mcp-protocol/schema"
	mcpclient "github.com/viant/mcp/client"
)

type observedToolClient struct {
	mcpclient.Interface
	calls   int
	failure error
}

func (c *observedToolClient) CallTool(_ context.Context, _ *schema.CallToolRequestParams, _ ...mcpclient.RequestOption) (*schema.CallToolResult, error) {
	c.calls++
	if c.failure != nil {
		return nil, c.failure
	}
	return &schema.CallToolResult{StructuredContent: map[string]any{"value": "sensitive-result"}}, nil
}

func TestGatewayTimingsSeparateDispatchAndEncodingWithoutPayloads(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(map[bool]string{false: "success", true: "failure"}[fail], func(t *testing.T) {
			var events []observe.Event
			ctx := observe.WithObserver(context.Background(), observe.ObserverFunc(func(event observe.Event) { events = append(events, event) }))
			client := &observedToolClient{}
			if fail {
				client.failure = errors.New("sensitive-error")
			}
			_, err := toolRaw(ctx, client, "reports/get", map[string]any{"uri": "report://users/private-user/private-path", "token": "sensitive-token"})
			if fail {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, 1, client.calls)
			phases := map[observe.Phase]observe.Event{}
			for _, event := range events {
				require.GreaterOrEqual(t, event.Duration.Nanoseconds(), int64(0))
				require.Equal(t, "report", event.Kind)
				phases[event.Phase] = event
			}
			require.Contains(t, phases, observe.GatewayRequestEncode)
			require.Contains(t, phases, observe.GatewayMCPCall)
			require.Contains(t, phases, observe.GatewayTool)
			if fail {
				require.Equal(t, observe.Error, phases[observe.GatewayMCPCall].Outcome)
				require.NotContains(t, phases, observe.GatewayResponseDecode)
			} else {
				require.Contains(t, phases, observe.GatewayResponseDecode)
				require.Equal(t, observe.OK, phases[observe.GatewayTool].Outcome)
			}
			encoded, err := json.Marshal(events)
			require.NoError(t, err)
			for _, private := range []string{"sensitive", "private-user", "private-path", "report://"} {
				require.False(t, strings.Contains(string(encoded), private), "timings leaked request or response data")
			}
		})
	}
}
