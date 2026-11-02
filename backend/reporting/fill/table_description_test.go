package reportfill

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDatasourceTableDescriptionRoundTrip(t *testing.T) {
	var raw map[string]any
	require.NoError(t, json.Unmarshal([]byte(validTestReportFillJSON()), &raw))
	table := raw["blocks"].([]any)[0].(map[string]any)
	table["description"] = "Readings include all observations in the selected period."
	encoded, err := json.Marshal(raw)
	require.NoError(t, err)
	fill, err := DecodeDatasourceJSON(encoded)
	require.NoError(t, err)
	require.Equal(t, table["description"], fill.Blocks[0].Description)
	roundTrip, err := json.Marshal(fill)
	require.NoError(t, err)
	decoded, err := DecodeDatasourceJSON(roundTrip)
	require.NoError(t, err)
	require.Equal(t, fill.Blocks[0].Description, decoded.Blocks[0].Description)
	require.Equal(t, fill.Blocks[0].Content, decoded.Blocks[0].Content)

	// Accepting the authored description does not relax strict table decoding.
	table["unknownPresentation"] = true
	encoded, err = json.Marshal(raw)
	require.NoError(t, err)
	_, err = DecodeDatasourceJSON(encoded)
	require.ErrorContains(t, err, `unknown field "unknownPresentation"`)
}
