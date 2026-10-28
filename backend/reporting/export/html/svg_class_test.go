package html

import "testing"

func TestCanonicalChartClass(t *testing.T) {
	if err := validateEmbeddedSVG(`<svg xmlns="http://www.w3.org/2000/svg"><path class="forge-chart-bar" d="M0 0 L1 1" fill="#123456"/></svg>`); err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{`<svg><path class="url(https://example.invalid/x)"/></svg>`, `<svg><path class="forge-chart-bar" onclick="alert(1)"/></svg>`} {
		if err := validateEmbeddedSVG(value); err == nil {
			t.Fatal("active or malformed attributes accepted")
		}
	}
}
