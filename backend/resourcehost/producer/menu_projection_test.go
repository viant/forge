package provider

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMenuProjectionSubsetRetainsActionsAndAncestry(t *testing.T) {
	original := json.RawMessage(`{"schemaVersion":1,"applications":[{"id":"public","menus":[{"id":"first","action":{"type":"window","windowKey":"one","parameters":{"opaque":9007199254740993}}},{"id":"second","action":{"type":"window","windowKey":"two"}}]},{"id":"protected","menus":[{"id":"secret","action":{"type":"window","windowKey":"secret"}}]}]}`)
	filtered := json.RawMessage(`{"schemaVersion":1,"applications":[{"id":"public","menus":[{"id":"first","action":{"type":"window","windowKey":"one","parameters":{"opaque":9007199254740993}}}]}]}`)
	require.True(t, menuProjectionSubset(original, filtered))
	for _, invalid := range []string{
		`{"schemaVersion":1,"applications":[{"id":"public","menus":[{"id":"first","action":{"type":"window","windowKey":"one","parameters":{"opaque":9007199254740992}}}]}]}`,
		`{"schemaVersion":1,"applications":[{"id":"public","menus":[{"id":"secret","action":{"type":"window","windowKey":"secret"}}]}]}`,
		`{"schemaVersion":1,"applications":[{"id":"public","menus":[{"id":"second","action":{"type":"window","windowKey":"two"}},{"id":"first","action":{"type":"window","windowKey":"one","parameters":{"opaque":9007199254740993}}}]}]}`,
	} {
		require.False(t, menuProjectionSubset(original, json.RawMessage(invalid)), "projection may only remove original nodes")
	}
}
