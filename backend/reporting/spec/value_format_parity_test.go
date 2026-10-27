package reportspec

import "testing"

// Formats declared by the shared report schema must survive server validation.
func TestReportValueFormatsMatchPublishedSchema(t *testing.T) {
	for _, value := range []string{"currency", "currency2", "number", "number5", "percent", "percentFraction", "percentFraction2", "compact", "compactNumber"} {
		if !isAllowedReportValueFormat(value) {
			t.Errorf("schema format rejected: %s", value)
		}
	}
	if isAllowedReportValueFormat("unrecognized") {
		t.Fatal("unknown format accepted")
	}
}
