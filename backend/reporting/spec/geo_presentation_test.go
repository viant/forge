package reportspec

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestGeoPresentationMetadata(t *testing.T) {
	for _, geo := range []map[string]any{{}, {"summary": false}, {"summary": true}, {"color": map[string]any{"legendScope": "observed"}}, {"color": map[string]any{"legendScope": "declared"}}} {
		require.NoError(t, ValidateGeoPresentation(geo))
	}
	for _, value := range []any{nil, "false", 0} {
		require.Error(t, ValidateGeoPresentation(map[string]any{"summary": value}))
	}
	for _, value := range []any{nil, "all", false, []any{}, map[string]any{}} {
		require.Error(t, ValidateGeoPresentation(map[string]any{"color": map[string]any{"legendScope": value}}))
	}
}
