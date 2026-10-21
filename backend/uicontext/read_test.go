package uicontext

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"strings"
	"testing"
)

func TestReadRedactionPreservesSafeShapesAndIdentities(t *testing.T) {
	metadata := map[string]interface{}{"view": map[string]interface{}{"content": map[string]interface{}{"dataSourceRef": "rows", "items": []interface{}{map[string]interface{}{"id": "opaqueEditor", "type": "text", "dataField": "profile.pin", "sensitive": true}}}}}
	raw := json.RawMessage(`{"selection":{"selected":{"id":9007199254740993,"name":"Safe","profile":{"pin":"opaque-credential"}}},"form":{"password":"opaque","authorization":"Basic dXNlcjpwYXNz","note":"Bearer opaque","jwt":"eyJabc.abc.signature","name":"Safe","profile":{"pin":"opaque-credential"}},"filter":{"access_token":"opaque"},"operationRevision":7}`)
	result, err := RedactReadJSON(raw, ReadOptions{Metadata: metadata, DataSourceRef: "rows"})
	require.NoError(t, err)
	require.True(t, result.Redacted)
	require.False(t, result.Truncated)
	text := string(result.JSON)
	require.Contains(t, text, `9007199254740993`)
	require.Contains(t, text, `"name":"Safe"`)
	require.Contains(t, text, `"operationRevision":7`)
	require.NotContains(t, text, "opaque")
	require.NotContains(t, text, "dXNlcjpwYXNz")
	require.NotContains(t, text, "eyJabc")
}
func TestReadRedactionUsesPerSourceMetadataAndKeepsRequestedPins(t *testing.T) {
	metadata := map[string]interface{}{"view": map[string]interface{}{"controls": []interface{}{map[string]interface{}{"dataSourceRef": "rows", "dataField": "opaque", "type": "password"}}}}
	raw := json.RawMessage(`{"resource":{"authorityBinding":"existing-pin","selectionToken":"required-runtime-proof"},"dataSources":{"rows":{"form":{"opaque":"private","id":7}},"other":{"form":{"opaque":"visible","id":8}}},"surface":{"controls":[{"type":"password","value":"private"}]}}`)
	result, err := RedactReadJSON(raw, ReadOptions{Metadata: metadata, PreservePaths: []string{"resource"}})
	require.NoError(t, err)
	text := string(result.JSON)
	require.Contains(t, text, "existing-pin")
	require.Contains(t, text, "required-runtime-proof")
	require.Contains(t, text, "visible")
	require.NotContains(t, text, "private")
}
func TestReadRedactionIsBoundedAndReportsTruncation(t *testing.T) {
	raw, _ := json.Marshal(map[string]interface{}{"id": 7, "rows": strings.Split(strings.Repeat("safe,", 200), ","), "text": strings.Repeat("x", 5000)})
	result, err := RedactReadJSON(raw, ReadOptions{MaxItems: 2, MaxString: 128})
	require.NoError(t, err)
	require.True(t, result.Truncated)
	require.Contains(t, string(result.JSON), `"id":7`)
	require.Less(t, len(result.JSON), 1024)
	_, err = RedactReadJSON(json.RawMessage(`{"resource":"`+strings.Repeat("p", 1000)+`"}`), ReadOptions{MaxBytes: 100, PreservePaths: []string{"resource"}})
	require.ErrorIs(t, err, ErrReadBudget)
	for _, value := range []string{"Basic encoded", "Bearer opaque", "https://example.invalid/?api_key=opaque", "https://user:password@example.invalid", "eyJabc.abc.signature"} {
		raw, _ := json.Marshal(map[string]interface{}{"value": value})
		clean, err := RedactReadJSON(raw, ReadOptions{})
		require.NoError(t, err)
		require.True(t, clean.Redacted, value)
	}
}

func TestReadBudgetKeepsPinContractsAndSelectedIDsBeforeLargeState(t *testing.T) {
	raw, _ := json.Marshal(map[string]interface{}{"id": 7, "operationRevision": 123, "resource": map[string]interface{}{"authorityBinding": "pin", "selectionToken": "existing-proof"}, "selection": map[string]interface{}{"selected": map[string]interface{}{"id": 9, "name": "Selected"}}, "metadata": map[string]interface{}{"large": strings.Repeat("x", 10000)}, "collection": []interface{}{map[string]interface{}{"id": 10, "large": strings.Repeat("x", 10000)}}})
	result, err := RedactReadJSON(raw, ReadOptions{MaxBytes: 1000, MaxString: 512, PreservePaths: []string{"resource"}})
	require.NoError(t, err)
	require.True(t, result.Truncated)
	var value map[string]interface{}
	require.NoError(t, json.Unmarshal(result.JSON, &value))
	require.EqualValues(t, 7, value["id"])
	require.EqualValues(t, 123, value["operationRevision"])
	require.Equal(t, "existing-proof", value["resource"].(map[string]interface{})["selectionToken"])
	require.EqualValues(t, 9, value["selection"].(map[string]interface{})["selected"].(map[string]interface{})["id"])
}

func TestReadSensitivityUsesRuntimeBindingFallback(t *testing.T) {
	for _, binding := range []map[string]interface{}{{"id": "opaque", "type": "password"}, {"id": "editor", "type": "text", "bindingPath": "opaque", "sensitive": true}} {
		metadata := map[string]interface{}{"view": map[string]interface{}{"controls": []interface{}{binding}}}
		result, err := RedactReadJSON(json.RawMessage(`{"windowForm":{"opaque":"private-value","Name":"Visible"}}`), ReadOptions{Metadata: metadata})
		require.NoError(t, err)
		require.NotContains(t, string(result.JSON), "private-value")
		require.Contains(t, string(result.JSON), "Visible")
	}
}
