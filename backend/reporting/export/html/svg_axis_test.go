package html

import "testing"

// Independently authored chart tick; no application capture is embedded here.
func TestCanonicalChartAxisAnnotation(t *testing.T) {
	if err := ValidateEmbeddedSVG(`<svg xmlns="http://www.w3.org/2000/svg"><text data-report-print-axis="right" x="90" y="20" text-anchor="start">25%</text></svg>`); err != nil {
		t.Fatal(err)
	}
	for _, attribute := range []string{
		`data-report-print-axis="left"`,
		`data-report-print-axis=""`,
		`data-report-print-axis="RIGHT"`,
		`data-report-print-axis="right onclick=alert(1)"`,
		`data-report-print-axis="url(https://example.invalid/x)"`,
		`data-report-print-other="right"`,
		`onclick="alert(1)"`,
		`href="https://example.invalid/x"`,
		`xmlns:custom="urn:custom" custom:data-report-print-axis="right"`,
	} {
		t.Run(attribute, func(t *testing.T) {
			if err := ValidateEmbeddedSVG(`<svg><text ` + attribute + `>25%</text></svg>`); err == nil {
				t.Fatal("unsupported attribute or value accepted")
			}
		})
	}
}
