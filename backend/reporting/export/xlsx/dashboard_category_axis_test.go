package xlsx

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

func TestDashboardNativeCategoryAxisLabelsStayOutsideSignedBars(t *testing.T) {
	for _, scenario := range []struct {
		name       string
		kind       string
		values     []any
		horizontal bool
	}{
		{"horizontal-mixed", "horizontal_bar", []any{-2, 2, 0, nil}, true},
		{"horizontal-negative", "horizontal_bar", []any{-2, -4, 0, nil}, true},
		{"horizontal-positive", "horizontal_bar", []any{2, 4, 0, nil}, true},
		{"funnel-mixed", "funnel_bar", []any{-2, 2, 0, nil}, true},
		{"column-mixed", "bar", []any{-2, 2, 0, nil}, false},
		{"line-mixed", "line", []any{-2, 2, 0, nil}, false},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			labels := []string{
				"Northern botanical collection with complete specimen descriptions",
				"Southern botanical collection with complete specimen descriptions",
				"Eastern botanical collection with complete specimen descriptions",
				"Western botanical collection with complete specimen descriptions",
			}
			rows := make([]map[string]any, len(labels))
			for index, label := range labels {
				rows[index] = map[string]any{"collection": label, "change": scenario.values[index]}
			}
			payload, err := json.Marshal(map[string]any{"rows": rows})
			require.NoError(t, err)
			artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
				spec["title"] = "Botanical collection changes"
				spec["blocks"] = []any{map[string]any{
					"id": "changes", "kind": "chartBlock", "title": "Collection changes", "datasetRef": "primary",
					"chartSpec": map[string]any{"type": scenario.kind, "xField": "collection", "yFields": []string{"change"}},
					"chartModel": map[string]any{
						"type": scenario.kind, "preserveCategoryOrder": true,
						"xAxis":  map[string]any{"dataKey": "collection", "label": "Collection"},
						"yAxis":  map[string]any{"label": "Specimen change", "format": "number"},
						"series": map[string]any{"values": []any{map[string]any{"value": "change", "label": "Specimen change", "type": scenario.kind}}},
					},
				}}
				spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"changes"}}
				inputs["primary"] = payload
			})
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			require.NoError(t, err)
			for _, route := range []string{"dashboard", "print"} {
				t.Run(route, func(t *testing.T) {
					var workbook []byte
					if route == "print" {
						workbook, err = RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
					} else {
						workbook, err = RenderDashboard(fill)
					}
					require.NoError(t, err)
					if directory := os.Getenv("FORGE_CATEGORY_AXIS_ARTIFACT_DIR"); directory != "" {
						require.NoError(t, os.MkdirAll(directory, 0700))
						require.NoError(t, os.WriteFile(filepath.Join(directory, scenario.name+"-"+route+".xlsx"), workbook, 0600))
					}
					book, err := excelize.OpenReader(bytes.NewReader(workbook))
					require.NoError(t, err)
					defer book.Close()
					entries := workbookZIP(t, workbook)
					for index, label := range labels {
						require.Equal(t, label, mustCellValue(t, book, "Chart Collection changes", fmt.Sprintf("A%d", index+5)))
						require.Contains(t, entries["xl/charts/chart1.xml"], label)
					}
					for index, value := range scenario.values {
						expected := ""
						if value != nil {
							expected = fmt.Sprint(value)
						}
						require.Equal(t, expected, mustCellValue(t, book, "Chart Collection changes", fmt.Sprintf("B%d", index+5)))
					}
					var axes struct {
						Plot struct {
							Category struct {
								TickLabels struct {
									Position string `xml:"val,attr"`
								} `xml:"tickLblPos"`
								Orientation struct {
									Direction string `xml:"val,attr"`
								} `xml:"scaling>orientation"`
							} `xml:"catAx"`
							Value struct {
								Crosses struct {
									At string `xml:"val,attr"`
								} `xml:"crosses"`
							} `xml:"valAx"`
						} `xml:"chart>plotArea"`
					}
					require.NoError(t, xml.Unmarshal([]byte(entries["xl/charts/chart1.xml"]), &axes))
					if scenario.horizontal {
						for name := range entries {
							require.False(t, strings.HasPrefix(name, "xl/media/"), "supported horizontal bars remain native and editable")
						}
					}
					require.Equal(t, "autoZero", axes.Plot.Value.Crosses.At)
					if scenario.horizontal {
						require.Equal(t, "maxMin", axes.Plot.Category.Orientation.Direction)
						require.Equal(t, "low", axes.Plot.Category.TickLabels.Position, "category labels must sit outside the signed plotting region")
					} else {
						require.Equal(t, "nextTo", axes.Plot.Category.TickLabels.Position, "vertical and line chart defaults are unchanged")
					}
				})
			}
		})
	}
}
