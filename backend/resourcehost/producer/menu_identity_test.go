package provider

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestNavigationRootApplicationIdentity(t *testing.T) {
	raw := json.RawMessage(`{"schemaVersion":1,"name":"Example App","icon":"application","applications":[{"id":"example","title":"Example App","icon":"application","menus":[{"id":"home","action":{"resourceUri":"window://example/home"}}]}]}`)
	require.NoError(t, ValidateMenu(1, raw))
	require.True(t, menuProjectionSubset(raw, raw))
	var changed map[string]any
	require.NoError(t, json.Unmarshal(raw, &changed))
	changed["name"] = "Other App"
	encoded, _ := json.Marshal(changed)
	require.False(t, menuProjectionSubset(raw, encoded))
	for _, field := range []string{"name", "icon"} {
		for _, value := range []any{nil, 123, "", "invalid\nvalue"} {
			var fields map[string]any
			require.NoError(t, json.Unmarshal(raw, &fields))
			fields[field] = value
			data, _ := json.Marshal(fields)
			require.Error(t, ValidateMenu(1, data))
		}
	}
}

// Existing v1 documents do not need application identity at the root.
func TestNavigationRootIdentityIsOptional(t *testing.T) {
	raw := json.RawMessage(`{"schemaVersion":1,"applications":[{"id":"legacy","title":"Legacy","menus":[{"id":"home","action":{"type":"window","windowKey":"home"}}]}]}`)
	require.NoError(t, ValidateMenu(1, raw))
	require.True(t, menuProjectionSubset(raw, raw))
	for _, field := range []string{"name", "icon"} {
		var fields map[string]any
		require.NoError(t, json.Unmarshal(raw, &fields))
		fields[field] = "application"
		encoded, err := json.Marshal(fields)
		require.NoError(t, err)
		require.NoError(t, ValidateMenu(1, encoded))
		require.False(t, menuProjectionSubset(raw, encoded))
	}
}
