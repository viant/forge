package materializer

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestAuthoredZeroBarCategories(t *testing.T) {
	encode := func(value any) json.RawMessage {
		data, err := json.Marshal(value)
		require.NoError(t, err)
		return data
	}
	dimensions := []any{map[string]any{"id": "category", "key": "category", "default": true}}
	measures := []any{map[string]any{"id": "rate", "key": "rate", "default": true, "format": "percentFraction"}}
	for _, kind := range []string{"bar", "horizontal_bar"} {
		t.Run(kind, func(t *testing.T) {
			chart := map[string]any{"type": kind, "xField": "category", "yFields": []string{"rate"}, "showZeroCategories": true}
			envelope := registry.ReportEnvelope{
				SchemaVersion: 1, Format: "forge.authoredReport", BuilderRef: "sampleBuilder",
				BuilderDefinition: encode(map[string]any{"kind": "forge.reporting.builder", "id": "sampleBuilder", "reportBuilder": map[string]any{"dataSourceRef": "sampleRows", "dimensions": dimensions, "measures": measures}}),
				ReportDocument:    encode(map[string]any{"version": 1, "kind": "reportDocument", "id": "sample", "title": "Measurements", "blocks": []any{map[string]any{"id": "measurements", "kind": "chartBlock", "datasetRef": "primary", "chartSpec": chart}}}),
				State:             encode(map[string]any{"viewMode": "chart", "selectedDimensions": []string{"category"}, "selectedMeasures": []string{"rate"}, "chartSpec": chart}),
				DataSources:       map[string]json.RawMessage{"sampleRows": encode(map[string]any{"dataSourceRef": "sampleRows", "kind": "published", "source": map[string]any{"kind": "datly", "uri": "sample"}, "dimensions": dimensions, "measures": measures})},
			}
			envelope.Dependencies = []registry.ReportDependency{
				{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)},
				{Kind: "report", ID: "report://example/sample", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)},
				{Kind: "datasource", ID: "sampleRows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["sampleRows"])},
			}
			lowered, err := Lower(context.Background(), encode(envelope))
			require.NoError(t, err)
			var spec map[string]any
			require.NoError(t, json.Unmarshal(lowered, &spec))
			for _, value := range spec["blocks"].([]any) {
				block := value.(map[string]any)
				if block["kind"] == "chartBlock" {
					require.Equal(t, true, block["chartModel"].(map[string]any)["showZeroCategories"])
				}
			}
			rows := []map[string]any{{"category": "Cedar", "rate": 0}, {"category": "Birch", "rate": 0}, {"category": "Maple", "rate": nil}}
			artifacts, err := Materialize(context.Background(), lowered, map[string]json.RawMessage{"primary": encode(map[string]any{"rows": rows})})
			require.NoError(t, err)
			require.Contains(t, string(artifacts.ReportFill), `"showZeroCategories":true`)
			require.Contains(t, string(artifacts.ReportFill), `"rate":0`)
			require.Contains(t, string(artifacts.ReportFill), `"rate":null`)
			require.Contains(t, string(artifacts.ReportPrint), "0.0%")
		})
	}
}
