// Package html renders canonical report prints as self-contained HTML pages.
package html

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"html"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"regexp"
	"strings"

	reportprint "github.com/viant/forge/backend/reporting/print"
)

var colorPattern = regexp.MustCompile(`^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$`)

// Render validates a canonical ReportPrint and renders each page as SVG in a
// standalone HTML document. Embedded images and SVGs are self-contained.
func Render(report *reportprint.ReportPrint) ([]byte, error) {
	if err := report.Validate(); err != nil {
		return nil, err
	}
	if err := validateFiniteNumbers(report); err != nil {
		return nil, err
	}
	var out strings.Builder
	out.WriteString(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>`)
	out.WriteString(html.EscapeString(report.Title))
	out.WriteString(`</title><style>body{margin:0;padding:12px;background:#e9edf3;font-family:Arial,sans-serif}.page{background:white;margin:0 auto 16px;box-shadow:0 1px 5px #b5bfcd;width:100%;max-width:1000px}.page svg{display:block;width:100%;height:auto}@media print{body{padding:0;background:white}.page{box-shadow:none;break-after:page;margin:0}}</style></head><body>`)
	for _, page := range report.Pages {
		fmt.Fprintf(&out, `<div class="page"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %g %g" role="img" aria-label="Page %d of %s">`, report.PageGeometry.Width, report.PageGeometry.Height, page.Number, html.EscapeString(report.Title))
		for _, group := range [][]reportprint.Element{page.HeaderElements, page.Elements, page.FooterElements} {
			for _, element := range group {
				if err := renderElement(&out, element); err != nil {
					return nil, fmt.Errorf("page %d element %q: %w", page.Number, element.ID, err)
				}
			}
		}
		out.WriteString(`</svg></div>`)
	}
	out.WriteString(`</body></html>`)
	return []byte(out.String()), nil
}

func renderElement(out *strings.Builder, e reportprint.Element) error {
	b := e.Box
	rect := func(box reportprint.Box, fill, stroke string) {
		fmt.Fprintf(out, `<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="%s" stroke="%s" stroke-width="%g"/>`, box.X, box.Y, box.Width, box.Height, e.Radius, safeColor(fill, "none"), safeColor(stroke, "none"), e.StrokeWidth)
	}
	text := func(value string) {
		size := e.FontSize
		if size == 0 {
			size = 10
		}
		x, anchor := b.X, "start"
		switch e.Align {
		case "right":
			x, anchor = x+b.Width, "end"
		case "center":
			x, anchor = x+b.Width/2, "middle"
		}
		weight := "400"
		if e.FontWeight == "bold" || e.FontWeight == "600" || e.FontWeight == "700" {
			weight = "700"
		}
		for i, line := range strings.Split(value, "\n") {
			fmt.Fprintf(out, `<text x="%g" y="%g" font-family="Arial,sans-serif" font-size="%g" font-weight="%s" text-anchor="%s" fill="%s">%s</text>`, x, b.Y+size+float64(i)*size*1.2, size, weight, anchor, safeColor(e.Color, "#101828"), html.EscapeString(line))
		}
	}
	switch e.Kind {
	case "rect":
		rect(b, e.FillColor, e.StrokeColor)
	case "line":
		fmt.Fprintf(out, `<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%g"/>`, b.X, b.Y, b.X+b.Width, b.Y+b.Height, safeColor(e.StrokeColor, "#d0d5dd"), math.Max(e.StrokeWidth, 0.5))
	case "text", "tableCellText":
		text(e.Text)
	case "svg":
		if err := validateEmbeddedSVG(e.SVG); err != nil {
			return err
		}
		fmt.Fprintf(out, `<image x="%g" y="%g" width="%g" height="%g" href="data:image/svg+xml;base64,%s"/>`, b.X, b.Y, b.Width, b.Height, base64.StdEncoding.EncodeToString([]byte(e.SVG)))
	case "image":
		if err := validateImage(e.Image); err != nil {
			return err
		}
		fmt.Fprintf(out, `<image x="%g" y="%g" width="%g" height="%g" href="data:%s;base64,%s"/>`, b.X, b.Y, b.Width, b.Height, e.Image.MimeType, e.Image.Payload)
	case "tableCellTone":
		rect(b, e.BackgroundColor, e.BorderColor)
		text(e.Text)
	case "tableCellBadge":
		rect(b, e.BackgroundColor, e.BorderColor)
		text(e.Label)
	case "tableCellDataBar":
		rect(b, e.BackgroundColor, e.BorderColor)
		fraction := 0.0
		if e.Max > e.Min {
			fraction = math.Max(0, math.Min(1, (e.Value-e.Min)/(e.Max-e.Min)))
		}
		bar := b
		bar.Width *= fraction
		rect(bar, e.FillColor, "")
		text(e.Text)
	default:
		return fmt.Errorf("unsupported reportPrint element %q", e.Kind)
	}
	return nil
}

func safeColor(value, fallback string) string {
	if colorPattern.MatchString(value) {
		return value
	}
	return fallback
}

func validateImage(value *reportprint.Image) error {
	if value == nil || (value.MimeType != "image/png" && value.MimeType != "image/jpeg") {
		return fmt.Errorf("unsupported report image")
	}
	data, err := base64.StdEncoding.Strict().DecodeString(value.Payload)
	if err != nil {
		return fmt.Errorf("invalid report image payload: %w", err)
	}
	_, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || "image/"+format != value.MimeType {
		return fmt.Errorf("report image payload does not match %s", value.MimeType)
	}
	return nil
}

func validateFiniteNumbers(report *reportprint.ReportPrint) error {
	finite := func(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) }
	g := report.PageGeometry
	for _, v := range []float64{g.Width, g.Height, g.MarginTop, g.MarginRight, g.MarginBottom, g.MarginLeft, g.HeaderHeight, g.FooterHeight} {
		if !finite(v) {
			return fmt.Errorf("reportPrint.pageGeometry contains a non-finite number")
		}
	}
	for _, page := range report.Pages {
		for _, group := range [][]reportprint.Element{page.HeaderElements, page.Elements, page.FooterElements} {
			for _, e := range group {
				b := e.Box
				for _, v := range []float64{b.X, b.Y, b.Width, b.Height, e.FontSize, e.StrokeWidth, e.Radius, e.Value, e.Min, e.Max} {
					if !finite(v) {
						return fmt.Errorf("page %d element %q contains a non-finite number", page.Number, e.ID)
					}
				}
			}
		}
	}
	return nil
}
