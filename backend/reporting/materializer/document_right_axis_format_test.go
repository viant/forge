package materializer

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/viant/forge/backend/reporting/registry"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	identity "github.com/viant/forge/backend/resource"
)

func TestAuthoredDocumentRightAxisMeasureFormat(t *testing.T) {
	encode := func(v any) json.RawMessage { data, err := json.Marshal(v); require.NoError(t, err); return data }
	dimensions := []any{map[string]any{"id": "day", "key": "day", "label": "Day", "chartAxis": true}}
	measures := []any{map[string]any{"id": "volume", "key": "volume", "label": "Volume", "format": "number"}, map[string]any{"id": "rate", "key": "rate", "label": "Rate", "format": "percentFraction2"}}
	for _, document := range []bool{true, false} {
		name := "legacy-omitted-appearance"
		if document {
			name = "document"
		}
		t.Run(name, func(t *testing.T) {
			chart := map[string]any{"type": "bar", "xField": "day", "yFields": []string{"volume", "rate"}, "seriesOptions": map[string]any{"volume": map[string]any{"type": "bar", "axis": "left"}, "rate": map[string]any{"type": "line", "axis": "right"}}}
			if document {
				chart["appearance"] = "document"
			}
			envelope := registry.ReportEnvelope{SchemaVersion: 1, Format: "forge.authoredReport", BuilderRef: "metricsBuilder",
				BuilderDefinition: encode(map[string]any{"id": "metricsBuilder", "kind": "forge.reporting.builder", "reportBuilder": map[string]any{"dataSourceRef": "rows", "dimensions": dimensions, "measures": measures, "result": map[string]any{"defaultMode": "table", "supportedChartTypes": []string{"bar"}}}}),
				ReportDocument:    encode(map[string]any{"version": 1, "kind": "reportDocument", "title": "Typed metrics", "blocks": []any{map[string]any{"id": "trend", "kind": "chartBlock", "datasetRef": "primary", "chartSpec": chart}}}),
				State:             encode(map[string]any{"selectedDimensions": []string{"day"}, "selectedMeasures": []string{"volume", "rate"}}),
				DataSources:       map[string]json.RawMessage{"rows": encode(map[string]any{"dataSourceRef": "rows", "kind": "published", "source": map[string]any{"kind": "datly", "uri": "rows"}, "dimensions": dimensions, "measures": measures})},
			}
			envelope.Dependencies = []registry.ReportDependency{{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)}, {Kind: "report", ID: "report://example/metrics", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)}, {Kind: "datasource", ID: "rows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["rows"])}}
			lowered, err := Lower(context.Background(), encode(envelope))
			require.NoError(t, err)
			spec, err := reportspec.DecodeJSON(lowered)
			require.NoError(t, err)
			found := false
			for _, block := range spec.Blocks {
				if block.ID != "trend" {
					continue
				}
				found = true
				if document {
					axes, ok := block.ChartModel["axes"].(map[string]any)
					require.True(t, ok, "typed axis format must survive bundled lowering")
					right, ok := axes["right"].(map[string]any)
					require.True(t, ok)
					require.Equal(t, "percentFraction2", right["format"])
				} else {
					require.Nil(t, block.ChartModel["axes"])
				}
			}
			require.True(t, found)
			rows := []map[string]any{{"day": "A", "volume": 100, "rate": .25}, {"day": "B", "volume": 120, "rate": nil}, {"day": "C", "volume": 80, "rate": 0}}
			artifacts, err := Materialize(context.Background(), lowered, map[string]json.RawMessage{"primary": encode(map[string]any{"rows": rows})})
			require.NoError(t, err)
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			require.NoError(t, err)
			require.JSONEq(t, string(encode(rows)), string(encode(fill.Datasets[0].Rows)))
			print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			var svg strings.Builder
			for _, page := range print.Pages {
				for _, element := range page.Elements {
					svg.WriteString(element.SVG)
				}
			}
			require.Contains(t, svg.String(), "25.00%")
		})
	}
}
