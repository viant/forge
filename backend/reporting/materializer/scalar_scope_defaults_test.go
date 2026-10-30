package materializer

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

// Independently authored synthetic scalar predicates and rows, without an
// application capture. Omitted values must inherit defaults; saved values and
// host invocation values, including false and zero, retain their precedence.
func TestScalarScopeDefaultsAndOverrides(t *testing.T) {
	envelope := registry.ReportEnvelope{
		SchemaVersion: 1, Format: "forge.authoredReport", BuilderRef: "sampleBuilder",
		BuilderDefinition: json.RawMessage(`{"kind":"forge.reporting.builder","id":"sampleBuilder","reportBuilder":{"dataSourceRef":"sampleRows","measures":[{"id":"value","key":"value","label":"Value","default":true}],"predicates":[{"id":"number","pinned":true,"paramPath":"options.number","default":7},{"id":"text","pinned":true,"paramPath":"options.text","default":"sample"},{"id":"flag","pinned":true,"paramPath":"options.flag","default":false},{"id":"zero","pinned":true,"paramPath":"options.zero","default":0}],"staticFilters":[{"id":"legacy","paramPath":"filters.legacy","default":"legacy-default"}]}}`),
		ReportDocument:    json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Sample","blocks":[{"id":"metric","kind":"kpiBlock","datasetRef":"primary","valueField":"value"}]}`),
		DataSources:       map[string]json.RawMessage{"sampleRows": json.RawMessage(`{"id":"sampleRows","backend":{"kind":"inline","rows":[{"value":1}]}}`)},
	}
	for _, test := range []struct {
		name     string
		state    string
		request  map[string]interface{}
		expected map[string]interface{}
	}{
		{"omitted", `{}`, nil, map[string]interface{}{"number": float64(7), "text": "sample", "flag": false, "zero": float64(0), "legacy": "legacy-default"}},
		{"partial-saved", `{"scopeParams":{"number":0,"flag":true}}`, nil, map[string]interface{}{"number": float64(0), "text": "sample", "flag": true, "zero": float64(0), "legacy": "legacy-default"}},
		{"saved", `{"scopeParams":{"number":0,"text":"","flag":true,"zero":9,"legacy":null}}`, nil, map[string]interface{}{"number": float64(0), "text": "", "flag": true, "zero": float64(9), "legacy": nil}},
		{"legacy-saved", `{"staticFilters":{"number":2,"text":"saved","flag":false,"zero":0,"legacy":"saved"}}`, nil, map[string]interface{}{"number": float64(2), "text": "saved", "flag": false, "zero": float64(0), "legacy": "saved"}},
		{"invocation", `{"scopeParams":{"number":11,"text":"saved","flag":true,"zero":9}}`, map[string]interface{}{"options": map[string]interface{}{"number": 0, "text": "request", "flag": false, "zero": 0}}, map[string]interface{}{"number": float64(0), "text": "request", "flag": false, "zero": float64(0), "legacy": "legacy-default"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			envelope.State = json.RawMessage(test.state)
			envelope.Dependencies = []registry.ReportDependency{
				{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)},
				{Kind: "report", ID: "report://example/sample", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)},
				{Kind: "datasource", ID: "sampleRows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["sampleRows"])},
			}
			raw, err := json.Marshal(envelope)
			require.NoError(t, err)
			original := string(raw)
			spec, err := LowerWithRequestBase(context.Background(), raw, test.request)
			require.NoError(t, err)
			var result struct {
				Scope struct {
					Params []struct {
						ID    string      `json:"id"`
						Value interface{} `json:"value"`
					} `json:"params"`
				} `json:"scope"`
			}
			require.NoError(t, json.Unmarshal(spec, &result))
			actual := map[string]interface{}{}
			for _, param := range result.Scope.Params {
				actual[param.ID] = param.Value
			}
			require.Equal(t, test.expected, actual)
			require.Equal(t, original, string(raw), "lowering must preserve fingerprinted envelope bytes")
		})
	}
}
