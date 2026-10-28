package xlsx

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"math"
	"strconv"
	"strings"

	reporthtml "github.com/viant/forge/backend/reporting/export/html"
	reportfill "github.com/viant/forge/backend/reporting/fill"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/viant/forge/backend/reporting/textwrap"
	"github.com/xuri/excelize/v2"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

func overlapsDataBar(label reportprint.Element, elements []reportprint.Element) bool {
	for _, bar := range elements {
		if bar.Kind != "tableCellDataBar" || label.RowKey != bar.RowKey || label.ColumnKey != bar.ColumnKey {
			continue
		}
		a, b := label.Box, bar.Box
		if a.X < b.X+b.Width && b.X < a.X+a.Width && a.Y < b.Y+b.Height && b.Y < a.Y+a.Height {
			return true
		}
	}
	return false
}

func (w *visualDashboardWriter) printLabelPill(sheet string, e reportprint.Element, offset float64) error {
	fill, stroke := "none", "none"
	if color := excelChartColor(e.BackgroundColor); color != "" {
		fill = "#" + color
	}
	if color := excelChartColor(e.BorderColor); color != "" {
		stroke = "#" + color
	}
	width := e.StrokeWidth
	if width <= 0 && stroke != "none" {
		width = 1
	}
	markup := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%g" height="%g"><rect width="%g" height="%g" rx="%g" fill="%s" stroke="%s" stroke-width="%g"/></svg>`, e.Box.Width, e.Box.Height, e.Box.Width, e.Box.Height, math.Min(e.Box.Width, e.Box.Height)/2, fill, stroke, width)
	if err := w.printPicture(sheet, e.Box, offset, ".svg", []byte(markup), "Rounded label background"); err != nil {
		return err
	}
	e.Text = firstText(e.Label, e.Text)
	e.Color = firstText(e.TextColor, e.Color)
	e.FontWeight = firstText(e.FontWeight, "600")
	e.Align = "center"
	e.VerticalAlign = "middle"
	e.Wrap = false
	return w.printDataBarLabel(sheet, e, offset)
}

// The canonical bar box is already proportional, including negative values.
// Generated local SVG uses only sanitized colors and constants; no input URLs.
func dataBarSVG(e reportprint.Element) string {
	w, h := e.Box.Width, e.Box.Height
	r := math.Min(w, h) / 2
	fill := firstText(excelChartColor(e.FillColor), "FFFFFF")
	bg := excelChartColor(e.BackgroundColor)
	var body strings.Builder
	if bg == "" {
		fmt.Fprintf(&body, `<rect width="%g" height="%g" rx="%g" fill="#%s"/>`, w, h, r, fill)
	} else {
		fmt.Fprintf(&body, `<defs><clipPath id="bar"><rect width="%g" height="%g" rx="%g"/></clipPath></defs><g clip-path="url(#bar)">`, w, h, r)
		start, _ := strconv.ParseUint(bg, 16, 32)
		end, _ := strconv.ParseUint(fill, 16, 32)
		for i := 0; i < 64; i++ {
			var color uint64
			for _, shift := range []uint{16, 8, 0} {
				a, b := float64((start>>shift)&255), float64((end>>shift)&255)
				color |= uint64(a+(b-a)*float64(i)/63+0.5) << shift
			}
			width := w / 64
			if i < 63 {
				width += 0.05
			}
			fmt.Fprintf(&body, `<rect x="%g" width="%g" height="%g" fill="#%06x"/>`, float64(i)*w/64, width, h, color)
		}
		body.WriteString(`</g>`)
	}
	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%g" height="%g" viewBox="0 0 %g %g">%s</svg>`, w, h, w, h, body.String())
}

func (w *visualDashboardWriter) printDataBar(sheet string, e reportprint.Element, offset float64) error {
	if e.Box.Width <= 0 || e.Box.Height <= 0 {
		return nil
	}
	return w.printPicture(sheet, e.Box, offset, ".svg", []byte(dataBarSVG(e)), "Resolved rounded data bar")
}

// Draw labels above the bar image in the same drawing layer. Raw typed values
// remain editable on the supporting table sheet.
func (w *visualDashboardWriter) printDataBarLabel(sheet string, e reportprint.Element, offset float64) error {
	size := e.FontSize
	if size <= 0 {
		size = 10
	}
	x, anchor := 0.0, "start"
	switch e.Align {
	case "center":
		x = e.Box.Width / 2
		anchor = "middle"
	case "right":
		x = e.Box.Width
		anchor = "end"
	}
	lines := []string{e.Text}
	lineHeight := 1.2 * size
	y := e.Box.Height/2 + 0.3*size
	if e.VerticalAlign == "top" {
		y = 0.8 * size
	}
	if e.VerticalAlign == "bottom" {
		y = e.Box.Height - 0.2*size
	}
	if e.Wrap {
		lines = textwrap.Lines(e.Text, e.Box.Width, size)
		lines = lines[:min(len(lines), max(1, int(e.Box.Height/lineHeight)))]
		y = 0.9 * size
	}
	var body strings.Builder
	for i, line := range lines {
		fmt.Fprintf(&body, `<text x="%g" y="%g" text-anchor="%s" font-family="%s" font-size="%g" font-weight="%s" fill="#%s">%s</text>`, x, y+float64(i)*lineHeight, anchor, html.EscapeString(firstText(e.FontFamily, "Arial")), size, html.EscapeString(firstText(e.FontWeight, "normal")), firstText(excelChartColor(e.Color), "000000"), html.EscapeString(line))
	}
	markup := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%g" height="%g">%s</svg>`, e.Box.Width, e.Box.Height, body.String())
	return w.printPicture(sheet, e.Box, offset, ".svg", []byte(markup), "Data bar label: "+e.Text)
}

// Excel's smoothing algorithm is not the canonical monotone interpolation.
// Keep the resolved path rather than inventing extrema between its samples.
func nativePrintFidelityReason(block reportfill.Block, markup string) string {
	if block.ChartContent.ResolvedChart.Center != nil {
		return "The centered label is preserved in the print visual; the editable companion uses the same local data."
	}
	decoder := xml.NewDecoder(strings.NewReader(markup))
	for {
		token, err := decoder.Token()
		if err != nil {
			return ""
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "path" {
			continue
		}
		fill, stroke, path := "", "", ""
		for _, attr := range start.Attr {
			switch attr.Name.Local {
			case "fill":
				fill = attr.Value
			case "stroke":
				stroke = attr.Value
			case "d":
				path = attr.Value
			}
		}
		if fill == "none" && stroke != "" && stroke != "none" && strings.ContainsAny(path, "CcQqSsTtAa") {
			return "Canonical curved paths are preserved; the editable companion uses straight segments to avoid introducing interpolation overshoot."
		}
	}
}

func init() {
	// Excelize supports SVG relationships but delegates image dimensions to Go's
	// image registry. This decoder only reads dimensions; it never executes SVG.
	image.RegisterFormat("forge-svg", "<svg", func(io.Reader) (image.Image, error) { return nil, fmt.Errorf("SVG raster decoding is unavailable") }, svgConfig)
}

func svgConfig(reader io.Reader) (image.Config, error) {
	decoder := xml.NewDecoder(io.LimitReader(reader, 16<<20))
	for {
		token, err := decoder.Token()
		if err != nil {
			return image.Config{}, err
		}
		root, ok := token.(xml.StartElement)
		if !ok {
			continue
		}
		if root.Name.Local != "svg" {
			return image.Config{}, fmt.Errorf("invalid SVG root")
		}
		width, height := 0.0, 0.0
		for _, attribute := range root.Attr {
			value := strings.TrimSuffix(strings.TrimSuffix(attribute.Value, "px"), "pt")
			number, _ := strconv.ParseFloat(value, 64)
			switch attribute.Name.Local {
			case "width":
				width = number
			case "height":
				height = number
			case "viewBox":
				if width == 0 || height == 0 {
					parts := strings.Fields(strings.ReplaceAll(attribute.Value, ",", " "))
					if len(parts) == 4 {
						width, _ = strconv.ParseFloat(parts[2], 64)
						height, _ = strconv.ParseFloat(parts[3], 64)
					}
				}
			}
		}
		if width <= 0 || height <= 0 || math.IsNaN(width) || math.IsNaN(height) || math.IsInf(width, 0) || math.IsInf(height, 0) || width > 100000 || height > 100000 {
			return image.Config{}, fmt.Errorf("invalid SVG dimensions")
		}
		return image.Config{Width: int(math.Ceil(width)), Height: int(math.Ceil(height))}, nil
	}
}

func (w *visualDashboardWriter) printSVG(sheet string, element reportprint.Element, offset float64) error {
	markup := strings.TrimSpace(element.SVG)
	if err := reporthtml.ValidateEmbeddedSVG(markup); err != nil {
		return err
	}
	return w.printPicture(sheet, element.Box, offset, ".svg", []byte(markup), "Static print visual: "+element.ID)
}

// Native cells own the card fill and editable text. A transparent vector border
// supplies rounded corners without covering the cells or flattening the card.
func (w *visualDashboardWriter) printRoundedBorder(sheet string, e reportprint.Element, offset float64) error {
	width, height := e.Box.Width, e.Box.Height
	radius := math.Min(e.Radius, math.Min(width, height)/2)
	if width <= 0 || height <= 0 {
		return nil
	}
	path := fmt.Sprintf("M 0 0 H %g V %g H 0 Z M %g 0 H %g Q %g 0 %g %g V %g Q %g %g %g %g H %g Q 0 %g 0 %g V %g Q 0 0 %g 0 Z", width, height, radius, width-radius, width, width, radius, height-radius, width, height, width-radius, height, radius, height, height-radius, radius, radius)
	stroke := firstText(excelChartColor(e.StrokeColor), "FFFFFF")
	markup := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%g" height="%g" viewBox="0 0 %g %g"><path d="%s" fill="#ffffff" fill-rule="evenodd"/><rect x="0.5" y="0.5" width="%g" height="%g" rx="%g" fill="none" stroke="#%s" stroke-width="%g"/></svg>`, width, height, width, height, path, math.Max(0, width-1), math.Max(0, height-1), radius, stroke, e.StrokeWidth)
	return w.printPicture(sheet, e.Box, offset, ".svg", []byte(markup), "Card border")
}

func (w *visualDashboardWriter) printImage(sheet string, element reportprint.Element, offset float64) error {
	if element.Image == nil {
		return fmt.Errorf("image payload required")
	}
	payload := element.Image.Payload
	if strings.HasPrefix(payload, "data:") {
		index := strings.Index(payload, ",")
		if index < 0 {
			return fmt.Errorf("invalid image data URI")
		}
		payload = payload[index+1:]
	}
	data, err := base64.StdEncoding.Strict().DecodeString(payload)
	if err != nil {
		return err
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return err
	}
	expected := map[string]string{"image/png": "png", "image/jpeg": "jpeg", "image/jpg": "jpeg", "image/gif": "gif", "image/webp": "webp"}[strings.ToLower(element.Image.MimeType)]
	if expected == "" || expected != format {
		return fmt.Errorf("image payload does not match declared MIME type")
	}
	if config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > 40_000_000 {
		return fmt.Errorf("report image exceeds supported pixel dimensions")
	}
	if (format == "png" || format == "jpeg") && config.Width >= 16 && config.Height >= 16 {
		return w.printPicture(sheet, element.Box, offset, "."+format, data, element.ID)
	}
	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return err
	}
	// Excel for Mac renders very small raster payloads as a gray placeholder.
	// Replicate pixels at an integer scale, retaining alpha and exact pixel
	// boundaries; drawing dimensions remain the canonical print box.
	if config.Width < 16 || config.Height < 16 {
		scale := max((16+config.Width-1)/config.Width, (16+config.Height-1)/config.Height)
		if int64(config.Width)*int64(config.Height)*int64(scale)*int64(scale) > 40_000_000 {
			return fmt.Errorf("report image exceeds supported pixel dimensions after compatibility scaling")
		}
		expanded := image.NewNRGBA(image.Rect(0, 0, config.Width*scale, config.Height*scale))
		draw.NearestNeighbor.Scale(expanded, expanded.Bounds(), decoded, decoded.Bounds(), draw.Src, nil)
		decoded = expanded
	}
	var pngData bytes.Buffer
	if err = png.Encode(&pngData, decoded); err != nil {
		return err
	}
	return w.printPicture(sheet, element.Box, offset, ".png", pngData.Bytes(), element.ID)
}

func (w *visualDashboardWriter) printLine(sheet string, e reportprint.Element, offset float64) error {
	if e.StrokeWidth <= 0 {
		return nil
	}
	box := e.Box
	col := int(math.Floor(box.X/printColumnPoints)) + 1
	row := int(math.Floor((box.Y+offset)/printRowPoints)) + 1
	cell, err := excelize.CoordinatesToCellName(col, row)
	if err != nil {
		return err
	}
	color := firstText(excelChartColor(e.StrokeColor), "D0D5DD")
	if e.StrokeStyle == "dashed" || e.StrokeStyle == "dotted" {
		dash := "4 2"
		if e.StrokeStyle == "dotted" {
			dash = "1 2"
		}
		width, height := math.Max(box.Width, e.StrokeWidth), math.Max(box.Height, e.StrokeWidth)
		e.SVG = fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%g" height="%g"><line x1="0" y1="0" x2="%g" y2="%g" stroke="#%s" stroke-width="%g" stroke-dasharray="%s"/></svg>`, width, height, box.Width, box.Height, color, e.StrokeWidth, dash)
		e.Box.Width = width
		e.Box.Height = height
		return w.printSVG(sheet, e, offset)
	}
	shape := &excelize.Shape{Cell: cell, Type: "straightConnector1", Width: uint(math.Max(1, math.Round(box.Width*4/3))), Height: uint(math.Max(1, math.Round(box.Height*4/3))), Format: excelize.GraphicOptions{OffsetX: int(math.Round((box.X - float64(col-1)*printColumnPoints) * 4 / 3)), OffsetY: int(math.Round((box.Y + offset - float64(row-1)*printRowPoints) * 4 / 3))}}
	// Shape line color moved into Fill in Excelize 2.11; both exported forms
	// accept the same numeric width. Unknown fields are deliberately ignored.
	encoded, err := json.Marshal(map[string]any{"Line": map[string]any{"Color": color, "Fill": excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{color}}, "Width": e.StrokeWidth}})
	if err != nil {
		return err
	}
	if err = json.Unmarshal(encoded, shape); err != nil {
		return err
	}
	return w.file.AddShape(sheet, shape)
}

func (w *visualDashboardWriter) printPicture(sheet string, box reportprint.Box, offset float64, extension string, data []byte, label string) error {
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return err
	}
	col := int(math.Floor(box.X/printColumnPoints)) + 1
	row := int(math.Floor((box.Y+offset)/printRowPoints)) + 1
	cell, err := excelize.CoordinatesToCellName(col, row)
	if err != nil {
		return err
	}
	format := &excelize.GraphicOptions{AltText: label, Positioning: "oneCell", OffsetX: int(math.Round((box.X - float64(col-1)*printColumnPoints) * 4 / 3)), OffsetY: int(math.Round((box.Y + offset - float64(row-1)*printRowPoints) * 4 / 3)), ScaleX: box.Width * 4 / 3 / float64(config.Width), ScaleY: box.Height * 4 / 3 / float64(config.Height)}
	return w.file.AddPictureFromBytes(sheet, cell, &excelize.Picture{Extension: extension, File: data, Format: format})
}
