package datasource

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestBackendJSONPreservesExplicitEmptyRowsAndMissingRows(t *testing.T) {
	for _, test := range []struct{ name, input, expected string }{{"empty", "kind: inline\nrows: []\n", `{"kind":"inline","rows":[]}`}, {"missing", "kind: inline\n", `{"kind":"inline"}`}, {"populated", "kind: inline\nrows: [{id: 7}]\n", `{"kind":"inline","rows":[{"id":7}]}`}} {
		t.Run(test.name, func(t *testing.T) {
			var source Backend
			require.NoError(t, yaml.Unmarshal([]byte(test.input), &source))
			raw, err := json.Marshal(source)
			require.NoError(t, err)
			require.JSONEq(t, test.expected, string(raw))
			var roundtrip Backend
			require.NoError(t, json.Unmarshal(raw, &roundtrip))
			require.Equal(t, source.Rows == nil, roundtrip.Rows == nil)
			again, err := json.Marshal(roundtrip)
			require.NoError(t, err)
			require.JSONEq(t, string(raw), string(again))
		})
	}
}
