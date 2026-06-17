package pdf

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"

	"codeberg.org/go-pdf/fpdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

type svgDocument struct {
	width   float64
	height  float64
	viewBox svgViewBox
	nodes   []svgNode
}

type svgViewBox struct {
	minX   float64
	minY   float64
	width  float64
	height float64
}

type svgViewport struct {
	originX float64
	originY float64
	scaleX  float64
	scaleY  float64
	viewBox svgViewBox
}

type svgNode struct {
	kind        string
	line        *svgLine
	rect        *svgRect
	circle      *svgCircle
	path        *svgPath
	text        *svgText
	unsupported string
}

func hasUnsupportedSVGStyle(attrs []xml.Attr) bool {
	_, ok := buildSVGAttrMap(attrs)["style"]
	return ok
}

type svgLine struct {
	x1          float64
	y1          float64
	x2          float64
	y2          float64
	stroke      string
	strokeWidth float64
	opacity     float64
}

type svgRect struct {
	x             float64
	y             float64
	width         float64
	height        float64
	rx            float64
	fill          string
	stroke        string
	strokeWidth   float64
	fillOpacity   float64
	strokeOpacity float64
}

type svgCircle struct {
	cx            float64
	cy            float64
	r             float64
	fill          string
	stroke        string
	strokeWidth   float64
	fillOpacity   float64
	strokeOpacity float64
}

type svgPath struct {
	d             string
	fill          string
	stroke        string
	strokeWidth   float64
	fillOpacity   float64
	strokeOpacity float64
}

type svgText struct {
	x          float64
	y          float64
	fontSize   float64
	fill       string
	fontWeight string
	anchor     string
	value      string
	opacity    float64
}

func buildSVGRenderProgram(element reportprint.Element, pageNumber int, path string) (*svgRenderProgram, []RenderDiagnostic) {
	document, err := parseSVGDocument(element.SVG)
	if err != nil {
		return nil, []RenderDiagnostic{{
			Code:         "invalidReportPrintSVG",
			Severity:     "warning",
			Path:         path,
			Message:      fmt.Sprintf("ReportPrint PDF renderer could not parse svg content: %v", err),
			SuggestedFix: "Lower the block into the supported canonical SVG subset before exporting.",
			PageNumber:   pageNumber,
			ElementID:    element.ID,
		}}
	}
	viewport, err := buildSVGViewport(document, element.Box)
	if err != nil {
		return nil, []RenderDiagnostic{{
			Code:         "invalidReportPrintSVGViewport",
			Severity:     "warning",
			Path:         path,
			Message:      err.Error(),
			SuggestedFix: "Ensure svg width, height, and viewBox resolve to a non-zero canonical print viewport.",
			PageNumber:   pageNumber,
			ElementID:    element.ID,
		}}
	}
	operations := make([]svgPaintOperation, 0, len(document.nodes)*2)
	diagnostics := make([]RenderDiagnostic, 0)
	for index, node := range document.nodes {
		childPath := fmt.Sprintf("%s.svg[%d]", path, index)
		switch node.kind {
		case "line":
			if operation := buildSVGLinePaintOperation(*node.line, viewport); operation != nil {
				operations = append(operations, svgPaintOperation{
					kind: "line",
					line: operation,
				})
			}
		case "rect":
			operations = append(operations, buildSVGRectPaintOperations(*node.rect, viewport)...)
		case "circle":
			operations = append(operations, buildSVGCirclePaintOperations(*node.circle, viewport)...)
		case "path":
			pathOperations, pathDiagnostics := buildSVGPathPaintOperations(*node.path, viewport, childPath, pageNumber, element.ID)
			operations = append(operations, pathOperations...)
			diagnostics = append(diagnostics, pathDiagnostics...)
		case "text":
			if operation := buildSVGTextPaintOperation(*node.text, viewport); operation != nil {
				operations = append(operations, svgPaintOperation{
					kind: "text",
					text: operation,
				})
			}
		default:
			diagnostics = append(diagnostics, buildSVGUnsupportedDiagnostic(node, pageNumber, element.ID, childPath))
		}
	}
	if len(operations) == 0 {
		return nil, diagnostics
	}
	return &svgRenderProgram{
		operations: operations,
	}, diagnostics
}

func buildSVGUnsupportedDiagnostic(node svgNode, pageNumber int, elementID string, path string) RenderDiagnostic {
	if node.kind == "unsupportedGroup" {
		return RenderDiagnostic{
			Code:         "unsupportedReportPrintSVGGroup",
			Severity:     "warning",
			Path:         path,
			Message:      "ReportPrint PDF renderer does not support grouped svg content (<g>) or inherited group styling.",
			SuggestedFix: "Flatten grouped SVG markup so every supported child carries explicit geometry and styling attributes.",
			PageNumber:   pageNumber,
			ElementID:    elementID,
		}
	}
	if node.kind == "unsupportedStyle" {
		return RenderDiagnostic{
			Code:         "unsupportedReportPrintSVGStyleAttribute",
			Severity:     "warning",
			Path:         path,
			Message:      "ReportPrint PDF renderer does not support inline svg style attributes or inherited styling.",
			SuggestedFix: "Expand SVG style declarations into explicit supported attributes such as fill, stroke, font-size, and opacity.",
			PageNumber:   pageNumber,
			ElementID:    elementID,
		}
	}
	return RenderDiagnostic{
		Code:         "unsupportedReportPrintSVGChild",
		Severity:     "warning",
		Path:         path,
		Message:      fmt.Sprintf("ReportPrint PDF renderer does not support svg child <%s>.", node.unsupported),
		SuggestedFix: "Lower the svg to the current canonical subset: line, rect, circle, path, and text.",
		PageNumber:   pageNumber,
		ElementID:    elementID,
	}
}

func (r *renderer) renderSVGProgram(program *svgRenderProgram) {
	if program == nil {
		return
	}
	for _, operation := range program.operations {
		switch operation.kind {
		case "line":
			r.renderSVGLineOperation(*operation.line)
		case "rect":
			r.renderSVGRectOperation(*operation.rect)
		case "circle":
			r.renderSVGCircleOperation(*operation.circle)
		case "path":
			r.renderSVGPathOperation(*operation.path)
		case "text":
			r.renderSVGTextOperation(*operation.text)
		}
	}
}

func buildSVGPathPaintOperations(pathNode svgPath, viewport svgViewport, path string, pageNumber int, elementID string) ([]svgPaintOperation, []RenderDiagnostic) {
	svgMarkup := fmt.Sprintf(
		`<svg width="%spt" height="%spt"><path d="%s"/></svg>`,
		formatSVGScalar(viewport.viewBox.width),
		formatSVGScalar(viewport.viewBox.height),
		escapeSVGAttribute(pathNode.d),
	)
	parsed, err := fpdf.SVGBasicParse([]byte(svgMarkup))
	if err != nil {
		return nil, []RenderDiagnostic{
			{
				Code:         "invalidReportPrintSVGPath",
				Severity:     "warning",
				Path:         path,
				Message:      fmt.Sprintf("ReportPrint PDF renderer could not lower svg path: %v", err),
				SuggestedFix: "Restrict ReportPrint svg paths to the basic supported path subset.",
				PageNumber:   pageNumber,
				ElementID:    elementID,
			},
		}
	}
	operations := make([]svgPaintOperation, 0, 2)
	if hasPaintValue(pathNode.fill) {
		operations = append(operations, svgPaintOperation{
			kind: "path",
			path: &svgPathPaintOperation{
				parsed:    parsed,
				originX:   viewport.originX,
				originY:   viewport.originY,
				scaleX:    viewport.scaleX,
				scaleY:    viewport.scaleY,
				fillColor: pathNode.fill,
				opacity:   pathNode.fillOpacity,
				style:     "F",
			},
		})
	}
	if hasPaintValue(pathNode.stroke) && pathNode.strokeWidth > 0 {
		operations = append(operations, svgPaintOperation{
			kind: "path",
			path: &svgPathPaintOperation{
				parsed:      parsed,
				originX:     viewport.originX,
				originY:     viewport.originY,
				scaleX:      viewport.scaleX,
				scaleY:      viewport.scaleY,
				strokeColor: pathNode.stroke,
				strokeWidth: pathNode.strokeWidth * averageScale(viewport),
				opacity:     pathNode.strokeOpacity,
				style:       "D",
			},
		})
	}
	return operations, nil
}

func parseSVGDocument(input string) (*svgDocument, error) {
	decoder := xml.NewDecoder(strings.NewReader(input))
	document := &svgDocument{}
	rootSeen := false
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		start, ok := token.(xml.StartElement)
		if !ok {
			continue
		}
		switch start.Name.Local {
		case "svg":
			if rootSeen {
				return nil, fmt.Errorf("nested svg elements are not supported")
			}
			rootSeen = true
			width, height, viewBox, err := parseSVGRoot(start.Attr)
			if err != nil {
				return nil, err
			}
			document.width = width
			document.height = height
			document.viewBox = viewBox
		case "line":
			if hasUnsupportedSVGStyle(start.Attr) {
				document.nodes = append(document.nodes, svgNode{kind: "unsupportedStyle", unsupported: start.Name.Local})
				if err := decoder.Skip(); err != nil {
					return nil, err
				}
				continue
			}
			line, err := parseSVGLine(start.Attr)
			if err != nil {
				return nil, err
			}
			document.nodes = append(document.nodes, svgNode{kind: "line", line: &line})
		case "rect":
			if hasUnsupportedSVGStyle(start.Attr) {
				document.nodes = append(document.nodes, svgNode{kind: "unsupportedStyle", unsupported: start.Name.Local})
				if err := decoder.Skip(); err != nil {
					return nil, err
				}
				continue
			}
			rect, err := parseSVGRect(start.Attr)
			if err != nil {
				return nil, err
			}
			document.nodes = append(document.nodes, svgNode{kind: "rect", rect: &rect})
		case "circle":
			if hasUnsupportedSVGStyle(start.Attr) {
				document.nodes = append(document.nodes, svgNode{kind: "unsupportedStyle", unsupported: start.Name.Local})
				if err := decoder.Skip(); err != nil {
					return nil, err
				}
				continue
			}
			circle, err := parseSVGCircle(start.Attr)
			if err != nil {
				return nil, err
			}
			document.nodes = append(document.nodes, svgNode{kind: "circle", circle: &circle})
		case "path":
			if hasUnsupportedSVGStyle(start.Attr) {
				document.nodes = append(document.nodes, svgNode{kind: "unsupportedStyle", unsupported: start.Name.Local})
				if err := decoder.Skip(); err != nil {
					return nil, err
				}
				continue
			}
			path, err := parseSVGPath(start.Attr)
			if err != nil {
				return nil, err
			}
			document.nodes = append(document.nodes, svgNode{kind: "path", path: &path})
		case "text":
			if hasUnsupportedSVGStyle(start.Attr) {
				document.nodes = append(document.nodes, svgNode{kind: "unsupportedStyle", unsupported: start.Name.Local})
				if err := decoder.Skip(); err != nil {
					return nil, err
				}
				continue
			}
			textNode, err := parseSVGText(decoder, start)
			if err != nil {
				return nil, err
			}
			document.nodes = append(document.nodes, svgNode{kind: "text", text: &textNode})
		case "g":
			document.nodes = append(document.nodes, svgNode{kind: "unsupportedGroup", unsupported: start.Name.Local})
			if err := decoder.Skip(); err != nil {
				return nil, err
			}
		default:
			if hasUnsupportedSVGStyle(start.Attr) {
				document.nodes = append(document.nodes, svgNode{kind: "unsupportedStyle", unsupported: start.Name.Local})
			} else {
				document.nodes = append(document.nodes, svgNode{kind: "unsupported", unsupported: start.Name.Local})
			}
			if err := decoder.Skip(); err != nil {
				return nil, err
			}
		}
	}
	if !rootSeen {
		return nil, fmt.Errorf("svg root element is required")
	}
	return document, nil
}

func parseSVGRoot(attrs []xml.Attr) (float64, float64, svgViewBox, error) {
	attrMap := buildSVGAttrMap(attrs)
	width := parseSVGLength(attrMap["width"])
	height := parseSVGLength(attrMap["height"])
	viewBox, err := parseSVGViewBox(attrMap["viewBox"])
	if err != nil {
		return 0, 0, svgViewBox{}, err
	}
	if viewBox.width <= 0 && width > 0 {
		viewBox.width = width
	}
	if viewBox.height <= 0 && height > 0 {
		viewBox.height = height
	}
	return width, height, viewBox, nil
}

func buildSVGViewport(document *svgDocument, box reportprint.Box) (svgViewport, error) {
	viewBox := document.viewBox
	if viewBox.width <= 0 || viewBox.height <= 0 {
		return svgViewport{}, fmt.Errorf("ReportPrint svg viewport is empty")
	}
	if box.Width <= 0 || box.Height <= 0 {
		return svgViewport{}, fmt.Errorf("ReportPrint svg target box must have positive width and height")
	}
	scaleX := box.Width / viewBox.width
	scaleY := box.Height / viewBox.height
	return svgViewport{
		originX: box.X - (viewBox.minX * scaleX),
		originY: box.Y - (viewBox.minY * scaleY),
		scaleX:  scaleX,
		scaleY:  scaleY,
		viewBox: viewBox,
	}, nil
}

func buildSVGAttrMap(attrs []xml.Attr) map[string]string {
	result := make(map[string]string, len(attrs))
	for _, attr := range attrs {
		result[attr.Name.Local] = attr.Value
	}
	return result
}

func parseSVGLine(attrs []xml.Attr) (svgLine, error) {
	attrMap := buildSVGAttrMap(attrs)
	stroke := attrMap["stroke"]
	return svgLine{
		x1:          parseSVGLength(attrMap["x1"]),
		y1:          parseSVGLength(attrMap["y1"]),
		x2:          parseSVGLength(attrMap["x2"]),
		y2:          parseSVGLength(attrMap["y2"]),
		stroke:      stroke,
		strokeWidth: normalizeSVGStrokeWidth(parseSVGLength(attrMap["stroke-width"]), stroke),
		opacity:     resolveSVGTextOrStrokeOpacity(attrMap, "stroke", stroke),
	}, nil
}

func parseSVGRect(attrs []xml.Attr) (svgRect, error) {
	attrMap := buildSVGAttrMap(attrs)
	stroke := attrMap["stroke"]
	fill := normalizeSVGFill(attrMap["fill"])
	return svgRect{
		x:             parseSVGLength(attrMap["x"]),
		y:             parseSVGLength(attrMap["y"]),
		width:         parseSVGLength(attrMap["width"]),
		height:        parseSVGLength(attrMap["height"]),
		rx:            parseSVGLength(attrMap["rx"]),
		fill:          fill,
		stroke:        stroke,
		strokeWidth:   normalizeSVGStrokeWidth(parseSVGLength(attrMap["stroke-width"]), stroke),
		fillOpacity:   resolveSVGPaintOpacity(attrMap, "fill-opacity"),
		strokeOpacity: resolveSVGPaintOpacity(attrMap, "stroke-opacity"),
	}, nil
}

func parseSVGCircle(attrs []xml.Attr) (svgCircle, error) {
	attrMap := buildSVGAttrMap(attrs)
	stroke := attrMap["stroke"]
	fill := normalizeSVGFill(attrMap["fill"])
	return svgCircle{
		cx:            parseSVGLength(attrMap["cx"]),
		cy:            parseSVGLength(attrMap["cy"]),
		r:             parseSVGLength(attrMap["r"]),
		fill:          fill,
		stroke:        stroke,
		strokeWidth:   normalizeSVGStrokeWidth(parseSVGLength(attrMap["stroke-width"]), stroke),
		fillOpacity:   resolveSVGPaintOpacity(attrMap, "fill-opacity"),
		strokeOpacity: resolveSVGPaintOpacity(attrMap, "stroke-opacity"),
	}, nil
}

func parseSVGPath(attrs []xml.Attr) (svgPath, error) {
	attrMap := buildSVGAttrMap(attrs)
	d := strings.TrimSpace(attrMap["d"])
	if d == "" {
		return svgPath{}, fmt.Errorf("svg path d attribute is required")
	}
	stroke := attrMap["stroke"]
	fill := normalizeSVGFill(attrMap["fill"])
	return svgPath{
		d:             d,
		fill:          fill,
		stroke:        stroke,
		strokeWidth:   normalizeSVGStrokeWidth(parseSVGLength(attrMap["stroke-width"]), stroke),
		fillOpacity:   resolveSVGPaintOpacity(attrMap, "fill-opacity"),
		strokeOpacity: resolveSVGPaintOpacity(attrMap, "stroke-opacity"),
	}, nil
}

func parseSVGText(decoder *xml.Decoder, start xml.StartElement) (svgText, error) {
	attrMap := buildSVGAttrMap(start.Attr)
	fill := normalizeSVGFill(attrMap["fill"])
	node := svgText{
		x:          parseSVGLength(attrMap["x"]),
		y:          parseSVGLength(attrMap["y"]),
		fontSize:   positiveOrDefault(parseSVGLength(attrMap["font-size"]), 10),
		fill:       fill,
		fontWeight: attrMap["font-weight"],
		anchor:     strings.TrimSpace(attrMap["text-anchor"]),
		opacity:    resolveSVGTextOrStrokeOpacity(attrMap, "fill", fill),
	}
	var content strings.Builder
	depth := 0
	for {
		token, err := decoder.Token()
		if err != nil {
			if err == io.EOF {
				return svgText{}, fmt.Errorf("unterminated svg text element")
			}
			return svgText{}, err
		}
		switch typed := token.(type) {
		case xml.CharData:
			content.WriteString(string(typed))
		case xml.EndElement:
			if typed.Name.Local == "text" && depth == 0 {
				node.value = strings.TrimSpace(content.String())
				return node, nil
			}
			if depth > 0 {
				depth--
			}
		case xml.StartElement:
			depth++
		}
	}
}

func parseSVGViewBox(value string) (svgViewBox, error) {
	normalized := strings.ReplaceAll(strings.TrimSpace(value), ",", " ")
	if normalized == "" {
		return svgViewBox{}, nil
	}
	parts := strings.Fields(normalized)
	if len(parts) != 4 {
		return svgViewBox{}, fmt.Errorf("invalid svg viewBox %q", value)
	}
	minX, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		return svgViewBox{}, err
	}
	minY, err := strconv.ParseFloat(parts[1], 64)
	if err != nil {
		return svgViewBox{}, err
	}
	width, err := strconv.ParseFloat(parts[2], 64)
	if err != nil {
		return svgViewBox{}, err
	}
	height, err := strconv.ParseFloat(parts[3], 64)
	if err != nil {
		return svgViewBox{}, err
	}
	return svgViewBox{
		minX:   minX,
		minY:   minY,
		width:  width,
		height: height,
	}, nil
}

func parseSVGLength(value string) float64 {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return 0
	}
	multiplier := 1.0
	switch {
	case strings.HasSuffix(normalized, "pt"):
		normalized = strings.TrimSpace(strings.TrimSuffix(normalized, "pt"))
		multiplier = 96.0 / 72.0
	case strings.HasSuffix(normalized, "px"):
		normalized = strings.TrimSpace(strings.TrimSuffix(normalized, "px"))
	case strings.HasSuffix(normalized, "mm"):
		normalized = strings.TrimSpace(strings.TrimSuffix(normalized, "mm"))
		multiplier = 96.0 / 25.4
	case strings.HasSuffix(normalized, "cm"):
		normalized = strings.TrimSpace(strings.TrimSuffix(normalized, "cm"))
		multiplier = 96.0 / 2.54
	case strings.HasSuffix(normalized, "in"):
		normalized = strings.TrimSpace(strings.TrimSuffix(normalized, "in"))
		multiplier = 96.0
	case strings.HasSuffix(normalized, "pc"):
		normalized = strings.TrimSpace(strings.TrimSuffix(normalized, "pc"))
		multiplier = 16.0
	}
	parsed, err := strconv.ParseFloat(normalized, 64)
	if err != nil {
		return 0
	}
	return parsed * multiplier
}

func positiveOrDefault(value float64, fallback float64) float64 {
	if value > 0 {
		return value
	}
	return fallback
}

func normalizeSVGStrokeWidth(width float64, stroke string) float64 {
	if width > 0 {
		return width
	}
	if hasPaintValue(stroke) {
		return 1
	}
	return 0
}

func normalizeSVGFill(fill string) string {
	normalized := strings.TrimSpace(fill)
	if normalized == "" {
		return "#000000"
	}
	return normalized
}

func resolveSVGPaintOpacity(attrMap map[string]string, key string) float64 {
	overall, _ := parseSVGOpacityValue(attrMap["opacity"])
	channel, _ := parseSVGOpacityValue(attrMap[key])
	return overall * channel
}

func resolveSVGTextOrStrokeOpacity(attrMap map[string]string, role string, paint string) float64 {
	if !hasPaintValue(paint) {
		return 0
	}
	if role == "fill" {
		return resolveSVGPaintOpacity(attrMap, "fill-opacity")
	}
	return resolveSVGPaintOpacity(attrMap, "stroke-opacity")
}

func parseSVGOpacityValue(value string) (float64, bool) {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return 1, false
	}
	if strings.HasSuffix(normalized, "%") {
		percentage, err := strconv.ParseFloat(strings.TrimSuffix(normalized, "%"), 64)
		if err != nil {
			return 1, false
		}
		normalizedValue := percentage / 100
		if normalizedValue < 0 {
			normalizedValue = 0
		}
		if normalizedValue > 1 {
			normalizedValue = 1
		}
		return normalizedValue, true
	}
	parsed, err := strconv.ParseFloat(normalized, 64)
	if err != nil {
		return 1, false
	}
	if parsed < 0 {
		parsed = 0
	}
	if parsed > 1 {
		parsed = 1
	}
	return parsed, true
}

func buildSVGLinePaintOperation(line svgLine, viewport svgViewport) *svgLinePaintOperation {
	if !hasPaintValue(line.stroke) || line.strokeWidth <= 0 {
		return nil
	}
	return &svgLinePaintOperation{
		x1:          svgX(viewport, line.x1),
		y1:          svgY(viewport, line.y1),
		x2:          svgX(viewport, line.x2),
		y2:          svgY(viewport, line.y2),
		stroke:      line.stroke,
		strokeWidth: line.strokeWidth * averageScale(viewport),
		opacity:     line.opacity,
	}
}

func buildSVGRectPaintOperations(rect svgRect, viewport svgViewport) []svgPaintOperation {
	if rect.width <= 0 || rect.height <= 0 {
		return nil
	}
	box := reportprint.Box{
		X:      svgX(viewport, rect.x),
		Y:      svgY(viewport, rect.y),
		Width:  rect.width * viewport.scaleX,
		Height: rect.height * viewport.scaleY,
	}
	radius := rect.rx * minFloat(viewport.scaleX, viewport.scaleY)
	operations := make([]svgPaintOperation, 0, 2)
	if hasPaintValue(rect.fill) {
		operations = append(operations, svgPaintOperation{
			kind: "rect",
			rect: &svgRectPaintOperation{
				box:       box,
				radius:    radius,
				fillColor: rect.fill,
				opacity:   rect.fillOpacity,
				style:     "F",
			},
		})
	}
	if hasPaintValue(rect.stroke) && rect.strokeWidth > 0 {
		operations = append(operations, svgPaintOperation{
			kind: "rect",
			rect: &svgRectPaintOperation{
				box:         box,
				radius:      radius,
				strokeColor: rect.stroke,
				strokeWidth: rect.strokeWidth * averageScale(viewport),
				opacity:     rect.strokeOpacity,
				style:       "D",
			},
		})
	}
	return operations
}

func buildSVGCirclePaintOperations(circle svgCircle, viewport svgViewport) []svgPaintOperation {
	if circle.r <= 0 {
		return nil
	}
	operations := make([]svgPaintOperation, 0, 2)
	centerX := svgX(viewport, circle.cx)
	centerY := svgY(viewport, circle.cy)
	radiusX := circle.r * viewport.scaleX
	radiusY := circle.r * viewport.scaleY
	if hasPaintValue(circle.fill) {
		operations = append(operations, svgPaintOperation{
			kind: "circle",
			circle: &svgCirclePaintOperation{
				centerX:   centerX,
				centerY:   centerY,
				radiusX:   radiusX,
				radiusY:   radiusY,
				fillColor: circle.fill,
				opacity:   circle.fillOpacity,
				style:     "F",
			},
		})
	}
	if hasPaintValue(circle.stroke) && circle.strokeWidth > 0 {
		operations = append(operations, svgPaintOperation{
			kind: "circle",
			circle: &svgCirclePaintOperation{
				centerX:     centerX,
				centerY:     centerY,
				radiusX:     radiusX,
				radiusY:     radiusY,
				strokeColor: circle.stroke,
				strokeWidth: circle.strokeWidth * averageScale(viewport),
				opacity:     circle.strokeOpacity,
				style:       "D",
			},
		})
	}
	return operations
}

func buildSVGTextPaintOperation(textNode svgText, viewport svgViewport) *svgTextPaintOperation {
	if !hasPaintValue(textNode.fill) {
		return nil
	}
	return &svgTextPaintOperation{
		x:          svgX(viewport, textNode.x),
		y:          svgY(viewport, textNode.y),
		fontSize:   textNode.fontSize * minFloat(viewport.scaleX, viewport.scaleY),
		fill:       textNode.fill,
		fontWeight: textNode.fontWeight,
		anchor:     textNode.anchor,
		value:      textNode.value,
		opacity:    textNode.opacity,
	}
}

func (r *renderer) withAlpha(alpha float64, render func()) {
	if alpha <= 0 {
		return
	}
	if alpha < 1 {
		r.pdf.SetAlpha(alpha, "Normal")
		defer r.pdf.SetAlpha(1, "Normal")
	}
	render()
}

func (r *renderer) renderSVGLineOperation(line svgLinePaintOperation) {
	r.withAlpha(line.opacity, func() {
		r.applyDrawColor(line.stroke)
		r.pdf.SetLineWidth(line.strokeWidth)
		r.pdf.SetDashPattern(nil, 0)
		r.pdf.Line(line.x1, line.y1, line.x2, line.y2)
	})
}

func (r *renderer) renderSVGRectOperation(rect svgRectPaintOperation) {
	r.withAlpha(rect.opacity, func() {
		r.renderRectOperation(reportRectPaintOperation{
			box:         rect.box,
			fillColor:   rect.fillColor,
			strokeColor: rect.strokeColor,
			strokeWidth: rect.strokeWidth,
			radius:      rect.radius,
			style:       rect.style,
		})
	})
}

func (r *renderer) renderSVGCircleOperation(circle svgCirclePaintOperation) {
	if circle.style == "" {
		return
	}
	r.withAlpha(circle.opacity, func() {
		r.applyOptionalFillColor(circle.fillColor)
		r.applyOptionalDrawColor(circle.strokeColor)
		if circle.strokeWidth > 0 {
			r.pdf.SetLineWidth(circle.strokeWidth)
		}
		if math.Abs(circle.radiusX-circle.radiusY) <= 0.001 {
			r.pdf.Circle(circle.centerX, circle.centerY, circle.radiusX, circle.style)
			return
		}
		r.pdf.Ellipse(circle.centerX, circle.centerY, circle.radiusX, circle.radiusY, 0, circle.style)
	})
}

func (r *renderer) renderSVGTextOperation(textNode svgTextPaintOperation) {
	r.withAlpha(textNode.opacity, func() {
		r.applyTextStyle(reportprint.Element{
			FontSize:   textNode.fontSize,
			Color:      textNode.fill,
			FontWeight: textNode.fontWeight,
		}, 10)
		x := textNode.x
		y := textNode.y
		width := r.pdf.GetStringWidth(textNode.value)
		switch strings.ToLower(strings.TrimSpace(textNode.anchor)) {
		case "middle":
			x -= width / 2
		case "end":
			x -= width
		}
		r.pdf.Text(x, y, textNode.value)
	})
}

func (r *renderer) renderSVGPathOperation(pathProgram svgPathPaintOperation) {
	renderPath := func(style string) {
		r.pdf.SetXY(pathProgram.originX, pathProgram.originY)
		transformed := math.Abs(pathProgram.scaleX-1) > 0.001 || math.Abs(pathProgram.scaleY-1) > 0.001
		if transformed {
			r.pdf.TransformBegin()
			r.pdf.TransformScale(pathProgram.scaleX*100, pathProgram.scaleY*100, pathProgram.originX, pathProgram.originY)
		}
		r.pdf.SVGBasicDraw(&pathProgram.parsed, 1, style)
		if transformed {
			r.pdf.TransformEnd()
		}
	}
	r.withAlpha(pathProgram.opacity, func() {
		if pathProgram.style == "F" {
			r.applyOptionalFillColor(pathProgram.fillColor)
			r.applyOptionalDrawColor("")
			renderPath(pathProgram.style)
			return
		}
		if pathProgram.style == "D" {
			r.applyOptionalDrawColor(pathProgram.strokeColor)
			if pathProgram.strokeWidth > 0 {
				r.pdf.SetLineWidth(pathProgram.strokeWidth)
			}
			renderPath(pathProgram.style)
		}
	})
}

func svgX(viewport svgViewport, value float64) float64 {
	return viewport.originX + (value * viewport.scaleX)
}

func svgY(viewport svgViewport, value float64) float64 {
	return viewport.originY + (value * viewport.scaleY)
}

func averageScale(viewport svgViewport) float64 {
	return (viewport.scaleX + viewport.scaleY) / 2
}

func formatSVGScalar(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

func escapeSVGAttribute(value string) string {
	buffer := new(bytes.Buffer)
	xml.EscapeText(buffer, []byte(value))
	return strings.ReplaceAll(buffer.String(), `"`, "&quot;")
}
