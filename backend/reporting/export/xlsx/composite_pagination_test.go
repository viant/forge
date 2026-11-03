package xlsx

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	"github.com/stretchr/testify/require"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	"github.com/viant/forge/backend/reporting/materializer"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// Independently invented library fixtures exercise the embedded canonical
// lowerer and both native consumers without application metadata.
func TestCompositeHeadingPaginationNativeExports(t *testing.T) {
	for _, kind := range []string{"infoPanelBlock", "tableBlock", "chartBlock"} {
		t.Run(kind, func(t *testing.T) {
			child := map[string]any{"id": "inventory", "kind": kind, "title": "Shelf counts", "datasetRef": "primary"}
			switch kind {
			case "infoPanelBlock":
				delete(child, "datasetRef")
				child["body"] = "A short inventory observation for the shared reading room with additional context about the next review."
			case "tableBlock":
				child["columns"] = []any{map[string]any{"key": "shelf", "label": "Shelf"}, map[string]any{"key": "count", "label": "Count", "kind": "measure"}}
			case "chartBlock":
				child["chartSpec"] = map[string]any{"type": "horizontal_bar", "xField": "shelf", "yFields": []string{"count"}}
				child["chartModel"] = map[string]any{"type": "horizontal_bar", "xAxis": map[string]any{"dataKey": "shelf"}, "series": map[string]any{"values": []any{map[string]any{"value": "count", "label": "Count", "type": "horizontal_bar"}}}}
			}
			blocks := []any{
				map[string]any{"id": "overview", "kind": "sectionBlock", "title": "Library review", "blockIds": []string{"intro", "group"}},
				map[string]any{"id": "intro", "kind": "markdownBlock", "title": "Reading room", "markdown": strings.Repeat("Catalog review.\n\n", 22)},
				map[string]any{"id": "group", "kind": "compositeBlock", "title": "Shelf observations", "layout": "stack", "childBlockIds": []string{"inventory"}}, child,
			}
			spec := map[string]any{"version": 1, "kind": "reportSpec", "title": "Library inventory", "source": map[string]any{"kind": "reportBuilder", "containerId": "library", "stateKey": "library", "dataSourceRef": "primary"}, "scope": map[string]any{"params": []any{}}, "blocks": blocks, "datasets": []any{map[string]any{"id": "primary", "dataSourceRef": "primary", "request": map[string]any{"limit": 100, "offset": 0}}}, "layoutIntent": map[string]any{"blockOrder": []string{"overview", "intro", "group", "inventory"}}}
			raw, err := json.Marshal(spec)
			require.NoError(t, err)
			artifacts, err := materializer.Materialize(t.Context(), raw, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"shelf":"North","count":42},{"shelf":"South","count":28}]}`)})
			require.NoError(t, err)
			printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			require.Len(t, printed.Pages, 2)
			var headingPage, childPage int
			for _, page := range printed.Pages {
				require.NotEmpty(t, page.Elements)
				for _, element := range page.Elements {
					if strings.HasPrefix(element.ID, "group__title") {
						headingPage = page.Number
					}
					if element.ID == "inventory__title_0" {
						childPage = page.Number
					}
					require.LessOrEqual(t, element.Box.Y+element.Box.Height, 724.01, element.ID)
					require.LessOrEqual(t, element.Box.X+element.Box.Width, 576.01, element.ID)
				}
			}
			require.Equal(t, 2, headingPage)
			require.Equal(t, headingPage, childPage)
			rendered, err := reportpdf.Render(printed, reportpdf.Options{})
			require.NoError(t, err)
			require.Empty(t, rendered.Diagnostics)
			reader, err := pdfreader.NewReader(bytes.NewReader(rendered.Bytes), int64(len(rendered.Bytes)))
			require.NoError(t, err)
			require.Equal(t, 2, reader.NumPage())
			pageText, err := reader.Page(2).GetPlainText(nil)
			require.NoError(t, err)
			require.Contains(t, pageText, "Shelf observations")
			require.Contains(t, pageText, "Shelf counts")
			text, err := reader.GetPlainText()
			require.NoError(t, err)
			plain, err := io.ReadAll(text)
			require.NoError(t, err)
			data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
			require.NoError(t, err)
			book, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer book.Close()
			entries := workbookZIP(t, data)
			require.Contains(t, entries["xl/sharedStrings.xml"], "Shelf observations")
			require.Contains(t, entries["xl/sharedStrings.xml"], "Shelf counts")
			hasBreak := false
			for name, content := range entries {
				if strings.HasPrefix(name, "xl/worksheets/") && strings.Contains(content, "rowBreaks") {
					hasBreak = true
				}
			}
			require.True(t, hasBreak, "canonical pages retain workbook page breaks")
			if kind == "infoPanelBlock" {
				compact := func(s string) string { return strings.Join(strings.Fields(s), "") }
				require.Contains(t, compact(string(plain)), compact(child["body"].(string)))
				rows, err := book.GetRows("Library review")
				require.NoError(t, err)
				var cells []string
				for _, row := range rows {
					cells = append(cells, row...)
				}
				require.Contains(t, compact(strings.Join(cells, " ")), compact(child["body"].(string)))
			} else {
				sourceSheet := "Table Shelf counts"
				if kind == "chartBlock" {
					sourceSheet = "Chart Shelf counts"
				}
				rows, err := book.GetRows(sourceSheet)
				require.NoError(t, err)
				var cells []string
				for _, row := range rows {
					cells = append(cells, row...)
				}
				for _, value := range []string{"North", "South", "42", "28"} {
					require.Contains(t, string(plain), value)
					require.Contains(t, cells, value, "complete editable source cells")
				}
			}
		})
	}
}
