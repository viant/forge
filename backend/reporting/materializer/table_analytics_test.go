package materializer

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	reportcsv "github.com/viant/forge/backend/reporting/export/csv"
	reporthtml "github.com/viant/forge/backend/reporting/export/html"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	reportspec "github.com/viant/forge/backend/reporting/spec"
	"github.com/xuri/excelize/v2"
)

// Independently invented laboratory fixtures exercise the actual server bundle
// and export renderers; collapse state must not discard evidence.
func TestTableAnalyticsExports(t *testing.T) {
	data, err := os.ReadFile("../../../doc/examples/laboratory-table-analytics.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Hierarchy      map[string]any   `json:"hierarchy"`
		Pivot          map[string]any   `json:"pivot"`
		InventoryRows  []map[string]any `json:"inventoryRows"`
		InspectionRows []map[string]any `json:"inspectionRows"`
	}
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"hierarchy", "pivot", "computed"} {
		t.Run(mode, func(t *testing.T) {
			raw, err := os.ReadFile("testdata/presentation-report.json")
			if err != nil {
				t.Fatal(err)
			}
			var spec map[string]any
			if err = json.Unmarshal(raw, &spec); err != nil {
				t.Fatal(err)
			}
			block, rows := fixture.Hierarchy, fixture.InventoryRows
			expectedRows := 9
			if mode == "pivot" {
				block = fixture.Pivot
				rows = fixture.InspectionRows
				expectedRows = 3
			}
			block["datasetRef"] = "primary"
			if mode != "pivot" {
				rows = nil
				for batch := 0; batch < 20; batch++ {
					for _, source := range fixture.InventoryRows {
						row := map[string]any{}
						for key, value := range source {
							row[key] = value
						}
						row["nodeId"] = fmt.Sprintf("%d-%s", batch, source["nodeId"])
						if source["parentId"] != nil {
							row["parentId"] = fmt.Sprintf("%d-%s", batch, source["parentId"])
						}
						if source["parentId"] == nil {
							row["name"] = fmt.Sprintf("Building %02d %s", batch, source["name"])
						}
						rows = append(rows, row)
					}
				}
				expectedRows = len(rows)
			}
			if mode == "computed" {
				block["hierarchy"].(map[string]any)["totals"] = map[string]any{"mode": "sum-leaves", "fields": []string{"available", "occupied"}}
				for _, row := range rows {
					for _, child := range rows {
						if child["parentId"] == row["nodeId"] {
							row["available"] = nil
							row["occupied"] = nil
							break
						}
					}
				}
			}
			spec["blocks"] = []any{block}
			spec["layoutIntent"] = map[string]any{"kind": "single", "resultPanePosition": "bottom", "blockOrder": []string{block["id"].(string)}}
			raw, err = json.Marshal(spec)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = reportspec.DecodeJSON(raw); err != nil {
				t.Fatal(err)
			}
			payload, _ := json.Marshal(map[string]any{"rows": rows})
			presentations := TablePresentations{block["id"].(string): {ExpandedKeys: []string{}}}
			artifacts, err := MaterializePresented(context.Background(), raw, map[string]json.RawMessage{"primary": payload}, presentations, false)
			if err != nil {
				t.Fatal(err)
			}
			fill, err := reportfill.DecodeJSON(artifacts.ReportFill)
			if err != nil {
				t.Fatal(err)
			}
			if len(fill.Blocks[0].Content.ResolvedRows) != expectedRows || len(fill.Datasets[0].Rows) != len(rows) {
				t.Fatal("table transform or collapsed state lost evidence")
			}
			csvBytes, err := reportcsv.Render(fill)
			if err != nil {
				t.Fatal(err)
			}
			records, err := csv.NewReader(bytes.NewReader(csvBytes)).ReadAll()
			if err != nil {
				t.Fatal(err)
			}
			if len(records) != expectedRows+1 {
				t.Fatalf("CSV row count=%d", len(records))
			}
			xlsxBytes, err := reportxlsx.Render(fill)
			if err != nil {
				t.Fatal(err)
			}
			workbook, err := excelize.OpenReader(bytes.NewReader(xlsxBytes))
			if err != nil {
				t.Fatal(err)
			}
			defer workbook.Close()
			sheetRows, err := workbook.GetRows("Report")
			if err != nil {
				t.Fatal(err)
			}
			if len(sheetRows) != expectedRows+1 {
				t.Fatalf("XLSX row count=%d", len(sheetRows))
			}
			dashboardBytes, err := reportxlsx.RenderDashboard(fill)
			if err != nil {
				t.Fatal(err)
			}
			dashboard, err := excelize.OpenReader(bytes.NewReader(dashboardBytes))
			if err != nil {
				t.Fatal(err)
			}
			defer dashboard.Close()
			allWorkbookText := ""
			for _, sheet := range dashboard.GetSheetList() {
				values, readErr := dashboard.GetRows(sheet)
				if readErr != nil {
					t.Fatal(readErr)
				}
				for _, record := range values {
					allWorkbookText += strings.Join(record, " ") + "\n"
				}
			}
			if !strings.Contains(allWorkbookText, "Dataset primary") {
				t.Fatal("dashboard workbook lost raw dataset")
			}
			if mode == "pivot" && (!strings.Contains(allWorkbookText, "Electrical / Inspections") || !strings.Contains(allWorkbookText, "category")) {
				t.Fatal("dashboard workbook lost pivot headers or raw long-form evidence")
			}
			report, err := reportprint.DecodeJSON(artifacts.ReportPrint)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = reporthtml.Render(report); err != nil {
				t.Fatal(err)
			}
			pdf, err := reportpdf.Render(report, reportpdf.Options{})
			if err != nil {
				t.Fatal(err)
			}
			if len(pdf.Diagnostics) > 0 {
				t.Fatalf("PDF diagnostics: %+v", pdf.Diagnostics)
			}
			reader, err := pdfreader.NewReader(bytes.NewReader(pdf.Bytes), int64(len(pdf.Bytes)))
			if err != nil {
				t.Fatal(err)
			}
			text, err := reader.GetPlainText()
			if err != nil {
				t.Fatal(err)
			}
			plain, err := io.ReadAll(text)
			if err != nil {
				t.Fatal(err)
			}
			if mode != "pivot" {
				if len(report.Pages) < 2 {
					t.Fatal("large hierarchy did not paginate")
				}
				if !strings.Contains(string(csvBytes), "Building 19 Atlas / Room 101 / Optics") {
					t.Fatal("CSV lost hierarchy context")
				}
				if !strings.Contains(string(plain), "Building 19") {
					t.Fatal("PDF lost final hierarchy group")
				}
			} else {
				if records[0][2] != "Electrical / Inspections" || sheetRows[0][2] != "Electrical / Inspections" {
					t.Fatal("pivot export headers lost group identity")
				}
				if records[1][3] != "0" || records[1][4] != "" {
					t.Fatalf("pivot zero/null changed: %v", records[1])
				}
				if fill.Blocks[0].Pivot == nil {
					t.Fatal("pivot metadata lost in backend round trip")
				}
			}
			if mode != "pivot" {
				filtered, filterErr := MaterializePresented(context.Background(), raw, map[string]json.RawMessage{"primary": payload}, TablePresentations{block["id"].(string): {Filter: "Atlas"}}, false)
				if filterErr != nil {
					t.Fatal(filterErr)
				}
				filteredFill, decodeErr := reportfill.DecodeJSON(filtered.ReportFill)
				if decodeErr != nil {
					t.Fatal(decodeErr)
				}
				if len(filteredFill.Blocks[0].Content.ResolvedRows) != 20 {
					t.Fatal("export path leaked into presentation search")
				}
				if filteredFill.Blocks[0].Content.Columns[0].Key != "__forge_hierarchy_path" {
					t.Fatal("presentation search removed export evidence")
				}
				if err := ValidateTablePresentations(raw, TablePresentations{block["id"].(string): {Sort: &TableSort{Key: "__forge_hierarchy_path", Direction: "asc"}}}); err == nil {
					t.Fatal("export-only path admitted as interactive sort")
				}
			}
			for _, page := range report.Pages {
				tableCells, headers := 0, 0
				for _, element := range page.Elements {
					if strings.Contains(element.ID, "__header__") {
						headers++
					}
					if element.Kind == "tableCellText" {
						tableCells++
						for _, fragment := range reader.Page(page.Number).Content().Text {
							baseline := report.PageGeometry.Height - fragment.Y
							if fragment.X >= element.Box.X && fragment.X < element.Box.X+element.Box.Width && baseline >= element.Box.Y && baseline <= element.Box.Y+element.Box.Height {
								if fragment.X+fragment.W > element.Box.X+element.Box.Width+1 {
									t.Fatalf("PDF glyph exceeds its table cell: %+v box=%+v", fragment, element.Box)
								}
							}
						}
					}
					if element.Box.X < report.PageGeometry.MarginLeft-.1 || element.Box.X+element.Box.Width > report.PageGeometry.Width-report.PageGeometry.MarginRight+.1 || element.Box.Y+element.Box.Height > report.PageGeometry.Height-report.PageGeometry.MarginBottom+.1 {
						t.Fatalf("table element outside page: %+v", element.Box)
					}
				}
				if tableCells > 0 && headers == 0 {
					t.Fatalf("page %d lacks repeated table headers", page.Number)
				}
			}
		})
	}
}
