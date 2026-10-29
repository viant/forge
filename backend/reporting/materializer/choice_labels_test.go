package materializer

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

func TestTypedChoiceLabelsReachNativePrintAndPDF(t *testing.T) {
	for _, tc := range []struct {
		value    string
		multiple bool
		want     string
	}{
		{`1`, false, "Mode: Numeric one"},
		{`"1"`, false, "Mode: Text one"},
		{`["1",2,1]`, true, "Mode: Second mode, Numeric one, Text one"},
	} {
		t.Run(tc.value, func(t *testing.T) {
			var value any
			if err := json.Unmarshal([]byte(tc.value), &value); err != nil {
				t.Fatal(err)
			}
			spec := map[string]any{"version": 1, "kind": "reportSpec", "title": "Choice specimen", "source": map[string]any{"kind": "reportBuilder", "containerId": "specimen", "stateKey": "specimen", "dataSourceRef": "fixture"}, "scope": map[string]any{"dataSourceRef": "fixture", "params": []any{map[string]any{"id": "mode", "label": "Mode", "kind": "select", "required": false, "multiple": tc.multiple, "value": value, "options": []any{map[string]any{"value": 2, "label": "Second mode"}, map[string]any{"value": 1, "label": "Numeric one"}, map[string]any{"value": "1", "label": "Text one"}}}}}, "datasets": []any{}, "blocks": []any{map[string]any{"id": "filters", "kind": "filterBarBlock", "title": "Inputs", "paramIds": []string{"mode"}}}, "layoutIntent": map[string]any{"blockOrder": []string{"filters"}}}
			raw, err := json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			result, err := Materialize(t.Context(), raw, map[string]json.RawMessage{})
			if err != nil {
				t.Fatal(err)
			}
			var printed reportprint.ReportPrint
			if err = json.Unmarshal(result.ReportPrint, &printed); err != nil {
				t.Fatal(err)
			}
			texts := []string{}
			for _, page := range printed.Pages {
				for _, element := range page.Elements {
					texts = append(texts, element.Text)
				}
			}
			if !strings.Contains(strings.Join(texts, "\n"), tc.want) {
				t.Fatalf("native choice labels missing: %s", strings.Join(texts, "\n"))
			}
			rendered, err := pdf.Render(&printed, pdf.Options{})
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.HasPrefix(rendered.Bytes, []byte("%PDF-")) || len(rendered.Diagnostics) != 0 {
				t.Fatalf("PDF render failed or diagnosed: %+v", rendered.Diagnostics)
			}
		})
	}
}
