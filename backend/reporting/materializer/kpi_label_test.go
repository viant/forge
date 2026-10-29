package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	"github.com/stretchr/testify/require"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// Independently invented metadata runs through the embedded canonical bundle
// and the actual PDF renderer, rather than a print-model-only approximation.
func TestBundledKpiLabelVisibilityPDF(t *testing.T) {
	for _, label := range []string{"Capacity", "cApAcItY", "Available"} {
		t.Run(label, func(t *testing.T) {
			raw, err := os.ReadFile("testdata/presentation-report.json")
			require.NoError(t, err)
			var spec map[string]any
			require.NoError(t, json.Unmarshal(raw, &spec))
			spec["title"] = "Metric summary"
			spec["blocks"] = []any{map[string]any{
				"id": "metric", "kind": "kpiBlock", "title": "Capacity", "datasetRef": "primary",
				"valueField": "count", "valueLabel": label,
				"sparkline": map[string]any{"datasetRef": "primary", "categoryField": "day", "valueField": "count"},
			}}
			spec["layoutIntent"] = map[string]any{"kind": "single", "resultPanePosition": "bottom", "blockOrder": []string{"metric"}}
			raw, err = json.Marshal(spec)
			require.NoError(t, err)
			artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{
				"primary": json.RawMessage(`{"hasMore":false,"rows":[{"day":"A","count":42},{"day":"B","count":43}]}`),
			})
			require.NoError(t, err)
			require.Contains(t, string(artifacts.ReportFill), `"value":42`)
			require.Contains(t, string(artifacts.ReportPrint), `metric__sparkline`)
			require.Equal(t, label == "Available", strings.Contains(string(artifacts.ReportPrint), `metric__value_label_0`))
			report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			require.NoError(t, err)
			rendered, err := reportpdf.Render(report, reportpdf.Options{})
			require.NoError(t, err)
			require.Empty(t, rendered.Diagnostics)
			reader, err := pdfreader.NewReader(bytes.NewReader(rendered.Bytes), int64(len(rendered.Bytes)))
			require.NoError(t, err)
			text, err := reader.GetPlainText()
			require.NoError(t, err)
			plain, err := io.ReadAll(text)
			require.NoError(t, err)
			require.Equal(t, 1, strings.Count(strings.ToLower(string(plain)), "capacity"))
			require.Equal(t, label == "Available", strings.Contains(string(plain), "AVAILABLE"))
			require.Contains(t, string(plain), "42")
		})
	}
}
