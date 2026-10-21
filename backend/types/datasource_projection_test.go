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

func TestCanonicalLocalProjectionKeepsRowRelativeSelectors(t *testing.T) {
	source := DataSource{DataSourceRef: "record", Selectors: &Selectors{Data: ".", Metrics: ".", DataInfo: "summary"}}
	projected := ProjectNativeDataSource("properties", source)
	require.Equal(t, source, projected)
	require.Nil(t, projected.Service)
	raw, err := CompileWindowDataSource("properties", json.RawMessage(`{"id":"properties","dataSourceRef":"record","selectors":{"data":".","metrics":"."},"backend":{"kind":"inline","rows":[]}}`), nil)
	require.NoError(t, err)
	var actual DataSource
	require.NoError(t, json.Unmarshal(raw, &actual))
	require.Nil(t, actual.Service)
	require.Equal(t, "record", actual.DataSourceRef)
	require.Equal(t, ".", actual.Selectors.Data)
	require.Equal(t, ".", actual.Selectors.Metrics)
}
