package materializer

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func TestKPIBodyPrintDoesNotNarrateMissingObservations(t *testing.T) {
	// Independently invented observations cover empty, null and genuine zero values.
	for _, mode := range []string{"body", "both"} {
		for _, sample := range []struct {
			name, rows string
			empty      bool
		}{
			{"empty", `[]`, true},
			{"null", `[{"amount":null}]`, true},
			{"all-null", `[{"amount":null},{"amount":null}]`, true},
			{"zero", `[{"amount":0}]`, false},
			{"filled", `[{"amount":7}]`, false},
		} {
			t.Run(mode+"/"+sample.name, func(t *testing.T) {
				spec := json.RawMessage(fmt.Sprintf(`{"version":1,"kind":"reportSpec","title":"Observation summary","source":{"kind":"report","containerId":"observations","stateKey":"observations","dataSourceRef":"readings"},"parameters":{"viewMode":"table","pageSize":25,"orderDir":"asc","orderField":"","groupBy":""},"refinements":[],"calculatedFields":[],"datasets":[{"id":"primary","dataSourceRef":"readings","request":{"limit":1,"offset":0}}],"layoutIntent":{"kind":"stack","resultPanePosition":"bottom","blockOrder":["reading"]},"blocks":[{"id":"reading","kind":"kpiBlock","title":"Reading","datasetRef":"primary","valueField":"amount","valueLabel":"Amount","presentationMode":%q,"bodyTemplate":"Observed amount: ${value}.","emptyLabel":"No observations selected."}]}`, mode))
				payload := json.RawMessage(`{"rows":` + sample.rows + `,"diagnostics":[{"code":"observation_note","severity":"info","message":"Synthetic observation note."}]}`)
				artifacts, err := Materialize(t.Context(), spec, map[string]json.RawMessage{"primary": payload})
				if err != nil {
					t.Fatal(err)
				}
				var printed struct {
					Pages []struct {
						Elements []struct{ Text string }
					}
				}
				if err := json.Unmarshal(artifacts.ReportPrint, &printed); err != nil {
					t.Fatal(err)
				}
				var lines []string
				for _, page := range printed.Pages {
					for _, element := range page.Elements {
						lines = append(lines, element.Text)
					}
				}
				text := strings.Join(lines, "\n")
				if strings.Contains(text, "No observations selected.") != sample.empty || strings.Contains(text, "Observed amount:") == sample.empty {
					t.Fatalf("incorrect narrative availability: %s", text)
				}
				if !strings.Contains(string(artifacts.ReportFill), `"observation_note"`) {
					t.Fatal("source diagnostic was lost")
				}
			})
		}
	}
}
