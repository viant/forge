package materializer

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/viant/forge/backend/reporting/registry"
	identity "github.com/viant/forge/backend/resource"
)

func TestAuthoredTableCollapseSurvivesEmbeddedLoweringAndFill(t *testing.T) {
	for _, mode := range []string{"expanded", "collapsed", "omitted"} {
		t.Run(mode, func(t *testing.T) {
			raw, err := os.ReadFile("testdata/authored-envelope.json")
			require.NoError(t, err)
			var envelope registry.ReportEnvelope
			require.NoError(t, json.Unmarshal(raw, &envelope))
			block := map[string]any{"id": "evidence", "kind": "tableBlock", "datasetRef": "primary", "collapsible": true, "columns": []any{map[string]any{"key": "spend", "label": "Value"}}}
			var expected *bool
			if mode != "omitted" {
				value := mode == "collapsed"
				expected = &value
				block["defaultCollapsed"] = value
			}
			envelope.ReportDocument, err = json.Marshal(map[string]any{"version": 1, "kind": "reportDocument", "title": "Rows", "blocks": []any{block}})
			require.NoError(t, err)
			var builder bytes.Buffer
			require.NoError(t, json.Compact(&builder, envelope.BuilderDefinition))
			envelope.BuilderDefinition = append(json.RawMessage(nil), builder.Bytes()...)
			envelope.Dependencies = []registry.ReportDependency{{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)}}
			for id, descriptor := range envelope.DataSources {
				var compact bytes.Buffer
				require.NoError(t, json.Compact(&compact, descriptor))
				envelope.DataSources[id] = append(json.RawMessage(nil), compact.Bytes()...)
				envelope.Dependencies = append(envelope.Dependencies, registry.ReportDependency{Kind: "datasource", ID: id, ContentFingerprint: identity.ContentFingerprint(envelope.DataSources[id])})
			}
			envelope.Dependencies = append(envelope.Dependencies, registry.ReportDependency{Kind: "report", ID: "report://example/rows", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)})
			raw, err = json.Marshal(envelope)
			require.NoError(t, err)
			spec, err := Lower(t.Context(), raw)
			require.NoError(t, err)
			assertEmbeddedTableCollapse(t, spec, expected)
			artifacts, err := Materialize(t.Context(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"spend":7}],"hasMore":false}`)})
			require.NoError(t, err)
			assertEmbeddedTableCollapse(t, artifacts.ReportFill, expected)
			require.True(t, json.Valid(artifacts.ReportPrint))
		})
	}
}

func assertEmbeddedTableCollapse(t *testing.T, raw json.RawMessage, expected *bool) {
	t.Helper()
	var result struct {
		Blocks []struct {
			ID               string `json:"id"`
			DefaultCollapsed *bool  `json:"defaultCollapsed"`
		} `json:"blocks"`
	}
	require.NoError(t, json.Unmarshal(raw, &result))
	for _, block := range result.Blocks {
		if block.ID == "evidence" {
			require.Equal(t, expected, block.DefaultCollapsed)
			return
		}
	}
	t.Fatal("authored table missing from materialized contract")
}
