package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestBundledKpiSparklineRetainsAuthorizedDatasetAndPrint(t *testing.T) {
	raw, err := os.ReadFile("testdata/authored-envelope.json")
	require.NoError(t, err)
	var envelope registry.ReportEnvelope
	require.NoError(t, json.Unmarshal(raw, &envelope))
	envelope.BuilderDefinition = json.RawMessage(`{"kind":"forge.reporting.builder","id":"sampleBuilder","reportBuilder":{"dataSourceRef":"sampleRows","measures":[{"id":"spend","key":"spend","paramPath":"measures.spend","default":true}],"dataSources":[{"id":"daily","dataSourceRef":"sampleRows","dimensions":[{"id":"day","key":"day","paramPath":"dimensions.day"}],"measures":[{"id":"spend","key":"spend","paramPath":"measures.spend"}],"request":{"dimensions":{},"measures":{},"filters":{"from":"2026-10-01","to":"2026-10-04"}}}]}}`)
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Daily trend","blocks":[{"id":"current","kind":"kpiBlock","datasetRef":"primary","valueField":"spend","sparkline":{"datasetRef":"daily","categoryField":"day","valueField":"spend","periodStartPath":"filters.from","periodEndPath":"filters.to"}}]}`)
	envelope.State = json.RawMessage(`{"selectedMeasures":["spend"]}`)
	for id, descriptor := range envelope.DataSources {
		var compact bytes.Buffer
		require.NoError(t, json.Compact(&compact, descriptor))
		envelope.DataSources[id] = json.RawMessage(compact.Bytes())
	}
	envelope.Dependencies = []registry.ReportDependency{{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)}, {Kind: "datasource", ID: "sampleRows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["sampleRows"])}, {Kind: "report", ID: "report://example/trend", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)}}
	raw, err = json.Marshal(envelope)
	require.NoError(t, err)
	spec, err := Lower(context.Background(), raw)
	require.NoError(t, err)
	require.Contains(t, string(spec), `"daily"`)
	require.Contains(t, string(spec), `"day":true`)
	artifacts, err := Materialize(context.Background(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"spend":2}]}`), "daily": json.RawMessage(`{"rows":[{"day":"2026-10-01","spend":2},{"day":"2026-10-03","spend":0}]}`)})
	require.NoError(t, err)
	var fill struct {
		Blocks []struct {
			ID      string `json:"id"`
			Content struct {
				Sparkline struct {
					Values []*float64 `json:"values"`
				} `json:"sparkline"`
			} `json:"content"`
		} `json:"blocks"`
	}
	require.NoError(t, json.Unmarshal(artifacts.ReportFill, &fill))
	found := false
	for _, block := range fill.Blocks {
		if block.ID != "current" {
			continue
		}
		found = true
		values := block.Content.Sparkline.Values
		require.Len(t, values, 4)
		require.Equal(t, float64(2), *values[0])
		require.Nil(t, values[1])
		require.Equal(t, float64(0), *values[2])
		require.Nil(t, values[3])
	}
	require.True(t, found)
	require.Contains(t, string(artifacts.ReportPrint), "current__sparkline")
}
