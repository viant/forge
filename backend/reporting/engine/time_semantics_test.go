package reporting

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestPreviousPeriodCivilBoundaries(t *testing.T) {
	for _, tc := range [][4]string{
		{"2026-09-21", "2026-10-20", "2026-08-22", "2026-09-20"},
		{"2026-01-01", "2026-01-01", "2025-12-31", "2025-12-31"},
		{"2024-03-01", "2024-03-02", "2024-02-28", "2024-02-29"},
		{"2026-03-08", "2026-03-14", "2026-03-01", "2026-03-07"},
		{"2026-11-01", "2026-11-07", "2026-10-25", "2026-10-31"},
	} {
		start, end, err := resolveReportPreviousPeriod(tc[0], tc[1])
		if err != nil || start != tc[2] || end != tc[3] {
			t.Fatalf("%v: got %s..%s, %v", tc, start, end, err)
		}
	}
	for _, tc := range [][2]string{{"", "2026-01-01"}, {"2026-02-30", "2026-03-02"}, {"2026-01-02", "2026-01-01"}, {"2026-1-01", "2026-01-02"}, {"0001-01-01", "0001-01-01"}, {"0001-01-01", "9999-12-31"}} {
		if _, _, err := resolveReportPreviousPeriod(tc[0], tc[1]); err == nil {
			t.Fatalf("accepted invalid comparison %v", tc)
		}
	}
}

func TestPreviousPeriodCompilePreservesScopeAndIsIdempotent(t *testing.T) {
	input := json.RawMessage(`{"datasets":[{"id":"primary","request":{"filters":{"advertiserId":42,"campaignIds":[7],"from":"2026-09-21","to":"2026-10-20"}}},{"id":"prior","scope":{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}},"request":{"filters":{"advertiserId":42,"campaignIds":[7],"from":"2026-09-21","to":"2026-10-20"},"measures":{"impressions":true}}}]}`)
	now := time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC)
	first, err := expandReportSpecTimeSemantics(input, now)
	if err != nil {
		t.Fatal(err)
	}
	second, err := expandReportSpecTimeSemantics(first, now.AddDate(1, 0, 0))
	if err != nil {
		t.Fatal(err)
	}
	if string(first) != string(second) {
		t.Fatal("comparison shifted on recompilation")
	}
	var root struct {
		Datasets []struct{ Request map[string]interface{} }
	}
	if err = json.Unmarshal(first, &root); err != nil {
		t.Fatal(err)
	}
	if got := reportRequestPath(root.Datasets[0].Request, "filters.from"); got != "2026-09-21" {
		t.Fatal("primary changed", got)
	}
	prior := root.Datasets[1].Request
	if reportRequestPath(prior, "filters.from") != "2026-08-22" || reportRequestPath(prior, "filters.to") != "2026-09-20" {
		t.Fatal(string(first))
	}
	if !strings.Contains(string(first), `"campaignIds":[7]`) || !strings.Contains(string(first), `"advertiserId":42`) {
		t.Fatal("entity scope lost")
	}
	for _, bad := range []string{strings.ReplaceAll(string(input), `"2026-09-21"`, `""`), strings.ReplaceAll(string(input), `"override"`, `"inherit"`), strings.ReplaceAll(string(input), `"id":"primary"`, `"id":"absent"`)} {
		if _, err := expandReportSpecTimeSemantics(json.RawMessage(bad), now); err == nil {
			t.Fatal("accepted invalid comparison", bad)
		}
	}
}

func TestPreviousPeriodResolvesPrimaryClockRangeBeforeComparison(t *testing.T) {
	input := json.RawMessage(`{"datasets":[{"id":"prior","scope":{"mode":"override","relativeDateRange":{"preset":"previousPeriod","startParamPath":"filters.from","endParamPath":"filters.to"}},"request":{"filters":{}}},{"id":"primary","scope":{"mode":"override","relativeDateRange":{"preset":"last7days","startParamPath":"filters.from","endParamPath":"filters.to"}},"request":{"filters":{}}}]}`)
	out, err := expandReportSpecTimeSemantics(input, time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	var root struct {
		Datasets []struct{ Request map[string]interface{} }
	}
	if err = json.Unmarshal(out, &root); err != nil {
		t.Fatal(err)
	}
	if reportRequestPath(root.Datasets[0].Request, "filters.from") != "2026-03-01" || reportRequestPath(root.Datasets[0].Request, "filters.to") != "2026-03-07" {
		t.Fatal(string(out))
	}
}
