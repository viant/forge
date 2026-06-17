package pdf

import (
	"fmt"
	"strings"

	"codeberg.org/go-pdf/fpdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

type renderPlan struct {
	report      *reportprint.ReportPrint
	diagnostics []RenderDiagnostic
	pages       []pageRenderPlan
}

type pageRenderPlan struct {
	number     int
	bookmarks  []bookmarkProgram
	operations []renderOperation
}

type renderOperation struct {
	kind      string
	text      *textPaintOperation
	line      *linePaintOperation
	rect      *reportRectPaintOperation
	dataBar   *dataBarPaintOperation
	labelPill *labelPillPaintOperation
	svg       *svgRenderProgram
}

type textPaintOperation struct {
	box           reportprint.Box
	text          string
	fontFamily    string
	fontSize      float64
	fontWeight    string
	color         string
	align         string
	verticalAlign string
	wrap          bool
}

type linePaintOperation struct {
	x1          float64
	y1          float64
	x2          float64
	y2          float64
	strokeColor string
	strokeWidth float64
	dashPattern []float64
}

type reportRectPaintOperation struct {
	box         reportprint.Box
	fillColor   string
	strokeColor string
	strokeWidth float64
	radius      float64
	style       string
}

type dataBarPaintOperation struct {
	box       reportprint.Box
	fillColor string
}

type labelPillPaintOperation struct {
	box             reportprint.Box
	backgroundColor string
	borderColor     string
	borderWidth     float64
	radius          float64
	style           string
	label           string
	textStyle       reportprint.Element
}

type svgRenderProgram struct {
	operations []svgPaintOperation
}

type svgPaintOperation struct {
	kind   string
	line   *svgLinePaintOperation
	rect   *svgRectPaintOperation
	circle *svgCirclePaintOperation
	path   *svgPathPaintOperation
	text   *svgTextPaintOperation
}

type svgLinePaintOperation struct {
	x1          float64
	y1          float64
	x2          float64
	y2          float64
	stroke      string
	strokeWidth float64
	opacity     float64
}

type svgRectPaintOperation struct {
	box         reportprint.Box
	radius      float64
	fillColor   string
	strokeColor string
	strokeWidth float64
	opacity     float64
	style       string
}

type svgCirclePaintOperation struct {
	centerX     float64
	centerY     float64
	radiusX     float64
	radiusY     float64
	fillColor   string
	strokeColor string
	strokeWidth float64
	opacity     float64
	style       string
}

type svgTextPaintOperation struct {
	x          float64
	y          float64
	fontSize   float64
	fill       string
	fontWeight string
	anchor     string
	value      string
	opacity    float64
}

type svgPathPaintOperation struct {
	parsed      fpdf.SVGBasicType
	originX     float64
	originY     float64
	scaleX      float64
	scaleY      float64
	fillColor   string
	strokeColor string
	strokeWidth float64
	opacity     float64
	style       string
}

func buildRenderPlan(program *documentProgram) *renderPlan {
	if program == nil || program.report == nil {
		return nil
	}
	pages := make([]pageRenderPlan, 0, len(program.pages))
	diagnostics := append([]RenderDiagnostic{}, program.diagnostics...)
	for _, page := range program.pages {
		pagePlan, pageDiagnostics := buildPageRenderPlan(page)
		pages = append(pages, pagePlan)
		diagnostics = append(diagnostics, pageDiagnostics...)
	}
	return &renderPlan{
		report:      program.report,
		diagnostics: diagnostics,
		pages:       pages,
	}
}

func buildPageRenderPlan(page pageProgram) (pageRenderPlan, []RenderDiagnostic) {
	headerOperations, headerDiagnostics := buildRenderOperations(page.headerElements)
	bodyOperations, bodyDiagnostics := buildRenderOperations(page.elements)
	footerOperations, footerDiagnostics := buildRenderOperations(page.footerElements)
	diagnostics := append([]RenderDiagnostic{}, headerDiagnostics...)
	diagnostics = append(diagnostics, bodyDiagnostics...)
	diagnostics = append(diagnostics, footerDiagnostics...)
	return pageRenderPlan{
		number:    page.number,
		bookmarks: page.bookmarks,
		operations: append(
			append(headerOperations, bodyOperations...),
			footerOperations...,
		),
	}, diagnostics
}

func buildRenderOperations(elements []elementProgram) ([]renderOperation, []RenderDiagnostic) {
	if len(elements) == 0 {
		return nil, nil
	}
	operations := make([]renderOperation, 0, len(elements))
	diagnostics := make([]RenderDiagnostic, 0)
	for _, element := range elements {
		operation, elementDiagnostics := buildRenderOperation(element)
		if operation != nil {
			operations = append(operations, *operation)
		}
		if len(elementDiagnostics) > 0 {
			diagnostics = append(diagnostics, elementDiagnostics...)
		}
	}
	return operations, diagnostics
}

func buildRenderOperation(element elementProgram) (*renderOperation, []RenderDiagnostic) {
	kind := strings.TrimSpace(element.element.Kind)
	switch kind {
	case "text":
		return &renderOperation{
			kind: "text",
			text: buildTextPaintOperation(element.element, ""),
		}, nil
	case "line":
		return &renderOperation{
			kind: "line",
			line: buildLinePaintOperation(element.element),
		}, nil
	case "rect":
		return &renderOperation{
			kind: "rect",
			rect: buildReportRectPaintOperation(element.element),
		}, nil
	case "tableCellText":
		return &renderOperation{
			kind: "tableCellText",
			text: buildTextPaintOperation(element.element, "middle"),
		}, nil
	case "tableCellDataBar":
		return &renderOperation{
			kind:    "tableCellDataBar",
			dataBar: buildDataBarPaintOperation(element.element),
		}, nil
	case "tableCellTone", "tableCellBadge":
		return &renderOperation{
			kind:      kind,
			labelPill: buildLabelPillPaintOperation(element.element),
		}, nil
	case "svg":
		svgProgram, diagnostics := buildSVGRenderProgram(element.element, element.pageNumber, element.path)
		if svgProgram == nil {
			return nil, diagnostics
		}
		return &renderOperation{
			kind: kind,
			svg:  svgProgram,
		}, diagnostics
	case "image":
		return nil, []RenderDiagnostic{
			{
				Code:         "unsupportedReportPrintElement",
				Severity:     "warning",
				Path:         element.path,
				Message:      "ReportPrint PDF renderer does not yet support image elements.",
				SuggestedFix: "Add canonical image handling to the PDF renderer before exporting this print artifact.",
				PageNumber:   element.pageNumber,
				ElementID:    element.element.ID,
			},
		}
	default:
		return nil, []RenderDiagnostic{
			{
				Code:         "unsupportedReportPrintElement",
				Severity:     "warning",
				Path:         element.path,
				Message:      fmt.Sprintf("ReportPrint PDF renderer does not support element kind %s.", kind),
				SuggestedFix: "Lower the block into a supported ReportPrint element or extend the PDF renderer.",
				PageNumber:   element.pageNumber,
				ElementID:    element.element.ID,
			},
		}
	}
}

func buildTextPaintOperation(element reportprint.Element, defaultVerticalAlign string) *textPaintOperation {
	verticalAlign := strings.TrimSpace(element.VerticalAlign)
	if verticalAlign == "" {
		verticalAlign = strings.TrimSpace(defaultVerticalAlign)
	}
	return &textPaintOperation{
		box:           element.Box,
		text:          element.Text,
		fontFamily:    element.FontFamily,
		fontSize:      element.FontSize,
		fontWeight:    element.FontWeight,
		color:         element.Color,
		align:         element.Align,
		verticalAlign: verticalAlign,
		wrap:          element.Wrap,
	}
}

func buildLinePaintOperation(element reportprint.Element) *linePaintOperation {
	return &linePaintOperation{
		x1:          element.Box.X,
		y1:          element.Box.Y,
		x2:          element.Box.X + element.Box.Width,
		y2:          element.Box.Y + element.Box.Height,
		strokeColor: element.StrokeColor,
		strokeWidth: element.StrokeWidth,
		dashPattern: resolveLineDashPattern(element.StrokeStyle),
	}
}

func buildReportRectPaintOperation(element reportprint.Element) *reportRectPaintOperation {
	return &reportRectPaintOperation{
		box:         element.Box,
		fillColor:   element.FillColor,
		strokeColor: element.StrokeColor,
		strokeWidth: element.StrokeWidth,
		radius:      element.Radius,
		style:       resolveRectStyle(element.FillColor, element.StrokeColor, element.StrokeWidth),
	}
}

func buildDataBarPaintOperation(element reportprint.Element) *dataBarPaintOperation {
	return &dataBarPaintOperation{
		box:       element.Box,
		fillColor: element.FillColor,
	}
}

func buildLabelPillPaintOperation(element reportprint.Element) *labelPillPaintOperation {
	borderWidth := element.StrokeWidth
	if borderWidth <= 0 && hasPaintValue(element.BorderColor) {
		borderWidth = 1
	}
	return &labelPillPaintOperation{
		box:             element.Box,
		backgroundColor: element.BackgroundColor,
		borderColor:     element.BorderColor,
		borderWidth:     borderWidth,
		radius:          minFloat(element.Box.Height/2, element.Box.Width/2),
		style:           resolveRectStyle(element.BackgroundColor, element.BorderColor, borderWidth),
		label:           element.Label,
		textStyle:       resolveTableCellLabelTextStyle(element),
	}
}

func resolveLineDashPattern(value string) []float64 {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "dashed":
		return []float64{4, 2}
	case "dotted":
		return []float64{1, 2}
	default:
		return nil
	}
}
