package materializer

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/viant/forge/backend/reporting/registry"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	identity "github.com/viant/forge/backend/resource"
)

func TestAuthoredChartAxisLabels(t *testing.T) {
	var fixture struct {
		Config    map[string]any `json:"config"`
		ChartSpec map[string]any `json:"chartSpec"`
		Cases     []struct {
			ID   string           `json:"id"`
			Rows []map[string]any `json:"rows"`
		} `json:"cases"`
	}
	raw, err := os.ReadFile("../../../doc/examples/chart-axis-labels.json")
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &fixture))
	encode := func(value any) json.RawMessage {
		data, err := json.Marshal(value)
		require.NoError(t, err)
		return data
	}
	for _, chartType := range []string{"bar", "horizontal_bar"} {
		for _, source := range []string{"builder", "document"} {
			t.Run(chartType+"/"+source, func(t *testing.T) {
				chartSpec := make(map[string]any)
				for key, value := range fixture.ChartSpec {
					chartSpec[key] = value
				}
				chartSpec["type"] = chartType
				blocks := []any{}
				if source == "document" {
					blocks = append(blocks, map[string]any{"id": "changes", "kind": "chartBlock", "datasetRef": "primary", "chartSpec": chartSpec})
				}
				envelope := registry.ReportEnvelope{
					SchemaVersion: 1, Format: "forge.authoredReport", BuilderRef: "inventoryBuilder",
					BuilderDefinition: encode(map[string]any{"kind": "forge.reporting.builder", "id": "inventoryBuilder", "reportBuilder": fixture.Config}),
					ReportDocument:    encode(map[string]any{"version": 1, "kind": "reportDocument", "id": "inventory", "title": "Inventory changes", "blocks": blocks}),
					State:             encode(map[string]any{"viewMode": "chart", "selectedDimensions": []string{"item"}, "selectedMeasures": []string{"netChange"}, "chartSpec": chartSpec}),
					DataSources: map[string]json.RawMessage{"inventoryRows": encode(map[string]any{
						"dataSourceRef": "inventoryRows", "kind": "published", "source": map[string]any{"kind": "datly", "uri": "inventory"},
						"dimensions": fixture.Config["dimensions"], "measures": fixture.Config["measures"],
					})},
				}
				envelope.Dependencies = []registry.ReportDependency{
					{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)},
					{Kind: "report", ID: "report://example/inventory", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)},
					{Kind: "datasource", ID: "inventoryRows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["inventoryRows"])},
				}
				lowered, err := Lower(context.Background(), encode(envelope))
				require.NoError(t, err)
				spec, err := reportspec.DecodeJSON(lowered)
				require.NoError(t, err)
				chartCount := 0
				for _, block := range spec.Blocks {
					if block.Kind != "chartBlock" {
						continue
					}
					chartCount++
					require.Equal(t, chartSpec["xAxis"], block.ChartSpec["xAxis"])
					require.Equal(t, chartSpec["yAxis"], block.ChartSpec["yAxis"])
					require.Equal(t, "Item", block.ChartModel["xAxis"].(map[string]any)["label"])
					require.Equal(t, map[string]any{"format": "number", "label": "Net quantity change"}, block.ChartModel["yAxis"])
				}
				expectedCharts := 1
				if source == "document" {
					expectedCharts = 2
				}
				require.Equal(t, expectedCharts, chartCount)
				roundTrip, err := reportspec.DecodeJSON(encode(spec))
				require.NoError(t, err)
				require.Equal(t, spec, roundTrip)
				for _, example := range fixture.Cases {
					t.Run(example.ID, func(t *testing.T) {
						artifacts, err := Materialize(context.Background(), encode(roundTrip), map[string]json.RawMessage{"primary": encode(map[string]any{"rows": example.Rows})})
						require.NoError(t, err)
						fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
						require.NoError(t, err)
						require.Equal(t, example.Rows, fill.Datasets[0].Rows)
						for _, block := range fill.Blocks {
							if block.Kind != "chartBlock" {
								continue
							}
							require.Equal(t, "Net quantity change", block.ChartContent.ChartModel["yAxis"].(map[string]any)["label"])
							require.Equal(t, chartSpec["yAxis"], block.ChartContent.ChartSpec["yAxis"])
						}
						print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
						require.NoError(t, err)
						require.NotEmpty(t, print.Pages)
						workbook, err := reportxlsx.RenderDashboard(fill)
						require.NoError(t, err)
						archive, err := zip.NewReader(bytes.NewReader(workbook), int64(len(workbook)))
						require.NoError(t, err)
						charts := 0
						for _, entry := range archive.File {
							if !strings.HasPrefix(entry.Name, "xl/charts/chart") || !strings.HasSuffix(entry.Name, ".xml") {
								continue
							}
							stream, err := entry.Open()
							require.NoError(t, err)
							content, err := io.ReadAll(stream)
							require.NoError(t, err)
							require.NoError(t, stream.Close())
							type chartAxis struct {
								Title struct {
									XML string `xml:",innerxml"`
								} `xml:"title"`
							}
							var axes struct {
								Category []chartAxis `xml:"chart>plotArea>catAx"`
								Value    []chartAxis `xml:"chart>plotArea>valAx"`
							}
							require.NoError(t, xml.Unmarshal(content, &axes))
							require.Len(t, axes.Category, 1)
							require.Len(t, axes.Value, 1)
							require.Contains(t, axes.Category[0].Title.XML, ">Item<")
							require.Contains(t, axes.Value[0].Title.XML, ">Net quantity change<")
							charts++
						}
						require.Equal(t, chartCount, charts)
					})
				}
			})
		}
	}
}

func TestHorizontalCivilDateCategoryDisplay(t *testing.T) {
	encode := func(value any) json.RawMessage {
		data, err := json.Marshal(value)
		require.NoError(t, err)
		return data
	}
	const rawDay = "2026-06-13T00:00:00Z"
	for _, declared := range []bool{false, true} {
		name := "raw"
		if declared {
			name = "civil"
		}
		t.Run(name, func(t *testing.T) {
			dimension := map[string]any{"id": "day", "key": "day", "label": "Day", "default": true, "chartAxis": true}
			if declared {
				dimension["tickFormat"], dimension["valueMode"] = "MMM d", "civil"
			}
			config := map[string]any{
				"title": "Dated amounts", "dataSourceRef": "datedRows",
				"dimensions": []any{dimension},
				"measures":   []any{map[string]any{"id": "amount", "key": "amount", "label": "Amount", "format": "number", "default": true}},
				"result":     map[string]any{"defaultMode": "chart", "chartCreationMode": "explicit", "supportedChartTypes": []string{"horizontal_bar"}},
			}
			chart := map[string]any{"type": "horizontal_bar", "xField": "day", "yFields": []string{"amount"}}
			envelope := registry.ReportEnvelope{
				SchemaVersion: 1, Format: "forge.authoredReport", BuilderRef: "datedBuilder",
				BuilderDefinition: encode(map[string]any{"kind": "forge.reporting.builder", "id": "datedBuilder", "reportBuilder": config}),
				ReportDocument:    encode(map[string]any{"version": 1, "kind": "reportDocument", "id": "dated", "title": "Dated amounts", "blocks": []any{}}),
				State:             encode(map[string]any{"viewMode": "chart", "selectedDimensions": []string{"day"}, "selectedMeasures": []string{"amount"}, "chartSpec": chart}),
				DataSources: map[string]json.RawMessage{"datedRows": encode(map[string]any{
					"dataSourceRef": "datedRows", "kind": "published", "source": map[string]any{"kind": "datly", "uri": "dated"},
					"dimensions": config["dimensions"], "measures": config["measures"],
				})},
			}
			envelope.Dependencies = []registry.ReportDependency{
				{Kind: "builder", ID: envelope.BuilderRef, ContentFingerprint: identity.ContentFingerprint(envelope.BuilderDefinition)},
				{Kind: "report", ID: "report://example/dated", ContentFingerprint: identity.ContentFingerprint(envelope.ReportDocument)},
				{Kind: "datasource", ID: "datedRows", ContentFingerprint: identity.ContentFingerprint(envelope.DataSources["datedRows"])},
			}
			lowered, err := Lower(context.Background(), encode(envelope))
			require.NoError(t, err)
			artifacts, err := Materialize(context.Background(), lowered, map[string]json.RawMessage{
				"primary": encode(map[string]any{"rows": []any{map[string]any{"day": rawDay, "amount": 9}}}),
			})
			require.NoError(t, err)
			require.Contains(t, string(artifacts.ReportFill), rawDay)
			print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			var svg strings.Builder
			for _, page := range print.Pages {
				for _, element := range page.Elements {
					svg.WriteString(element.SVG)
				}
			}
			if declared {
				require.Contains(t, svg.String(), "Jun 13")
				require.NotContains(t, svg.String(), "T00:00:00Z")
			} else {
				require.Contains(t, svg.String(), rawDay)
			}
		})
	}
}
