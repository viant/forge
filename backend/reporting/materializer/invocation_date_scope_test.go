package materializer

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/dop251/goja"
	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

// Independently authored synthetic dates, predicates and rows; no application
// capture. Request paths and predicate IDs are deliberately generic.
func TestInvocationDateEdgesReplaceRelativeDefaultsInScopeAndFilterSummary(t *testing.T) {
	envelope := registry.ReportEnvelope{
		SchemaVersion: 1, Format: "forge.authoredReport", BuilderRef: "sampleBuilder",
		BuilderDefinition: json.RawMessage(`{"kind":"forge.reporting.builder","id":"sampleBuilder","reportBuilder":{"dataSourceRef":"sampleRows","measures":[{"id":"value","key":"value","label":"Value","paramPath":"measures.value","default":true}],"predicates":[{"id":"samplePeriod","kind":"dateRange","label":"Period","startParamPath":"filters.lower","endParamPath":"filters.upper","prefill":{"start":"lowerBound","end":"upperBound"}}]}}`),
		ReportDocument:    json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Sample","blocks":[{"id":"metric","kind":"kpiBlock","datasetRef":"primary","valueField":"value"},{"id":"filters","kind":"filterBarBlock","mode":"baseline","paramIds":["samplePeriod"],"datasetRef":"primary"}]}`),
		State:             json.RawMessage(`{"viewMode":"table","selectedMeasures":["value"],"scopeParams":{"samplePeriod":{"preset":"last7Days","startExpression":"7 days ago","endExpression":"yesterday","start":"2020-01-01","end":"2020-01-07"}}}`),
		DataSources:       map[string]json.RawMessage{"sampleRows": json.RawMessage(`{"id":"sampleRows","backend":{"kind":"inline","rows":[{"value":1}]}}`)},
	}
	envelope.Dependencies = []registry.ReportDependency{
		{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)},
		{Kind: "report", ID: "report://example/sample", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)},
		{Kind: "datasource", ID: "sampleRows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["sampleRows"])},
	}
	raw, err := json.Marshal(envelope)
	require.NoError(t, err)
	require.NoError(t, validateEnvelopeSourceKind(envelope, "report"))
	original := string(raw)
	compiled, err := goja.Compile("synthetic-invocation-date", bundle, true)
	require.NoError(t, err)
	now := time.Date(2026, time.January, 8, 12, 0, 0, 0, time.UTC)
	for _, test := range []struct {
		name       string
		filters    map[string]interface{}
		start, end string
	}{
		{"both", map[string]interface{}{"lower": "2026-01-06", "upper": "2026-01-07"}, "2026-01-06", "2026-01-07"},
		{"start-only", map[string]interface{}{"lower": "2026-01-06"}, "2026-01-06", "2026-01-07"},
		{"end-only", map[string]interface{}{"upper": "2026-01-07"}, "2026-01-01", "2026-01-07"},
		{"untouched", nil, "2026-01-02", "2026-01-08"},
	} {
		t.Run(test.name, func(t *testing.T) {
			input, err := json.Marshal(map[string]interface{}{"envelope": json.RawMessage(raw), "requestBaseParameters": map[string]interface{}{"filters": test.filters}})
			require.NoError(t, err)
			value, err := runEntryWithTimeSource(context.Background(), compiled, "lowerWithRequestBase", input, func() time.Time { return now })
			require.NoError(t, err)
			spec := json.RawMessage(value.String())
			var result struct {
				Scope struct {
					Params []struct {
						ID    string            `json:"id"`
						Value map[string]string `json:"value"`
					} `json:"params"`
				} `json:"scope"`
			}
			require.NoError(t, json.Unmarshal(spec, &result))
			require.Len(t, result.Scope.Params, 1)
			expected := map[string]string{"start": test.start, "end": test.end}
			require.Equal(t, expected, result.Scope.Params[0].Value)
			artifacts, err := MaterializeFill(context.Background(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"value":1}]}`)})
			require.NoError(t, err)
			var fill struct {
				Blocks []struct {
					ID      string `json:"id"`
					Content struct {
						Params []struct {
							Value map[string]string `json:"value"`
						} `json:"params"`
					} `json:"content"`
				} `json:"blocks"`
			}
			require.NoError(t, json.Unmarshal(artifacts.ReportFill, &fill))
			found := false
			for _, block := range fill.Blocks {
				if block.ID == "filters" {
					found = true
					require.Len(t, block.Content.Params, 1)
					require.Equal(t, expected, block.Content.Params[0].Value)
				}
			}
			require.True(t, found)
			require.Equal(t, original, string(raw), "invocation binding must not mutate admitted definition bytes")
		})
	}
}
