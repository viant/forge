package materializer

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"

	reportprint "github.com/viant/forge/backend/reporting/print"
)

// Independently authored neutral labels exercise the complete embedded
// materializer and page layout, rather than merely a growing SVG viewBox.
func TestPrintSeriesLegendsStayInsidePrintablePages(t *testing.T) {
	legendText := regexp.MustCompile(`<text x="([\d.]+)" y="([\d.]+)" font-size="11" fill="#344054">(.*?)</text>`)
	compact := func(value string) string { return strings.Join(strings.Fields(value), "") }
	for _, chartType := range []string{"line", "bar", "area", "horizontal_bar"} {
		for _, size := range []string{"half", "full"} {
			for _, hugeLabel := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/%s/huge=%t", chartType, size, hugeLabel), func(t *testing.T) {
					raw, err := os.ReadFile("testdata/presentation-report.json")
					if err != nil {
						t.Fatal(err)
					}
					var spec map[string]any
					if err = json.Unmarshal(raw, &spec); err != nil {
						t.Fatal(err)
					}
					labels, series := []string{}, []map[string]any{}
					row := map[string]any{"category": "Sample"}
					for index := 0; index < 6; index++ {
						key := fmt.Sprintf("value%d", index)
						label := fmt.Sprintf("Reference collection %d with a deliberately long but complete series label for paper reports", index+1)
						if hugeLabel && index == 0 {
							label = strings.Repeat("Complete reference collection description ", 100)
						}
						labels = append(labels, label)
						series = append(series, map[string]any{"value": key, "label": label, "type": chartType})
						row[key] = index + 1
					}
					title := "Collection comparison"
					if hugeLabel {
						title = "Collection comparison with a complete descriptive heading"
					}
					spec["blocks"] = []any{map[string]any{"id": "chart", "kind": "chartBlock", "title": title, "datasetRef": "primary", "chartModel": map[string]any{"type": chartType, "xAxis": map[string]any{"dataKey": "category"}, "series": map[string]any{"values": series}}}}
					spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"chart"}, "items": []any{map[string]any{"blockId": "chart", "size": size}}}
					raw, err = json.Marshal(spec)
					if err != nil {
						t.Fatal(err)
					}
					payload, err := json.Marshal(map[string]any{"rows": []any{row}})
					if err != nil {
						t.Fatal(err)
					}
					artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
					if err != nil {
						t.Fatal(err)
					}
					var report reportprint.ReportPrint
					if err = json.Unmarshal(artifacts.ReportPrint, &report); err != nil {
						t.Fatal(err)
					}
					g := report.PageGeometry
					bottom := g.Height - g.MarginBottom - g.FooterHeight - 8
					var printed strings.Builder
					for _, page := range report.Pages {
						for _, element := range page.Elements {
							b := element.Box
							if b.Y+b.Height > bottom+0.01 || b.Y < g.MarginTop+g.HeaderHeight || b.X < g.MarginLeft || b.X+b.Width > g.Width-g.MarginRight+0.01 {
								t.Fatalf("page %d element %s exceeds printable bounds: %+v (bottom %v)", page.Number, element.ID, b, bottom)
							}
							for _, match := range legendText.FindAllStringSubmatch(element.SVG, -1) {
								x, _ := strconv.ParseFloat(match[1], 64)
								y, _ := strconv.ParseFloat(match[2], 64)
								text := html.UnescapeString(match[3])
								if x+float64(len([]rune(text)))*11 > b.Width || y > b.Height || b.Y+y > bottom {
									t.Fatalf("legend text exceeds its printable box: %q at %v,%v in %+v", text, x, y, b)
								}
								printed.WriteString(text)
							}
						}
					}
					if compact(printed.String()) != compact(strings.Join(labels, "")) {
						t.Fatal("legend continuation lost or reordered complete series labels")
					}
					if hugeLabel && len(report.Pages) < 3 {
						t.Fatal("huge label should continue across printable pages")
					}
				})
			}
		}
	}
}
