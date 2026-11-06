package xlsx

import (
	"bytes"
	"encoding/json"
	"fmt"
	pdfreader "github.com/ledongthuc/pdf"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// The same independent neutral example exercises native materialization and
// both canonical visual exporters, without rounding the source worksheet.
func TestNumericToneCanonicalExports(t *testing.T) {
	example, err := os.ReadFile("../../../../doc/examples/colored-numeric-tone.json")
	require.NoError(t, err)
	var fixture struct {
		Column map[string]any   `json:"column"`
		Rows   []map[string]any `json:"rows"`
	}
	require.NoError(t, json.Unmarshal(example, &fixture))
	for _, sample := range []struct {
		name                                string
		row                                 map[string]any
		label, tone, color, background, raw string
		override                            bool
	}{
		{"danger", fixture.Rows[0], "123.46", "danger", "#b42318", "#fff1f0", "123.456", false},
		{"success", fixture.Rows[1], "123.46", "success", "#027a48", "#ecfdf3", "123.456", false},
		{"missing", map[string]any{"measurement": 123.456}, "123.46", "", "", "", "123.456", false},
		{"unmatched", map[string]any{"measurement": 123.456, "status": "other"}, "123.46", "", "", "", "123.456", false},
		{"null status", map[string]any{"measurement": 123.456, "status": nil}, "123.46", "", "", "", "123.456", false},
		{"null measurement", map[string]any{"measurement": nil, "status": "good"}, "-", "success", "#027a48", "#ecfdf3", "", false},
		{"blank measurement", map[string]any{"measurement": "", "status": "good"}, "", "", "", "", "", false},
		{"whitespace measurement", map[string]any{"measurement": "   ", "status": "good"}, "   ", "", "", "", "   ", false},
		{"blank with label", map[string]any{"measurement": "", "status": "good"}, "Reviewed", "success", "#027a48", "#ecfdf3", "", true},
		{"whitespace with label", map[string]any{"measurement": "   ", "status": "good"}, "Reviewed", "success", "#027a48", "#ecfdf3", "   ", true},
		{"explicit label", fixture.Rows[1], "Reviewed", "success", "#027a48", "#ecfdf3", "123.456", true},
	} {
		t.Run(sample.name, func(t *testing.T) {
			columnJSON, err := json.Marshal(fixture.Column)
			require.NoError(t, err)
			var column map[string]any
			require.NoError(t, json.Unmarshal(columnJSON, &column))
			if sample.override {
				column["cellVisual"].(map[string]any)["rules"].([]any)[1].(map[string]any)["label"] = "Reviewed"
			}
			artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
				spec["blocks"] = []any{map[string]any{"id": "details", "kind": "tableBlock", "title": "Measurements", "datasetRef": "primary", "columns": []any{column}}}
				spec["layoutIntent"] = map[string]any{"kind": "single", "resultPanePosition": "right", "blockOrder": []string{"details"}, "items": []any{map[string]any{"blockId": "details"}}}
				data, err := json.Marshal(map[string]any{"rows": []any{sample.row}, "hasMore": false})
				require.NoError(t, err)
				inputs["primary"] = data
			})
			print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			var tone *reportprint.Element
			for _, page := range print.Pages {
				for _, element := range page.Elements {
					if element.Kind == "tableCellTone" {
						copy := element
						tone = &copy
					}
				}
			}
			if sample.tone == "" {
				require.Nil(t, tone)
			} else {
				require.NotNil(t, tone)
				require.Equal(t, sample.label, tone.Label)
				require.Equal(t, sample.tone, tone.Tone)
				require.Equal(t, sample.color, tone.TextColor)
				require.Equal(t, sample.background, tone.BackgroundColor)
			}
			pdf, err := reportpdf.Render(print, reportpdf.Options{})
			require.NoError(t, err)
			require.Empty(t, pdf.Diagnostics)
			// The production PDF writer emits uncompressed content, including exact
			// text and RGB paint commands selected from the canonical tone element.
			reader, err := pdfreader.NewReader(bytes.NewReader(pdf.Bytes), int64(len(pdf.Bytes)))
			require.NoError(t, err)
			plain, err := reader.GetPlainText()
			require.NoError(t, err)
			text, err := io.ReadAll(plain)
			require.NoError(t, err)
			if strings.TrimSpace(sample.label) != "" {
				require.Contains(t, string(text), sample.label)
			}
			if tone != nil {
				for _, color := range []string{sample.color, sample.background} {
					var r, g, b int
					_, err = fmt.Sscanf(color, "#%02x%02x%02x", &r, &g, &b)
					require.NoError(t, err)
					require.Contains(t, string(pdf.Bytes), fmt.Sprintf("%.3f %.3f %.3f rg", float64(r)/255, float64(g)/255, float64(b)/255))
				}
			}
			data, err := RenderDatasourceDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
			require.NoError(t, err)
			book, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer book.Close()
			require.Equal(t, sample.raw, rawCell(t, book, "Table Measurements", "A5"))
			if sample.raw == "123.456" {
				require.Equal(t, "123.46", mustCellValue(t, book, "Table Measurements", "A5"))
			}
			entries := workbookZIP(t, data)
			var drawings strings.Builder
			for path, entry := range entries {
				if strings.HasPrefix(path, "xl/drawings/") || strings.HasSuffix(path, ".svg") {
					drawings.WriteString(entry)
				}
			}
			if tone != nil {
				require.Contains(t, drawings.String(), sample.label)
			}
			if tone != nil {
				require.Contains(t, drawings.String(), strings.ToUpper(strings.TrimPrefix(sample.color, "#")))
				require.Contains(t, drawings.String(), strings.ToUpper(strings.TrimPrefix(sample.background, "#")))
			}
		})
	}
}
