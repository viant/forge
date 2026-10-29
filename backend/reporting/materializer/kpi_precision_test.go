package materializer

import (
	"encoding/json"
	"strings"
	"testing"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	reportspec "github.com/viant/forge/backend/reporting/spec"
)

func TestTwoDecimalKPIReachesNativePrintWithoutRoundingData(t *testing.T) {
	raw := json.RawMessage(`{"version":1,"kind":"reportSpec","title":"Precision specimen","source":{"kind":"report","containerId":"precision","stateKey":"precision","dataSourceRef":"readings"},"parameters":{"viewMode":"table","pageSize":25,"orderDir":"asc","orderField":"","groupBy":""},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"readings","request":{"limit":1,"offset":0}}],"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["ratio"]},"blocks":[{"id":"ratio","kind":"kpiBlock","title":"Ratio","datasetRef":"primary","valueField":"ratio","valueLabel":"Ratio","valueFormat":"number2","secondaryField":"change","secondaryLabel":"Change","secondaryFormat":"number2"}]}`)
	if _, err := reportspec.DecodeJSON(raw); err != nil {
		t.Fatal(err)
	}
	result, err := Materialize(t.Context(), raw, map[string]json.RawMessage{
		"primary": json.RawMessage(`{"rows":[{"ratio":1.2345,"change":-0.38275}]}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reportfill.DecodeJSON(result.ReportFill); err != nil {
		t.Fatal(err)
	}
	var fill struct {
		Blocks []struct {
			Content struct {
				Value          float64
				SecondaryValue float64
			}
		}
	}
	if err := json.Unmarshal(result.ReportFill, &fill); err != nil {
		t.Fatal(err)
	}
	if len(fill.Blocks) != 1 || fill.Blocks[0].Content.Value != 1.2345 || fill.Blocks[0].Content.SecondaryValue != -0.38275 {
		t.Fatalf("rounded source data: %s", result.ReportFill)
	}
	var printed reportprint.ReportPrint
	if err := json.Unmarshal(result.ReportPrint, &printed); err != nil {
		t.Fatal(err)
	}
	var text []string
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			text = append(text, element.Text)
		}
	}
	joined := strings.Join(text, "\n")
	if !strings.Contains(joined, "1.23") || !strings.Contains(joined, "-0.38") {
		t.Fatalf("precision lost in print: %s", joined)
	}
}
