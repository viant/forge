package pdf

import (
	"fmt"
	reportprint "github.com/viant/forge/backend/reporting/print"
	"strings"
	"unicode"
)

type richGlyph struct {
	text, weight string
	width        float64
}

// Rich runs share one canonical box. All horizontal advances and optional word
// wrapping use the actual selected font, not per-character geometry estimates.
func (r *renderer) renderRichTextOperation(operation textPaintOperation) {
	size := operation.fontSize
	if size <= 0 {
		size = 10
	}
	lineHeight := resolveLineHeight(size, 10)
	var lines [][]richGlyph
	line := []richGlyph{}
	width := 0.0
	flush := func() { lines = append(lines, line); line = nil; width = 0 }
	for _, run := range operation.textRuns {
		weight := run.FontWeight
		if weight == "" {
			weight = operation.fontWeight
		}
		r.applyTextStyle(reportprint.Element{FontWeight: weight, FontSize: size, Color: operation.color}, 10)
		for _, char := range strings.ReplaceAll(run.Text, "\r\n", "\n") {
			if char == '\n' {
				flush()
				continue
			}
			glyph := richGlyph{text: string(char), weight: weight, width: r.pdf.GetStringWidth(sanitizePDFText(string(char)))}
			if operation.wrap && operation.box.Width > 0 && width+glyph.width > operation.box.Width && len(line) > 0 {
				split := -1
				for i, g := range line {
					if len(g.text) > 0 && unicode.IsSpace([]rune(g.text)[0]) {
						split = i
					}
				}
				if split >= 0 {
					remaining := append([]richGlyph(nil), line[split+1:]...)
					line = line[:split]
					flush()
					line = remaining
					for _, g := range line {
						width += g.width
					}
				} else {
					flush()
				}
			}
			line = append(line, glyph)
			width += glyph.width
		}
	}
	flush()
	if operation.box.Height > 0 && float64(len(lines))*lineHeight > operation.box.Height+0.01 {
		r.pdf.SetError(fmt.Errorf("textRuns exceed the allocated text box height"))
		return
	}
	offsetY := 0.0
	if operation.verticalAlign == "middle" {
		offsetY = (operation.box.Height - float64(len(lines))*lineHeight) / 2
	} else if operation.verticalAlign == "bottom" {
		offsetY = operation.box.Height - float64(len(lines))*lineHeight
	}
	for index, glyphs := range lines {
		measured := 0.0
		for _, g := range glyphs {
			measured += g.width
		}
		y := operation.box.Y + offsetY + float64(index)*lineHeight
		x := operation.box.X
		fit := operation.box.Width > 0 && measured > operation.box.Width
		if fit {
			r.pdf.TransformBegin()
			r.pdf.TransformScaleX(100*operation.box.Width/measured, x, y)
		} else if operation.align == "right" {
			x += operation.box.Width - measured
		} else if operation.align == "center" {
			x += (operation.box.Width - measured) / 2
		}
		for i := 0; i < len(glyphs); {
			weight := glyphs[i].weight
			runWidth := 0.0
			var text strings.Builder
			for i < len(glyphs) && glyphs[i].weight == weight {
				text.WriteString(glyphs[i].text)
				runWidth += glyphs[i].width
				i++
			}
			r.applyTextStyle(reportprint.Element{FontWeight: weight, FontSize: size, Color: operation.color}, 10)
			r.pdf.SetXY(x, y)
			r.pdf.CellFormat(runWidth, lineHeight, sanitizePDFText(text.String()), "", 0, "LT", false, 0, "")
			x += runWidth
		}
		if fit {
			r.pdf.TransformEnd()
		}
	}
}
