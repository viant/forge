package pdf

import (
	"bytes"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"codeberg.org/go-pdf/fpdf"
	reportprint "github.com/viant/forge/backend/reporting/print"
)

var deterministicCreationDate = time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)

type Options struct {
	CreationDate time.Time
}

type RenderResult struct {
	Bytes       []byte
	Diagnostics []RenderDiagnostic
}

type RenderDiagnostic struct {
	Code         string
	Severity     string
	Path         string
	Message      string
	SuggestedFix string
	PageNumber   int
	ElementID    string
}

type renderer struct {
	pdf         *fpdf.Fpdf
	diagnostics []RenderDiagnostic
}

func Render(report *reportprint.ReportPrint, options Options) (*RenderResult, error) {
	if report == nil {
		return nil, fmt.Errorf("reportPrint is required")
	}
	if err := report.Validate(); err != nil {
		return nil, err
	}
	program := buildDocumentProgram(report)
	return renderDocumentProgram(program, options)
}

func renderDocumentProgram(program *documentProgram, options Options) (*RenderResult, error) {
	if program == nil || program.report == nil {
		return nil, fmt.Errorf("documentProgram is required")
	}
	plan := buildRenderPlan(program)
	return emitRenderPlan(plan, options)
}

func emitRenderPlan(plan *renderPlan, options Options) (*RenderResult, error) {
	if plan == nil || plan.report == nil {
		return nil, fmt.Errorf("renderPlan is required")
	}
	report := plan.report
	orientation, size := resolveDocumentOrientationAndSize(report.PageGeometry)
	doc := fpdf.NewCustom(&fpdf.InitType{
		OrientationStr: orientation,
		UnitStr:        fpdf.UnitPoint,
		Size:           size,
	})
	doc.SetMargins(0, 0, 0)
	doc.SetAutoPageBreak(false, 0)
	doc.SetCatalogSort(true)
	doc.SetCompression(false)
	creationDate := resolveCreationDate(options)
	doc.SetCreationDate(creationDate)
	doc.SetModificationDate(creationDate)
	doc.SetTitle(report.Title, false)
	doc.SetFont("Helvetica", "", 10)

	engine := &renderer{
		pdf:         doc,
		diagnostics: append([]RenderDiagnostic{}, plan.diagnostics...),
	}
	for _, page := range plan.pages {
		engine.renderPagePlan(page)
	}

	if err := engine.pdf.Error(); err != nil {
		return nil, err
	}

	buffer := new(bytes.Buffer)
	if err := engine.pdf.Output(buffer); err != nil {
		return nil, err
	}
	if err := engine.pdf.Error(); err != nil {
		return nil, err
	}

	return &RenderResult{
		Bytes:       buffer.Bytes(),
		Diagnostics: engine.diagnostics,
	}, nil
}

func resolveDocumentOrientationAndSize(geometry reportprint.PageGeometry) (string, fpdf.SizeType) {
	if geometry.Width > geometry.Height {
		return fpdf.OrientationLandscape, fpdf.SizeType{
			Wd: geometry.Height,
			Ht: geometry.Width,
		}
	}
	return fpdf.OrientationPortrait, fpdf.SizeType{
		Wd: geometry.Width,
		Ht: geometry.Height,
	}
}

func resolveCreationDate(options Options) time.Time {
	if options.CreationDate.IsZero() {
		return deterministicCreationDate
	}
	return options.CreationDate.UTC()
}

func translateReportPrintDiagnostics(input []reportprint.Diagnostic) []RenderDiagnostic {
	if len(input) == 0 {
		return nil
	}
	result := make([]RenderDiagnostic, 0, len(input))
	for _, diagnostic := range input {
		path := "$.diagnostics"
		if diagnostic.PageNumber > 0 {
			path = fmt.Sprintf("$.pages[%d]", diagnostic.PageNumber-1)
		}
		result = append(result, RenderDiagnostic{
			Code:       diagnostic.Code,
			Severity:   normalizeSeverity(diagnostic.Severity),
			Path:       path,
			Message:    diagnostic.Message,
			PageNumber: diagnostic.PageNumber,
			ElementID:  diagnostic.ElementID,
		})
	}
	return result
}

func normalizeSeverity(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "error", "warning", "info":
		return normalized
	default:
		return "warning"
	}
}

func (r *renderer) renderPagePlan(page pageRenderPlan) {
	r.pdf.AddPage()
	for _, bookmark := range page.bookmarks {
		r.pdf.Bookmark(bookmark.title, bookmark.level, bookmark.y)
	}
	r.renderOperations(page.operations)
}

func (r *renderer) renderOperations(operations []renderOperation) {
	for _, operation := range operations {
		r.renderOperation(operation)
	}
}

func (r *renderer) renderOperation(operation renderOperation) {
	switch operation.kind {
	case "text":
		r.renderTextOperation(*operation.text)
	case "line":
		r.renderLineOperation(*operation.line)
	case "rect":
		r.renderRectOperation(*operation.rect)
	case "image":
		r.renderImageOperation(*operation.image)
	case "tableCellText":
		r.renderTextOperation(*operation.text)
	case "tableCellDataBar":
		r.renderTableCellDataBarOperation(*operation.dataBar)
	case "tableCellTone":
		r.renderLabelPillOperation(*operation.labelPill)
	case "tableCellBadge":
		r.renderLabelPillOperation(*operation.labelPill)
	case "svg":
		r.renderSVGProgram(operation.svg)
	}
}

func (r *renderer) renderImageOperation(operation imagePaintOperation) {
	options := fpdf.ImageOptions{
		ImageType: operation.imageType,
		ReadDpi:   true,
	}
	r.pdf.RegisterImageOptionsReader(operation.cacheKey, options, bytes.NewReader(operation.payload))
	r.pdf.ImageOptions(operation.cacheKey, operation.box.X, operation.box.Y, operation.box.Width, operation.box.Height, false, options, 0, "")
}

func (r *renderer) renderTextOperation(operation textPaintOperation) {
	r.applyTextStyle(reportprint.Element{
		FontFamily: operation.fontFamily,
		FontSize:   operation.fontSize,
		FontWeight: operation.fontWeight,
		Color:      operation.color,
	}, 10)
	r.pdf.SetXY(operation.box.X, operation.box.Y)
	align := resolveAlignment(operation.align, operation.verticalAlign)
	if operation.wrap {
		r.renderWrappedTextOperation(operation)
		return
	}
	r.pdf.CellFormat(operation.box.Width, operation.box.Height, operation.text, "", 0, align, false, 0, "")
}

func (r *renderer) renderWrappedTextOperation(operation textPaintOperation) {
	lineHeight := resolveLineHeight(operation.fontSize, 10)
	lines := r.resolveWrappedTextLines(operation.text, operation.box.Width)
	if len(lines) == 0 {
		lines = []string{""}
	}
	if operation.box.Height > 0 && lineHeight > 0 {
		maxLines := int(math.Floor(operation.box.Height / lineHeight))
		if maxLines < 1 {
			maxLines = 1
		}
		if maxLines < len(lines) {
			lines = lines[:maxLines]
		}
	}
	r.pdf.MultiCell(operation.box.Width, lineHeight, strings.Join(lines, "\n"), "", horizontalAlignment(operation.align), false)
}

func (r *renderer) resolveWrappedTextLines(text string, width float64) []string {
	if width <= 0 {
		return []string{text}
	}
	paragraphs := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	lines := make([]string, 0, len(paragraphs))
	for _, paragraph := range paragraphs {
		if paragraph == "" {
			lines = append(lines, "")
			continue
		}
		lines = append(lines, r.pdf.SplitText(paragraph, width)...)
	}
	return lines
}

func (r *renderer) renderLineOperation(operation linePaintOperation) {
	if operation.strokeWidth <= 0 {
		return
	}
	r.applyDrawColor(operation.strokeColor)
	r.pdf.SetLineWidth(operation.strokeWidth)
	r.pdf.SetDashPattern(operation.dashPattern, 0)
	r.pdf.Line(operation.x1, operation.y1, operation.x2, operation.y2)
	r.pdf.SetDashPattern(nil, 0)
}

func (r *renderer) renderRectOperation(operation reportRectPaintOperation) {
	r.applyOptionalFillColor(operation.fillColor)
	r.applyOptionalDrawColor(operation.strokeColor)
	if operation.strokeWidth > 0 {
		r.pdf.SetLineWidth(operation.strokeWidth)
	}
	if operation.style == "" {
		return
	}
	if operation.radius > 0 {
		r.pdf.RoundedRect(operation.box.X, operation.box.Y, operation.box.Width, operation.box.Height, operation.radius, "1234", operation.style)
		return
	}
	r.pdf.Rect(operation.box.X, operation.box.Y, operation.box.Width, operation.box.Height, operation.style)
}

func (r *renderer) renderTableCellDataBarOperation(operation dataBarPaintOperation) {
	if operation.box.Width <= 0 || operation.box.Height <= 0 {
		return
	}
	// ReportPrint lowering already resolves the proportional bar geometry into
	// absolute print-space width. Value/min/max remain on the element for
	// provenance and diagnostics, not for a second scaling pass here.
	r.applyOptionalFillColor(operation.fillColor)
	r.pdf.Rect(operation.box.X, operation.box.Y, operation.box.Width, operation.box.Height, "F")
}

func (r *renderer) renderLabelPillOperation(operation labelPillPaintOperation) {
	if operation.box.Width > 0 && operation.box.Height > 0 && operation.style != "" {
		r.applyOptionalFillColor(operation.backgroundColor)
		r.applyOptionalDrawColor(operation.borderColor)
		if operation.borderWidth > 0 {
			r.pdf.SetLineWidth(operation.borderWidth)
		}
		r.pdf.RoundedRect(
			operation.box.X,
			operation.box.Y,
			operation.box.Width,
			operation.box.Height,
			operation.radius,
			"1234",
			operation.style,
		)
	}
	r.applyTextStyle(operation.textStyle, 10)
	r.pdf.SetXY(operation.box.X, operation.box.Y)
	r.pdf.CellFormat(operation.box.Width, operation.box.Height, operation.label, "", 0, "CM", false, 0, "")
}

func resolveTableCellLabelTextStyle(element reportprint.Element) reportprint.Element {
	color := element.TextColor
	if !hasPaintValue(color) {
		color = element.Color
	}
	weight := strings.TrimSpace(element.FontWeight)
	if weight == "" {
		weight = "600"
	}
	return reportprint.Element{
		FontFamily: element.FontFamily,
		FontSize:   element.FontSize,
		FontWeight: weight,
		Color:      color,
	}
}

func (r *renderer) addDiagnostic(diagnostic RenderDiagnostic) {
	r.diagnostics = append(r.diagnostics, diagnostic)
}

func (r *renderer) applyTextStyle(element reportprint.Element, defaultSize float64) {
	fontFamily := "Helvetica"
	switch strings.ToLower(strings.TrimSpace(element.FontFamily)) {
	case "", "helvetica", "arial":
		fontFamily = "Helvetica"
	case "courier":
		fontFamily = "Courier"
	case "times", "times-roman":
		fontFamily = "Times"
	default:
		fontFamily = "Helvetica"
	}
	style := fontStyle(element.FontWeight)
	size := element.FontSize
	if size <= 0 {
		size = defaultSize
	}
	r.pdf.SetFont(fontFamily, style, size)
	r.applyTextColor(element.Color)
}

func fontStyle(weight string) string {
	normalized := strings.ToLower(strings.TrimSpace(weight))
	if normalized == "" {
		return ""
	}
	var style strings.Builder
	if strings.Contains(normalized, "italic") || strings.Contains(normalized, "oblique") {
		style.WriteString("I")
	}
	if strings.Contains(normalized, "bold") {
		style.WriteString("B")
		return style.String()
	}
	if numeric, err := strconv.Atoi(normalized); err == nil && numeric >= 600 {
		style.WriteString("B")
	}
	return style.String()
}

func resolveLineHeight(size float64, fallback float64) float64 {
	if size <= 0 {
		size = fallback
	}
	return size * 1.2
}

func resolveAlignment(horizontal string, vertical string) string {
	return horizontalAlignment(horizontal) + verticalAlignment(vertical)
}

func horizontalAlignment(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "center":
		return "C"
	case "right":
		return "R"
	default:
		return "L"
	}
}

func verticalAlignment(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "top":
		return "T"
	case "bottom":
		return "B"
	default:
		return "M"
	}
}

func resolveRectStyle(fillColor string, strokeColor string, strokeWidth float64) string {
	hasFill := hasPaintValue(fillColor)
	hasStroke := hasPaintValue(strokeColor) && strokeWidth > 0
	switch {
	case hasFill && hasStroke:
		return "DF"
	case hasFill:
		return "F"
	case hasStroke:
		return "D"
	default:
		return ""
	}
}

func hasPaintValue(value string) bool {
	normalized := strings.ToLower(strings.TrimSpace(value))
	return normalized != "" && normalized != "none"
}

func (r *renderer) applyTextColor(value string) {
	red, green, blue := parseHexColor(value, 0, 0, 0)
	r.pdf.SetTextColor(red, green, blue)
}

func (r *renderer) applyDrawColor(value string) {
	red, green, blue := parseHexColor(value, 0, 0, 0)
	r.pdf.SetDrawColor(red, green, blue)
}

func (r *renderer) applyOptionalDrawColor(value string) {
	if !hasPaintValue(value) {
		return
	}
	r.applyDrawColor(value)
}

func (r *renderer) applyOptionalFillColor(value string) {
	if !hasPaintValue(value) {
		return
	}
	red, green, blue := parseHexColor(value, 255, 255, 255)
	r.pdf.SetFillColor(red, green, blue)
}

func parseHexColor(value string, fallbackRed int, fallbackGreen int, fallbackBlue int) (int, int, int) {
	normalized := strings.TrimPrefix(strings.TrimSpace(value), "#")
	if len(normalized) == 3 {
		normalized = strings.Repeat(string(normalized[0]), 2) + strings.Repeat(string(normalized[1]), 2) + strings.Repeat(string(normalized[2]), 2)
	}
	if len(normalized) == 4 {
		normalized = strings.Repeat(string(normalized[0]), 2) + strings.Repeat(string(normalized[1]), 2) + strings.Repeat(string(normalized[2]), 2)
	}
	if len(normalized) == 8 {
		normalized = normalized[:6]
	}
	if len(normalized) != 6 {
		return fallbackRed, fallbackGreen, fallbackBlue
	}
	red, err := strconv.ParseInt(normalized[0:2], 16, 0)
	if err != nil {
		return fallbackRed, fallbackGreen, fallbackBlue
	}
	green, err := strconv.ParseInt(normalized[2:4], 16, 0)
	if err != nil {
		return fallbackRed, fallbackGreen, fallbackBlue
	}
	blue, err := strconv.ParseInt(normalized[4:6], 16, 0)
	if err != nil {
		return fallbackRed, fallbackGreen, fallbackBlue
	}
	return int(red), int(green), int(blue)
}

func minFloat(left float64, right float64) float64 {
	if left < right {
		return left
	}
	return right
}
