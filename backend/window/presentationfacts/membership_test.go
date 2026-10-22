package presentationfacts

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMembershipCapturesCollectionsOnceAndPreservesWireFacts(t *testing.T) {
	roles := []any{"reader", "reader", 42}
	values := map[string]any{"principal": map[string]any{"roles": roles, "features": []string{"FLAG"}, "exposures": map[string]any{"REPORTS_UI": false}, "label": "reader operator"}}
	before, err := json.Marshal(values)
	require.NoError(t, err)
	index := NewMembership(values, "principal.roles", "principal.features", "principal.exposures", "principal.label")
	for _, path := range []string{"principal.roles", "principal.features", "principal.exposures"} {
		expected := map[string]string{"principal.roles": "reader", "principal.features": "FLAG", "principal.exposures": "REPORTS_UI"}[path]
		match, handled := index.Contains(path, expected)
		require.True(t, handled)
		require.True(t, match)
	}
	after, err := json.Marshal(values)
	require.NoError(t, err)
	require.Equal(t, before, after)
	_, handled := index.Contains("principal.label", "reader")
	require.False(t, handled, "strings keep substring semantics")
	_, handled = index.Contains("principal.roles", 42)
	require.False(t, handled, "non-string comparisons retain the generic evaluator")
	roles[0] = "updated"
	roles[1] = "updated"
	match, handled := index.Contains("principal.roles", "reader")
	require.True(t, handled)
	require.True(t, match, "one captured evaluation scope must not rebuild per lookup")
	values["principal"].(map[string]any)["roles"] = []string{"replacement"}
	current := NewMembership(values, "principal.roles")
	match, _ = current.Contains("principal.roles", "reader")
	require.False(t, match)
	match, _ = current.Contains("principal.roles", "replacement")
	require.True(t, match)
	allocations := testing.AllocsPerRun(3000, func() {
		match, handled := index.Contains("principal.roles", "reader")
		if !match || !handled {
			panic("lost membership")
		}
	})
	require.Zero(t, allocations, "contains must not allocate or reconstruct membership maps")
}
