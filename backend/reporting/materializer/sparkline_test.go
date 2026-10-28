package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportspec "github.com/viant/forge/backend/reporting/spec"
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
	envelope.ReportDocument = json.RawMessage(`{"version":1,"kind":"reportDocument","title":"Daily trend","blocks":[{"id":"current","kind":"kpiBlock","datasetRef":"primary","valueField":"spend","sparkline":{"datasetRef":"daily","categoryField":"day","valueField":"spend","periodStartPath":"filters.from","periodEndPath":"filters.to","valueColor":{"field":"spend","colors":["#000000","#ffffff"],"domain":{"mode":"extent"}}}}]}`)
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
	var validationSpec map[string]any
	require.NoError(t, json.Unmarshal(spec, &validationSpec))
	for _, item := range validationSpec["datasets"].([]any) {
		request := item.(map[string]any)["request"].(map[string]any)
		request["limit"] = 100
		request["offset"] = 0
	}
	validationBytes, err := json.Marshal(validationSpec)
	require.NoError(t, err)
	_, badSpecErr := reportspec.DecodeJSON(bytes.Replace(validationBytes, []byte(`"field":"spend"`), []byte(`"field":"other"`), 1))
	require.ErrorContains(t, badSpecErr, "plotted measure")
	spec = validationBytes
	require.Contains(t, string(spec), `"daily"`)
	require.Contains(t, string(spec), `"day":true`)
	artifacts, err := Materialize(context.Background(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"spend":2}]}`), "daily": json.RawMessage(`{"hasMore":false,"rows":[{"day":"2026-10-01","spend":2},{"day":"2026-10-03","spend":0}]}`)})
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
	_, incompleteErr := Materialize(context.Background(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"spend":2}]}`), "daily": json.RawMessage(`{"rows":[{"day":"2026-10-01","spend":2}]}`)})
	require.ErrorContains(t, incompleteErr, "explicitly complete")
	require.Contains(t, string(artifacts.ReportFill), `"valueColor"`)
	require.Contains(t, string(artifacts.ReportPrint), "#ffffff")
	_, badFillErr := reportfill.DecodeJSON(bytes.Replace(artifacts.ReportFill, []byte(`"opacity":1`), []byte(`"opacity":2`), 1))
	require.ErrorContains(t, badFillErr, "opacity")

	// Completeness belongs to the declared dependency even without value colors.
	for _, item := range validationSpec["blocks"].([]any) {
		block := item.(map[string]any)
		if block["id"] != "current" {
			continue
		}
		delete(block["sparkline"].(map[string]any), "valueColor")
		block["runtime"] = map[string]any{"requireCompleteDataset": true}
	}
	plainSpec, err := json.Marshal(validationSpec)
	require.NoError(t, err)
	complete := map[string]json.RawMessage{"primary": json.RawMessage(`{"hasMore":false,"rows":[{"spend":2}]}`), "daily": json.RawMessage(`{"hasMore":false,"rows":[{"day":"2026-10-01","spend":2}]}`)}
	_, err = Materialize(context.Background(), plainSpec, complete)
	require.NoError(t, err)
	complete["daily"] = json.RawMessage(`{"hasMore":true,"rows":[{"day":"2026-10-01","spend":2}]}`)
	_, err = Materialize(context.Background(), plainSpec, complete)
	require.ErrorContains(t, err, "complete dataset input for 'daily'")
}
