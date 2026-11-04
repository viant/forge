package materializer

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	identity "github.com/viant/forge/backend/resource"
)

// Reuse the neutral authored envelope admission fixture, replacing its report
// content with independently invented layout groups. This exercises native
// authored lowering rather than the direct-spec materialization bypass.
func TestCompositeRuntimeNativeAuthoredRoundTrip(t *testing.T) {
	for _, tc := range []struct {
		name     string
		runtime  string
		children string
		invalid  string
	}{
		{"bare", `{"chrome":"none"}`, `["left","right"]`, ""},
		{"weighted", `{"chrome":"panel","childWeights":{"left":1,"right":3},"minColumnWidth":100}`, `["left","right"]`, ""},
		{"columns", `{"desktopColumns":6,"tabletColumns":3,"mobileColumns":2,"minColumnWidth":180}`, `["left","right"]`, ""},
		{"columnsLenient", `{"desktopColumns":99,"tabletColumns":"invalid","mobileColumns":-3,"minColumnWidth":"invalid"}`, `["left","right"]`, ""},
		{"spacer", `{"chrome":"none","spacerHeight":8}`, `[]`, ""},
		{"zeroSpacer", `{"chrome":"none","spacerHeight":0}`, `[]`, ""},
		{"invalidWeights", `{"childWeights":{"left":1}}`, `["left","right"]`, "one weight per child"},
		{"invalidChrome", `{"chrome":"unknown"}`, `["left","right"]`, "chrome must be none or panel"},
		{"invalidSpacer", `{"chrome":"none","spacerHeight":-1}`, `["left","right"]`, "spacerHeight requires finite nonnegative size"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			envelope := refinementFieldsEnvelope(t)
			var runtime map[string]any
			require.NoError(t, json.Unmarshal([]byte(tc.runtime), &runtime))
			// A shared runtime binding used to overwrite the composite metadata.
			runtime["visibleWhen"] = map[string]any{"source": "metrics", "field": "count", "equals": float64(42)}
			var children []string
			require.NoError(t, json.Unmarshal([]byte(tc.children), &children))
			document := map[string]any{"version": 1, "kind": "reportDocument", "title": "Layout evidence", "blocks": []any{
				map[string]any{"id": "group", "kind": "compositeBlock", "title": "Layout group", "layout": "responsiveGrid", "childBlockIds": children, "runtime": runtime},
				map[string]any{"id": "left", "kind": "markdownBlock", "title": "Left", "markdown": "Left notes"},
				map[string]any{"id": "right", "kind": "markdownBlock", "title": "Right", "markdown": "Right notes"},
			}}
			var err error
			envelope.ReportDocument, err = json.Marshal(document)
			require.NoError(t, err)
			for index, dependency := range envelope.Dependencies {
				if dependency.Kind == "report" {
					envelope.Dependencies[index].ContentFingerprint = identity.ContentFingerprint(envelope.ReportDocument)
				}
			}
			raw, err := json.Marshal(envelope)
			require.NoError(t, err)
			lowered, err := Lower(t.Context(), raw)
			require.NoError(t, err)
			decoded, err := reportspec.DecodeJSON(lowered)
			if tc.invalid != "" {
				require.ErrorContains(t, err, tc.invalid, "existing native validator must receive the unchanged declaration")
				return
			}
			require.NoError(t, err)
			found := false
			for _, block := range decoded.Blocks {
				if block.ID == "group" {
					found = true
					require.Equal(t, runtime, block.Runtime)
				}
			}
			require.True(t, found)
			roundtrip, err := json.Marshal(decoded)
			require.NoError(t, err)
			reopened, err := reportspec.DecodeJSON(roundtrip)
			require.NoError(t, err)
			for index, block := range decoded.Blocks {
				require.Equal(t, block.Runtime, reopened.Blocks[index].Runtime)
			}
		})
	}
}
