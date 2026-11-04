package materializer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

// Independently invented collection names exercise the existing authored track
// contract through native materialization and the actual PDF renderer.
func TestPrintRankingAuthoredTracksPreserveReferencesAndCells(t *testing.T) {
	rows := make([]map[string]any, 5)
	labels := []string{}
	for i := range rows {
		label := fmt.Sprintf("Collection %d from the northern botanical archive with complete catalog descriptions", i+1)
		labels = append(labels, label)
		rows[i] = map[string]any{"category": label, "value": (i + 1) * 12}
	}
	payload, err := json.Marshal(map[string]any{"rows": rows})
	if err != nil {
		t.Fatal(err)
	}
	var baselineWidth float64
	for _, weighted := range []bool{false, true} {
		name := "legacy"
		runtime := map[string]any{"desktopColumns": 2, "tabletColumns": 1, "mobileColumns": 1}
		if weighted {
			name = "authored"
			runtime["childWeights"] = map[string]any{"first": 1, "second": 1}
			runtime["minColumnWidth"] = 240
		}
		raw, err := os.ReadFile("testdata/presentation-report.json")
		if err != nil {
			t.Fatal(err)
		}
		var spec map[string]any
		if err = json.Unmarshal(raw, &spec); err != nil {
			t.Fatal(err)
		}
		spec["title"] = "Botanical collection rankings"
		blocks := []any{map[string]any{"id": "rankings", "kind": "compositeBlock", "title": "Collection rankings", "layout": "responsiveGrid", "childBlockIds": []string{"first", "second"}, "runtime": runtime}}
		for i, id := range []string{"first", "second"} {
			blocks = append(blocks, map[string]any{"id": id, "kind": "chartBlock", "title": []string{"First collection comparison", "Second collection comparison"}[i], "datasetRef": "primary", "rowLimit": 5, "chartModel": map[string]any{"type": "horizontal_bar", "xAxis": map[string]any{"dataKey": "category"}, "series": map[string]any{"values": []any{map[string]any{"value": "value", "label": "Specimens", "type": "horizontal_bar", "dataLabels": "always"}}}}})
		}
		blocks = append(blocks, map[string]any{"id": "evidence", "kind": "tableBlock", "title": "Complete collection records", "datasetRef": "primary", "columns": []any{map[string]any{"key": "category", "label": "Collection"}, map[string]any{"key": "value", "label": "Specimens"}}})
		spec["blocks"] = blocks
		spec["layoutIntent"] = map[string]any{"kind": "single", "blockOrder": []string{"rankings", "evidence"}}
		raw, err = json.Marshal(spec)
		if err != nil {
			t.Fatal(err)
		}
		artifacts, err := Materialize(context.Background(), raw, map[string]json.RawMessage{"primary": payload})
		if err != nil {
			t.Fatal(err)
		}
		printed, err := reportprint.DecodeJSON(artifacts.ReportPrint)
		if err != nil {
			t.Fatal(err)
		}
		var charts []reportprint.Element
		cells := 0
		for _, page := range printed.Pages {
			for _, element := range page.Elements {
				if element.Kind == "svg" && (strings.HasPrefix(element.ID, "first__") || strings.HasPrefix(element.ID, "second__")) {
					charts = append(charts, element)
				}
				if element.Kind == "tableCellText" {
					cells++
				}
			}
		}
		if len(charts) != 2 || cells != 10 {
			t.Fatalf("%s charts=%d cells=%d", name, len(charts), cells)
		}
		if !weighted {
			baselineWidth = charts[0].Box.Width
		} else {
			width := (printed.PageGeometry.Width - printed.PageGeometry.MarginLeft - printed.PageGeometry.MarginRight)
			if charts[0].Box.Width < baselineWidth*1.4 || charts[0].Box.Y != charts[1].Box.Y || charts[1].Box.X+charts[1].Box.Width < printed.PageGeometry.MarginLeft+width-1 {
				t.Fatalf("authored tracks did not fill the row: %+v", charts)
			}
		}
		for _, chart := range charts {
			if strings.Count(chart.SVG, `class="forge-chart-bar"`) != 5 {
				t.Fatal("ranking marks lost")
			}
			for i := range labels {
				if !strings.Contains(chart.SVG, fmt.Sprintf("Category %d", i+1)) {
					t.Fatal("reference key lost")
				}
				if !strings.Contains(chart.SVG, fmt.Sprintf(">%d</text>", (i+1)*12)) {
					t.Fatal("ranking value label changed")
				}
			}
		}
		rendered, err := reportpdf.Render(printed, reportpdf.Options{})
		if err != nil {
			t.Fatal(err)
		}
		if len(rendered.Diagnostics) != 0 {
			t.Fatalf("PDF diagnostics: %+v", rendered.Diagnostics)
		}
		reader, err := pdfreader.NewReader(bytes.NewReader(rendered.Bytes), int64(len(rendered.Bytes)))
		if err != nil {
			t.Fatal(err)
		}
		plain, err := reader.GetPlainText()
		if err != nil {
			t.Fatal(err)
		}
		text, err := io.ReadAll(plain)
		if err != nil {
			t.Fatal(err)
		}
		compact := func(s string) string { return strings.Join(strings.Fields(s), "") }
		for i, label := range labels {
			// The browser ranks these increasing measures in descending order;
			// references number displayed bars while evidence retains source order.
			reference := compact(fmt.Sprintf("Category %d: %s", len(labels)-i, label))
			if strings.Count(compact(string(text)), reference) != 2 {
				t.Fatalf("%s missing/changed complete reference %q", name, reference)
			}
			if strings.Count(compact(string(text)), compact(label)) != 3 {
				t.Fatalf("%s missing full evidence cell %q", name, label)
			}
		}
		if dir := os.Getenv("FORGE_RANKING_TRACKS_PROOF_DIR"); dir != "" {
			if err = os.WriteFile(filepath.Join(dir, name+".pdf"), rendered.Bytes, 0600); err != nil {
				t.Fatal(err)
			}
			if err = os.WriteFile(filepath.Join(dir, name+".print.json"), artifacts.ReportPrint, 0600); err != nil {
				t.Fatal(err)
			}
		}
		t.Logf("%s: chart width %.1f, plot marks 10, full reference mappings 10, cells %d, pages %d", name, charts[0].Box.Width, cells, len(printed.Pages))
	}
}
