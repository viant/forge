package xlsx

import (
	"bytes"
	"encoding/json"
	pdfreader "github.com/ledongthuc/pdf"
	"github.com/stretchr/testify/require"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
	"io"
	"os"
	"strings"
	"testing"
)

// Independent synthetic device counts and checks per device; exercises real Goja fill, PDF and XLSX.
func TestTwoSetOverlapCanonicalExports(t *testing.T) {
	raw, err := os.ReadFile("../../../../doc/examples/two-set-overlap.json")
	require.NoError(t, err)
	var fixture map[string]any
	require.NoError(t, json.Unmarshal(raw, &fixture))
	for _, frequency := range []bool{false, true} {
		t.Run(map[bool]string{false: "counts", true: "frequency"}[frequency], func(t *testing.T) {
			chartSpec := fixture["chartSpec"].(map[string]any)
			rows := fixture["rows"]
			if frequency {
				chartSpec = fixture["frequencyChartSpec"].(map[string]any)
				rows = fixture["frequencyRows"]
			}
			chart := map[string]any{"type": "two-set-overlap", "twoSetOverlap": chartSpec["twoSetOverlap"], "xAxis": map[string]any{"dataKey": chartSpec["xField"]}, "series": map[string]any{"values": []any{map[string]any{"value": chartSpec["xField"], "label": "Value", "type": "bar"}}}}
			artifacts := printExample(t, func(spec map[string]any, inputs map[string]json.RawMessage) {
				spec["blocks"] = []any{map[string]any{"id": "overlap", "kind": "chartBlock", "title": "Device monitoring", "datasetRef": "primary", "chartSpec": chartSpec, "chartModel": chart}}
				spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"overlap"}}
				payload, e := json.Marshal(map[string]any{"rows": rows})
				require.NoError(t, e)
				inputs["primary"] = payload
			})
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			require.NoError(t, err)
			require.NotNil(t, fill)
			print, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			pdf, err := reportpdf.Render(print, reportpdf.Options{})
			require.NoError(t, err)
			require.Empty(t, pdf.Diagnostics)
			reader, err := pdfreader.NewReader(bytes.NewReader(pdf.Bytes), int64(len(pdf.Bytes)))
			require.NoError(t, err)
			plain, err := reader.GetPlainText()
			require.NoError(t, err)
			text, err := io.ReadAll(plain)
			require.NoError(t, err)
			for _, label := range []string{"Monitoring A only", "Both", "Monitoring B only", "area does not encode quantity"} {
				require.Contains(t, strings.Join(strings.Fields(string(text)), " "), label)
			}
			expected := "1,240"
			if frequency {
				expected = "4.12 checks per device"
			}
			require.Contains(t, strings.Join(strings.Fields(string(text)), " "), expected)
			data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
			require.NoError(t, err)
			book, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer book.Close()
			entries := workbookZIP(t, data)
			svgs := 0
			for name, content := range entries {
				if strings.HasSuffix(name, ".svg") {
					svgs++
					require.Contains(t, content, "<circle")
					for _, part := range strings.Fields(expected) {
						require.Contains(t, content, part)
					}
				}
			}
			require.Greater(t, svgs, 0)
			all := ""
			for _, sheet := range book.GetSheetList() {
				rows, e := book.GetRows(sheet)
				require.NoError(t, e)
				for _, row := range rows {
					all += strings.Join(row, " ") + "\n"
				}
			}
			if frequency {
				require.Contains(t, all, "checksBoth")
				require.Contains(t, all, "4.12")
			} else {
				require.Contains(t, all, "monitoringAOnlyPercent")
				require.Contains(t, all, "41.3")
				require.Contains(t, all, "1240")
			}
		})
	}
}
