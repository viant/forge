package xlsx

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"strings"

	reportfill "github.com/viant/forge/backend/reporting/fill"
	"github.com/xuri/excelize/v2"
)

// The name formula is stable across combo grouping and print-page slicing.
// Only authored category overrides become point styles; ordinary observations
// inherit the series' positive/negative fills even after editing source values.
func nativeSignedSeries(source string, block reportfill.Block, offset, count int) map[string][]string {
	columns, rows, err := chartDisplayTable(block)
	if count == -1 {
		count = len(rows) - offset
	}
	if err != nil || offset < 0 || count < 0 || offset > len(rows) || count > len(rows)-offset {
		return nil
	}
	model := block.ChartContent.ChartModel
	overrides := chartMap(chartMap(model["series"])["categoryColors"])
	keys := map[string]bool{}
	for key := range overrides {
		keys[key] = true
	}
	ordered := sortedKeys(keys)
	result := map[string][]string{}
	for i := 1; i < len(columns); i++ {
		entry := chartSeriesModel(model, columns[i].Key)
		if chartString(entry["pointColorMode"]) != "bySign" || !nativeSignedBar(firstText(chartString(entry["type"]), block.ChartContent.ResolvedChart.Type)) {
			continue
		}
		colors := make([]string, count)
		for j, row := range rows[offset : offset+count] {
			for _, key := range ordered {
				if strings.EqualFold(strings.TrimSpace(key), strings.TrimSpace(fmt.Sprint(row[0]))) {
					colors[j] = excelChartColor(chartString(overrides[key]))
					break
				}
			}
		}
		column, _ := excelize.ColumnNumberToName(i + 1)
		result[fmt.Sprintf("%s$%s$4", sheetReference(source), column)] = colors
	}
	return result
}

// MS-ODRAWXML 2.2.1 / 2.7.3.3 defines the series negative solid-fill extension.
// It requires a solid series fill and no invertIfNegative child. Excelize has no
// public field for this extension, so augment only its known generated series.
func applySignedSeries(content []byte, signed map[string][]string) ([]byte, error) {
	seen := map[string]bool{}
	var failure error
	result := nativeSeriesXML.ReplaceAllFunc(content, func(series []byte) []byte {
		var parsed struct {
			Name string `xml:"tx>strRef>f"`
		}
		if err := xml.Unmarshal(series, &parsed); err != nil {
			failure = err
			return series
		}
		colors, ok := signed[parsed.Name]
		if !ok {
			return series
		}
		invert := []byte(`<invertIfNegative val="0"></invertIfNegative>`)
		if seen[parsed.Name] || bytes.Contains(series, []byte("<extLst>")) || bytes.Count(series, invert) != 1 || !bytes.Contains(series, []byte(`<a:srgbClr val="0F9960">`)) {
			failure = fmt.Errorf("xlsx signed chart has an unexpected series structure")
			return series
		}
		seen[parsed.Name] = true
		series = bytes.Replace(series, invert, nil, 1)
		series = nativePointXML.ReplaceAll(series, nil)
		var points strings.Builder
		for index, color := range colors {
			if color != "" {
				fmt.Fprintf(&points, `<dPt><idx val="%d"></idx><spPr><a:solidFill><a:srgbClr val="%s"></a:srgbClr></a:solidFill></spPr></dPt>`, index, color)
			}
		}
		anchor := []byte("<dLbls>")
		if !bytes.Contains(series, anchor) {
			anchor = []byte("<cat>")
		}
		if !bytes.Contains(series, anchor) {
			failure = fmt.Errorf("xlsx signed chart has no category anchor")
			return series
		}
		series = bytes.Replace(series, anchor, append([]byte(points.String()), anchor...), 1)
		extension := `<extLst><ext uri="{6F2FDCE9-48DA-4B69-8628-5D25D57E5C99}"><c14:invertSolidFillFmt xmlns:c14="http://schemas.microsoft.com/office/drawing/2007/8/2/chart"><c14:spPr><a:solidFill><a:srgbClr val="DB3737"></a:srgbClr></a:solidFill></c14:spPr></c14:invertSolidFillFmt></ext></extLst>`
		return bytes.Replace(series, []byte("</ser>"), []byte(extension+"</ser>"), 1)
	})
	if failure != nil {
		return nil, failure
	}
	if len(seen) != len(signed) {
		return nil, fmt.Errorf("xlsx signed chart series binding was not found")
	}
	return result, nil
}
