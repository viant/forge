package reportspec

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTableCollapseJSONPreservesExplicitFalseAndOmittedDefault(t *testing.T) {
	for _, tc := range []struct {
		name, input string
		collapsed   bool
	}{
		{"expanded", `{"id":"rows","kind":"tableBlock","collapsible":true,"defaultCollapsed":false}`, false},
		{"collapsed", `{"id":"rows","kind":"tableBlock","collapsible":true,"defaultCollapsed":true}`, true},
		{"omitted", `{"id":"rows","kind":"tableBlock","collapsible":true}`, true},
		{"ordinary", `{"id":"rows","kind":"tableBlock"}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var block Block
			require.NoError(t, json.Unmarshal([]byte(tc.input), &block))
			require.Equal(t, tc.collapsed, block.DefaultCollapsed)
			wire, err := json.Marshal(block)
			require.NoError(t, err)
			var object map[string]any
			require.NoError(t, json.Unmarshal(wire, &object))
			require.Equal(t, tc.collapsed, object["defaultCollapsed"])
			var roundTrip Block
			require.NoError(t, json.Unmarshal(wire, &roundTrip))
			require.Equal(t, block, roundTrip)
		})
	}
	wire, err := json.Marshal(Block{ID: "note", Kind: "markdownBlock"})
	require.NoError(t, err)
	require.NotContains(t, string(wire), "defaultCollapsed", "table-only metadata must not pollute other block contracts")
	var invalid Block
	require.Error(t, json.Unmarshal([]byte(`{"id":"rows","kind":"tableBlock","unknownSetting":true}`), &invalid))
}

func TestTableCollapseReportSpecDecodeRoundTrip(t *testing.T) {
	for _, omitted := range []bool{false, true} {
		fixture := loadReportSpecFixtureMap(t, "capacity-direct-series-export-request-fixture.v1.json")
		blocks := fixture["blocks"].([]any)
		table := blocks[len(blocks)-1].(map[string]any)
		table["collapsible"] = true
		if omitted {
			delete(table, "defaultCollapsed")
		} else {
			table["defaultCollapsed"] = false
		}
		wire, err := json.Marshal(fixture)
		require.NoError(t, err)
		decoded, err := DecodeJSON(wire)
		require.NoError(t, err)
		require.Equal(t, omitted, decoded.Blocks[len(decoded.Blocks)-1].DefaultCollapsed)
		serialized, err := json.Marshal(decoded)
		require.NoError(t, err)
		again, err := DecodeJSON(serialized)
		require.NoError(t, err)
		require.Equal(t, omitted, again.Blocks[len(again.Blocks)-1].DefaultCollapsed)
	}
}
