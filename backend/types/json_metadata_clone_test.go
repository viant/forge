package types

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestJSONMetadataCloneDetachesEveryMutableShapeAndPreservesNumbers(t *testing.T) {
	type child struct {
		Values []string
		Data   json.RawMessage
	}
	type metadata struct {
		Object   map[string]any
		Child    *child
		Children []*child
		Raw      json.RawMessage
	}
	source := metadata{Object: map[string]any{"number": json.Number("9007199254740993"), "nested": map[string]any{"list": []any{map[string]any{"name": "original"}}}}, Child: &child{Values: []string{"original"}, Data: json.RawMessage(`{"raw":true}`)}, Children: []*child{{Values: []string{"child"}}}, Raw: json.RawMessage(`{"source":true}`)}
	first, err := cloneJSONMetadata(source)
	require.NoError(t, err)
	second, err := cloneJSONMetadata(source)
	require.NoError(t, err)
	require.Equal(t, json.Number("9007199254740993"), first.Object["number"])
	first.Object["nested"].(map[string]any)["list"].([]any)[0].(map[string]any)["name"] = "changed"
	first.Child.Values[0] = "changed"
	first.Child.Data[0] = '['
	first.Children[0].Values[0] = "changed"
	first.Raw[0] = '['
	require.Equal(t, "original", source.Object["nested"].(map[string]any)["list"].([]any)[0].(map[string]any)["name"])
	require.Equal(t, source, second, "separate calls cannot alias mutable source or one another")
	require.Equal(t, "original", source.Child.Values[0])
	require.Equal(t, byte('{'), source.Child.Data[0])
	require.Equal(t, "child", source.Children[0].Values[0])
	require.Equal(t, byte('{'), source.Raw[0])
}
func TestCompiledWindowSelectCallerMutationCannotChangeCapturedSource(t *testing.T) {
	raw := json.RawMessage(`{"view":{"content":{"id":"root","items":[{"id":"value","value":9007199254740993}],"data":{"nested":{"list":["source"]}}}},"parameters":[{"name":"id","value":9007199254740993}],"dataSource":{"items":{"parameters":[{"name":"id","from":"windowForm"}],"service":{"endpoint":"owner"}}},"resourceDependencies":{"items":"original"}}`)
	compiled, err := CompileWindowResource(raw)
	require.NoError(t, err)
	first, err := compiled.Select(nil)
	require.NoError(t, err)
	baseline, err := json.Marshal(first)
	require.NoError(t, err)
	first.Window.View.Content.ID = "mutated"
	first.Window.DataSource["items"] = DataSource{}
	first.Window.ResourceDependencies["items"] = "mutated"
	first.Window.Parameters[0]["value"] = "mutated"
	second, err := compiled.Select(nil)
	require.NoError(t, err)
	after, err := json.Marshal(second)
	require.NoError(t, err)
	require.JSONEq(t, string(baseline), string(after))
	require.Equal(t, json.Number("9007199254740993"), second.Window.Parameters[0]["value"])
	require.Equal(t, "root", second.Window.View.Content.ID)
	require.Error(t, func() error {
		_, err := CompileWindowResource(json.RawMessage(`{"view":{"content":{}}} trailing`))
		return err
	}(), "unsupported non-JSON source never reaches typed clone")
}
