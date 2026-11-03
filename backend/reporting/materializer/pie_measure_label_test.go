package materializer

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestAuthoredPieMeasureTooltipLabel(t *testing.T) {
	encode := func(value any) json.RawMessage {
		data, err := json.Marshal(value)
		require.NoError(t, err)
		return data
	}
	for _, kind := range []string{"pie", "donut"} {
		t.Run(kind, func(t *testing.T) {
			// Independently authored equipment readings, with a label different
			// from the storage key so dropping metadata cannot pass this test.
			dimensions := []any{map[string]any{"id": "equipment", "key": "equipment", "label": "Equipment", "default": true}}
			measures := []any{map[string]any{"id": "amount", "key": "amount", "label": "Reserved capacity", "default": true}}
			chart := map[string]any{"type": kind, "appearance": "document", "xField": "equipment", "yFields": []string{"amount"}, "tooltip": map[string]any{"fields": []any{map[string]any{"field": "amount", "label": "Reading", "format": "number2"}}}}
			envelope := registry.ReportEnvelope{
				SchemaVersion: 1, Format: "forge.authoredReport", BuilderRef: "capacityBuilder",
				BuilderDefinition: encode(map[string]any{"kind": "forge.reporting.builder", "id": "capacityBuilder", "reportBuilder": map[string]any{"dataSourceRef": "readings", "dimensions": dimensions, "measures": measures, "result": map[string]any{"defaultMode": "chart", "chartCreationMode": "explicit", "supportedChartTypes": []string{kind}}}}),
				ReportDocument:    encode(map[string]any{"version": 1, "kind": "reportDocument", "id": "capacity", "title": "Capacity", "blocks": []any{map[string]any{"id": "capacityChart", "kind": "chartBlock", "datasetRef": "primary", "chartSpec": chart}}}),
				State:             encode(map[string]any{"viewMode": "chart", "selectedDimensions": []string{"equipment"}, "selectedMeasures": []string{"amount"}, "chartSpec": chart}),
				DataSources:       map[string]json.RawMessage{"readings": encode(map[string]any{"dataSourceRef": "readings", "kind": "published", "source": map[string]any{"kind": "datly", "uri": "readings"}, "dimensions": dimensions, "measures": measures})},
			}
			envelope.Dependencies = []registry.ReportDependency{
				{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)},
				{Kind: "report", ID: "report://example/capacity", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)},
				{Kind: "datasource", ID: "readings", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["readings"])},
			}
			spec, err := Lower(context.Background(), encode(envelope))
			require.NoError(t, err)
			artifacts, err := Materialize(context.Background(), spec, map[string]json.RawMessage{"primary": encode(map[string]any{"rows": []any{map[string]any{"equipment": "Equipment A", "amount": 12.25}}})})
			require.NoError(t, err)
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			require.NoError(t, err)
			charts := 0
			for _, block := range fill.Blocks {
				if block.Kind != "chartBlock" {
					continue
				}
				charts++
				series := block.ChartContent.ChartModel["series"].(map[string]any)["values"].([]any)[0].(map[string]any)
				require.NotEmpty(t, series["color"])
				require.Equal(t, kind, series["type"])
				require.Len(t, block.ChartContent.ResolvedChart.TooltipEntries, 1)
				require.Equal(t, "Reserved capacity", block.ChartContent.ResolvedChart.TooltipEntries[0].SeriesLabel)
			}
			require.Equal(t, 2, charts, "builder and authored document charts both retain labels")
		})
	}
}
