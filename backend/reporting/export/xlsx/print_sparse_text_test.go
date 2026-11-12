package xlsx

import (
	"bytes"
	"encoding/xml"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// Independently invented labels exercise the fine print grid without importing
// a report capture. Background fills and borders belong to their own primitives;
// merged text must not repaint the interior with redundant font/alignment styles.
func TestPrintMergedTextStylesOnlyAnchor(t *testing.T) {
	for _, kind := range []string{"text", "tableCellText"} {
		t.Run(kind, func(t *testing.T) {
			f := excelize.NewFile()
			defer f.Close()
			w := visualDashboardWriter{dashboardWriter: dashboardWriter{file: f}}
			box := reportprint.Box{X: 24, Y: 24, Width: 540, Height: 27}
			background := reportprint.Element{Kind: "rect", Box: box, FillColor: "#eef4ff", StrokeColor: "#123456", StrokeWidth: 1}
			require.NoError(t, w.printElement("Sheet1", background, 0))
			first, last, col, row, err := printCells(box, 0)
			require.NoError(t, err)
			interior, err := excelize.CoordinatesToCellName(col+1, row+1)
			require.NoError(t, err)
			interiorStyle, err := f.GetCellStyle("Sheet1", interior)
			require.NoError(t, err)
			cornerStyle, err := f.GetCellStyle("Sheet1", last)
			require.NoError(t, err)
			label := reportprint.Element{Kind: kind, Box: box, Text: "=Synthetic label", FontWeight: "bold italic", FontSize: 11, Color: "#243746", Align: "right", Wrap: true}
			require.NoError(t, w.printElement("Sheet1", label, 0))
			// A second page without a background must retain just its text style.
			require.NoError(t, w.printElement("Sheet1", label, 900))
			second, secondLast, _, _, err := printCells(box, 900)
			require.NoError(t, err)
			buffer, err := f.WriteToBuffer()
			require.NoError(t, err)
			book, err := excelize.OpenReader(bytes.NewReader(buffer.Bytes()))
			require.NoError(t, err)
			defer book.Close()
			for _, cell := range []string{first, second} {
				require.Equal(t, label.Text, mustCellValue(t, book, "Sheet1", cell))
				formula, err := book.GetCellFormula("Sheet1", cell)
				require.NoError(t, err)
				require.Empty(t, formula)
				id, err := book.GetCellStyle("Sheet1", cell)
				require.NoError(t, err)
				style, err := book.GetStyle(id)
				require.NoError(t, err)
				require.True(t, style.Font.Bold && style.Font.Italic)
				require.Equal(t, "right", style.Alignment.Horizontal)
				require.True(t, style.Alignment.WrapText)
			}
			for cell, expected := range map[string]int{interior: interiorStyle, last: cornerStyle, secondLast: 0} {
				id, err := book.GetCellStyle("Sheet1", cell)
				require.NoError(t, err)
				require.Equal(t, expected, id, "background and edge styles at %s", cell)
			}
			merges, err := book.GetMergeCells("Sheet1")
			require.NoError(t, err)
			require.Len(t, merges, 2)
			require.Equal(t, first, merges[0].GetStartAxis())
			require.Equal(t, last, merges[0].GetEndAxis())
			require.Equal(t, second, merges[1].GetStartAxis())
			require.Equal(t, secondLast, merges[1].GetEndAxis())
			// Count serialized styles, not the reader's expanded merged grid. Older
			// Excelize versions retain default blank cells, but no version should
			// duplicate the text style throughout the second page's merged region.
			var sheet struct {
				Cells []struct {
					Style int `xml:"s,attr"`
				} `xml:"sheetData>row>c"`
			}
			require.NoError(t, xml.Unmarshal([]byte(workbookZIP(t, buffer.Bytes())["xl/worksheets/sheet1.xml"]), &sheet))
			styled := 0
			for _, cell := range sheet.Cells {
				if cell.Style != 0 {
					styled++
				}
			}
			require.Equal(t, 180*9+1, styled)
		})
	}
}

func TestDashboardPrintDoesNotRepeatTextStylesAcrossMergedGrid(t *testing.T) {
	artifacts := paginatedPrintExample(t, 0)
	data, err := RenderDashboardWithPrint(artifacts.ReportFill, artifacts.ReportPrint)
	require.NoError(t, err)
	entries := workbookZIP(t, data)
	styledText, values, cells := 0, 0, 0
	for name, content := range entries {
		if !strings.HasPrefix(name, "xl/worksheets/") || !strings.HasSuffix(name, ".xml") {
			continue
		}
		var sheet struct {
			Cells []struct {
				Style int     `xml:"s,attr"`
				Value *string `xml:"v"`
			} `xml:"sheetData>row>c"`
		}
		require.NoError(t, xml.Unmarshal([]byte(content), &sheet))
		cells += len(sheet.Cells)
		for _, cell := range sheet.Cells {
			if cell.Style != 0 {
				styledText++
			}
			if cell.Value != nil {
				values++
			}
		}
	}
	// This independently generated fixture contains 50 source rows spread over
	// several visual pages. The count ceiling catches grid-area style expansion.
	t.Logf("xlsxBytes=%d cells=%d styledCells=%d valueCells=%d", len(data), cells, styledText, values)
	require.Less(t, styledText, 1000)
	book, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer book.Close()
	rows, err := book.GetRows("Chart Measurements by period")
	require.NoError(t, err)
	require.Len(t, rows, 54)
	labels := map[string]bool{}
	for _, row := range rows[4:] {
		labels[row[0]] = true
	}
	require.Len(t, labels, 50)
	require.True(t, labels["Period 50"])
}
