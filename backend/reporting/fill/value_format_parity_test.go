package reportfill

import "testing"

// Formats declared by the shared report schema must survive server validation.
func TestReportValueFormatsMatchPublishedSchema(t *testing.T) {
	for _, value := range []string{"currency", "currency2", "number", "number2", "number5", "percent", "percentFraction", "percentFraction2", "compact", "compactNumber"} {
		if !isAllowedReportValueFormat(value) {
			t.Errorf("schema format rejected: %s", value)
		}
	}
	if isAllowedReportValueFormat("date") {
		t.Fatal("KPI-only date format leaked into the general value contract")
	}
	if isAllowedReportValueFormat("unrecognized") {
		t.Fatal("unknown format accepted")
	}
}
