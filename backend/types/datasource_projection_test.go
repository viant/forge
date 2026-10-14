package types

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestCanonicalDataSourceProjection(t *testing.T) {
	raw, err := CompileWindowDataSource("records", json.RawMessage(`{"id":"records","parameters":[{"name":"Id","in":"windowForm","location":"ChangedId","codec":{"name":"int[]"},"default":"unchanged"}],"targetOverrides":{"web":{"precise":9007199254740993,"decimal":1.234567890123456789}},"selectors":{"data":"data","dataInfo":"meta"},"backend":{"kind":"mcp_tool","method":"OriginalReader"}}`), json.RawMessage(`{"x-preserved":{"custom":true},"parameters":[]}`))
	require.NoError(t, err)
	require.Contains(t, string(raw), `"location":"ChangedId"`)
	require.Contains(t, string(raw), `9007199254740993`)
	require.Contains(t, string(raw), `"data":"rows"`)
	require.Contains(t, string(raw), `"dataInfo":"dataInfo"`)
	require.Contains(t, string(raw), `"x-preserved"`)
	require.NotContains(t, string(raw), `"backend"`)
	raw, err = CompileWindowDataSource("records", json.RawMessage(`{"id":"records","service":{"uri":"/explicit","method":"GET"},"selectors":{"data":"custom"}}`), nil)
	require.NoError(t, err)
	require.Contains(t, string(raw), `"uri":"/explicit"`)
	require.Contains(t, string(raw), `"data":"custom"`)
}
