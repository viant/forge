package html

import (
	"encoding/xml"
	"fmt"
	"io"
	"regexp"
	"strings"
)

const svgNamespace = "http://www.w3.org/2000/svg"

var (
	svgNumberList = regexp.MustCompile(`^[0-9eE+.,%\-\sptx]+$`)
	svgPathData   = regexp.MustCompile(`^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\-\s]+$`)
	svgTransform  = regexp.MustCompile(`^(?:(?:translate|scale|rotate|matrix|skewX|skewY)\([0-9eE+.,%\-\sptx]+\)\s*)+$`)
	svgIdentifier = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_\-]*$`)
	svgFontFamily = regexp.MustCompile(`^[a-zA-Z0-9_,\-\s]+$`)
)

var svgElements = map[string]bool{
	"svg": true, "g": true, "rect": true, "line": true, "circle": true,
	"ellipse": true, "path": true, "polyline": true, "polygon": true,
	"text": true, "tspan": true,
}

// An SVG image is rendered by the browser from a data URI. Restrict its XML to
// inert drawing primitives and attributes so no active or linked content can be
// carried into the HTML document.
func validateEmbeddedSVG(input string) error {
	decoder := xml.NewDecoder(strings.NewReader(input))
	depth, roots := 0, 0
	var names []string
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("invalid embedded SVG: %w", err)
		}
		switch value := token.(type) {
		case xml.StartElement:
			if depth == 0 {
				roots++
				if roots != 1 || value.Name.Local != "svg" {
					return fmt.Errorf("embedded SVG must have one svg root")
				}
			}
			if !svgElements[value.Name.Local] || (value.Name.Space != "" && value.Name.Space != svgNamespace) {
				return fmt.Errorf("unsupported embedded SVG element %q", value.Name.Local)
			}
			if depth > 0 && (value.Name.Local == "svg" || (value.Name.Local == "tspan" && names[depth-1] != "text" && names[depth-1] != "tspan")) {
				return fmt.Errorf("unsupported embedded SVG nesting")
			}
			for _, attr := range value.Attr {
				if err := validateSVGAttribute(attr); err != nil {
					return err
				}
			}
			names = append(names, value.Name.Local)
			depth++
		case xml.EndElement:
			depth--
			names = names[:depth]
		case xml.CharData:
			if strings.TrimSpace(string(value)) != "" && (depth == 0 || (names[depth-1] != "text" && names[depth-1] != "tspan")) {
				return fmt.Errorf("unsupported embedded SVG text content")
			}
		case xml.Comment:
			// Comments have no rendering effect.
		default:
			return fmt.Errorf("unsupported embedded SVG declaration")
		}
	}
	if roots != 1 || depth != 0 {
		return fmt.Errorf("embedded SVG must have one svg root")
	}
	return nil
}

func validateSVGAttribute(attr xml.Attr) error {
	name, value := attr.Name.Local, strings.TrimSpace(attr.Value)
	if attr.Name.Space == "" && name == "xmlns" && value == svgNamespace {
		return nil
	}
	if attr.Name.Space != "" || value == "" {
		return fmt.Errorf("unsupported embedded SVG attribute %q", name)
	}
	valid := false
	switch name {
	case "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "viewBox", "points", "stroke-width", "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity", "font-size", "dx", "dy":
		valid = svgNumberList.MatchString(value)
	case "d":
		valid = svgPathData.MatchString(value)
	case "transform":
		valid = svgTransform.MatchString(value)
	case "fill", "stroke", "color":
		valid = colorPattern.MatchString(value)
	case "text-anchor":
		valid = value == "start" || value == "middle" || value == "end"
	case "font-weight":
		valid = value == "normal" || value == "bold" || value == "400" || value == "600" || value == "700"
	case "font-family":
		valid = svgFontFamily.MatchString(value)
	case "fill-rule", "clip-rule":
		valid = value == "nonzero" || value == "evenodd"
	case "stroke-linecap":
		valid = value == "butt" || value == "round" || value == "square"
	case "stroke-linejoin":
		valid = value == "miter" || value == "round" || value == "bevel"
	case "id":
		valid = svgIdentifier.MatchString(value)
	case "style":
		valid = validateSVGStyle(value)
	}
	if !valid {
		return fmt.Errorf("unsupported embedded SVG attribute %q", name)
	}
	return nil
}

func validateSVGStyle(value string) bool {
	for _, declaration := range strings.Split(value, ";") {
		declaration = strings.TrimSpace(declaration)
		if declaration == "" {
			continue
		}
		parts := strings.SplitN(declaration, ":", 2)
		if len(parts) != 2 || strings.TrimSpace(parts[0]) == "style" {
			return false
		}
		if err := validateSVGAttribute(xml.Attr{Name: xml.Name{Local: strings.TrimSpace(parts[0])}, Value: strings.TrimSpace(parts[1])}); err != nil {
			return false
		}
	}
	return true
}
