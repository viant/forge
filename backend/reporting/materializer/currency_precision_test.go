package materializer

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"io"
	"testing"

	pdfreader "github.com/ledongthuc/pdf"
	"github.com/stretchr/testify/require"
	reportcsv "github.com/viant/forge/backend/reporting/export/csv"
	reporthtml "github.com/viant/forge/backend/reporting/export/html"
	reportpdf "github.com/viant/forge/backend/reporting/export/pdf"
	reportxlsx "github.com/viant/forge/backend/reporting/export/xlsx"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/xuri/excelize/v2"
)

// Independently invented amounts verify presentation without rounding source data.
func TestCurrencyPrecisionAcrossNativeExports(t *testing.T) {
	spec := json.RawMessage(`{"version":1,"kind":"reportSpec","title":"Currency precision","source":{"kind":"report","containerId":"precision","stateKey":"precision","dataSourceRef":"readings"},"parameters":{"viewMode":"table","pageSize":25},"layoutIntent":{"kind":"stack","blockOrder":["amounts"]},"datasets":[{"id":"primary","dataSourceRef":"readings","request":{}}],"blocks":[{"id":"amounts","kind":"tableBlock","title":"Amounts","datasetRef":"primary","columns":[{"key":"whole","label":"Whole","format":"currency"},{"key":"cents","label":"Cents","format":"currency2"}]}]}`)
	output, err := MaterializePresented(t.Context(), spec, map[string]json.RawMessage{"primary": json.RawMessage(`{"rows":[{"whole":1234.75,"cents":1234.75},{"whole":-12.75,"cents":-12.75},{"whole":null,"cents":null}]}`)}, nil, false)
	require.NoError(t, err)
	fill, err := reportfill.DecodeDatasourceJSON(output.ReportFill)
	require.NoError(t, err)
	for i, expected := range []any{1234.75, -12.75, nil} {
		require.Equal(t, expected, fill.Datasets[0].Rows[i]["whole"])
		require.Equal(t, expected, fill.Blocks[0].Content.ResolvedRows[i].Cells[0].Value)
	}
	printed, err := reportprint.DecodeJSON(output.ReportPrint)
	require.NoError(t, err)
	var cellText []string
	for _, page := range printed.Pages {
		for _, element := range page.Elements {
			if element.Kind == "tableCellText" {
				cellText = append(cellText, element.Text)
			}
		}
	}
	for _, expected := range []string{"$1,235", "-$13", "$1,234.75", "-$12.75", "—"} {
		require.Contains(t, cellText, expected)
	}
	html, err := reporthtml.Render(printed)
	require.NoError(t, err)
	pdf, err := reportpdf.Render(printed, reportpdf.Options{})
	require.NoError(t, err)
	reader, err := pdfreader.NewReader(bytes.NewReader(pdf.Bytes), int64(len(pdf.Bytes)))
	require.NoError(t, err)
	plain, err := reader.GetPlainText()
	require.NoError(t, err)
	pdfText, err := io.ReadAll(plain)
	require.NoError(t, err)
	for _, expected := range []string{"$1,235", "-$13", "$1,234.75", "-$12.75"} {
		require.Contains(t, string(html), expected)
		require.Contains(t, string(pdfText), expected)
	}
	data, err := reportcsv.Render(fill)
	require.NoError(t, err)
	records, err := csv.NewReader(bytes.NewReader(data)).ReadAll()
	require.NoError(t, err)
	require.Equal(t, [][]string{{"Whole", "Cents"}, {"1234.75", "1234.75"}, {"-12.75", "-12.75"}, {"", ""}}, records)
	for _, variant := range []string{"selected", "dashboard", "print"} {
		t.Run(variant, func(t *testing.T) {
			var data []byte
			var err error
			sheet, row := "Report", 2
			switch variant {
			case "selected":
				data, err = reportxlsx.Render(fill)
			case "dashboard":
				data, err = reportxlsx.RenderDashboard(fill)
				row = 5
			case "print":
				data, err = reportxlsx.RenderDatasourceDashboardWithPrint(output.ReportFill, output.ReportPrint)
				sheet, row = "Table Amounts", 5
			}
			require.NoError(t, err)
			book, err := excelize.OpenReader(bytes.NewReader(data))
			require.NoError(t, err)
			defer book.Close()
			for i, values := range [][]string{{"$1,235", "$1,234.75"}, {"-$13", "-$12.75"}, {"", ""}} {
				for j, expected := range values {
					address, err := excelize.CoordinatesToCellName(j+1, row+i)
					require.NoError(t, err)
					value, err := book.GetCellValue(sheet, address)
					require.NoError(t, err)
					require.Equal(t, expected, value)
					raw, err := book.GetCellValue(sheet, address, excelize.Options{RawCellValue: true})
					require.NoError(t, err)
					require.Equal(t, []string{"1234.75", "-12.75", ""}[i], raw)
				}
			}
		})
	}
}
