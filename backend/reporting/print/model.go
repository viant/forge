package reportprint

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

type ReportPrint struct {
	Version      int          `json:"version"`
	Kind         string       `json:"kind"`
	SpecVersion  int          `json:"specVersion"`
	SpecHash     string       `json:"specHash"`
	FillVersion  int          `json:"fillVersion"`
	FillHash     string       `json:"fillHash"`
	Source       Source       `json:"source"`
	Title        string       `json:"title"`
	PageGeometry PageGeometry `json:"pageGeometry"`
	Pages        []Page       `json:"pages"`
	Bookmarks    []Bookmark   `json:"bookmarks"`
	Diagnostics  []Diagnostic `json:"diagnostics"`
}

type Source struct {
	Kind          string `json:"kind"`
	ContainerID   string `json:"containerId"`
	StateKey      string `json:"stateKey"`
	DataSourceRef string `json:"dataSourceRef"`
}

type PageGeometry struct {
	Width        float64 `json:"width"`
	Height       float64 `json:"height"`
	MarginTop    float64 `json:"marginTop"`
	MarginRight  float64 `json:"marginRight"`
	MarginBottom float64 `json:"marginBottom"`
	MarginLeft   float64 `json:"marginLeft"`
	HeaderHeight float64 `json:"headerHeight"`
	FooterHeight float64 `json:"footerHeight"`
}

type Page struct {
	Number         int       `json:"number"`
	Elements       []Element `json:"elements"`
	HeaderElements []Element `json:"headerElements"`
	FooterElements []Element `json:"footerElements"`
}

type Element struct {
	ID              string  `json:"id"`
	Kind            string  `json:"kind"`
	Box             Box     `json:"box"`
	ZIndex          *int    `json:"zIndex,omitempty"`
	Text            string  `json:"text,omitempty"`
	FontFamily      string  `json:"fontFamily,omitempty"`
	FontSize        float64 `json:"fontSize,omitempty"`
	FontWeight      string  `json:"fontWeight,omitempty"`
	Color           string  `json:"color,omitempty"`
	Align           string  `json:"align,omitempty"`
	VerticalAlign   string  `json:"verticalAlign,omitempty"`
	Wrap            bool    `json:"wrap,omitempty"`
	StrokeColor     string  `json:"strokeColor,omitempty"`
	StrokeWidth     float64 `json:"strokeWidth,omitempty"`
	StrokeStyle     string  `json:"strokeStyle,omitempty"`
	FillColor       string  `json:"fillColor,omitempty"`
	Radius          float64 `json:"radius,omitempty"`
	Image           *Image  `json:"image,omitempty"`
	SVG             string  `json:"svg,omitempty"`
	RowKey          string  `json:"rowKey,omitempty"`
	ColumnKey       string  `json:"columnKey,omitempty"`
	Format          string  `json:"format,omitempty"`
	Value           float64 `json:"value,omitempty"`
	Min             float64 `json:"min,omitempty"`
	Max             float64 `json:"max,omitempty"`
	BackgroundColor string  `json:"backgroundColor,omitempty"`
	BorderColor     string  `json:"borderColor,omitempty"`
	Tone            string  `json:"tone,omitempty"`
	Label           string  `json:"label,omitempty"`
	TextColor       string  `json:"textColor,omitempty"`
}

type Image struct {
	MimeType string `json:"mimeType"`
	Payload  string `json:"payload"`
}

type Box struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type Bookmark struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	PageNumber int     `json:"pageNumber"`
	Level      int     `json:"level,omitempty"`
	ElementID  string  `json:"elementId,omitempty"`
	Y          float64 `json:"y,omitempty"`
}

type Diagnostic struct {
	Code       string `json:"code"`
	Severity   string `json:"severity"`
	Message    string `json:"message"`
	PageNumber int    `json:"pageNumber,omitempty"`
	ElementID  string `json:"elementId,omitempty"`
}

func DecodeJSON(data []byte) (*ReportPrint, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var report ReportPrint
	if err := decoder.Decode(&report); err != nil {
		return nil, fmt.Errorf("decode reportPrint: %w", err)
	}
	if err := report.Validate(); err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *ReportPrint) Validate() error {
	if r == nil {
		return fmt.Errorf("reportPrint is required")
	}
	if r.Version < 1 {
		return fmt.Errorf("reportPrint.version must be >= 1")
	}
	if strings.TrimSpace(r.Kind) != "reportPrint" {
		return fmt.Errorf("reportPrint.kind must be reportPrint")
	}
	if r.SpecVersion < 1 {
		return fmt.Errorf("reportPrint.specVersion must be >= 1")
	}
	if r.FillVersion < 1 {
		return fmt.Errorf("reportPrint.fillVersion must be >= 1")
	}
	if strings.TrimSpace(r.SpecHash) == "" {
		return fmt.Errorf("reportPrint.specHash is required")
	}
	if strings.TrimSpace(r.FillHash) == "" {
		return fmt.Errorf("reportPrint.fillHash is required")
	}
	if strings.TrimSpace(r.Source.Kind) == "" || strings.TrimSpace(r.Source.ContainerID) == "" || strings.TrimSpace(r.Source.StateKey) == "" || strings.TrimSpace(r.Source.DataSourceRef) == "" {
		return fmt.Errorf("reportPrint.source.kind, containerId, stateKey, and dataSourceRef are required")
	}
	if strings.TrimSpace(r.Title) == "" {
		return fmt.Errorf("reportPrint.title is required")
	}
	if r.PageGeometry.Width <= 0 || r.PageGeometry.Height <= 0 {
		return fmt.Errorf("reportPrint.pageGeometry.width and height must be > 0")
	}
	if len(r.Pages) == 0 {
		return fmt.Errorf("reportPrint.pages must not be empty")
	}
	for index, page := range r.Pages {
		if page.Number < 1 {
			return fmt.Errorf("reportPrint.pages[%d].number must be >= 1", index)
		}
		if err := validateElements(page.Elements, fmt.Sprintf("reportPrint.pages[%d].elements", index)); err != nil {
			return err
		}
		if err := validateElements(page.HeaderElements, fmt.Sprintf("reportPrint.pages[%d].headerElements", index)); err != nil {
			return err
		}
		if err := validateElements(page.FooterElements, fmt.Sprintf("reportPrint.pages[%d].footerElements", index)); err != nil {
			return err
		}
	}
	return nil
}

func validateElements(elements []Element, location string) error {
	for index, element := range elements {
		if strings.TrimSpace(element.ID) == "" {
			return fmt.Errorf("%s[%d].id is required", location, index)
		}
		if strings.TrimSpace(element.Kind) == "" {
			return fmt.Errorf("%s[%d].kind is required", location, index)
		}
		if element.Box.Width < 0 || element.Box.Height < 0 || element.Box.X < 0 || element.Box.Y < 0 {
			return fmt.Errorf("%s[%d].box values must be >= 0", location, index)
		}
		switch strings.TrimSpace(element.Kind) {
		case "line":
			if strings.TrimSpace(element.StrokeColor) == "" {
				return fmt.Errorf("%s[%d].strokeColor is required for line elements", location, index)
			}
			if element.StrokeWidth <= 0 {
				return fmt.Errorf("%s[%d].strokeWidth must be > 0 for line elements", location, index)
			}
		case "text":
			if strings.TrimSpace(element.Text) == "" {
				return fmt.Errorf("%s[%d].text is required for text elements", location, index)
			}
		case "tableCellText":
			if strings.TrimSpace(element.RowKey) == "" || strings.TrimSpace(element.ColumnKey) == "" || strings.TrimSpace(element.Text) == "" {
				return fmt.Errorf("%s[%d].rowKey, columnKey, and text are required for tableCellText elements", location, index)
			}
		case "tableCellDataBar":
			if strings.TrimSpace(element.RowKey) == "" || strings.TrimSpace(element.ColumnKey) == "" {
				return fmt.Errorf("%s[%d].rowKey and columnKey are required for tableCellDataBar elements", location, index)
			}
		case "tableCellTone", "tableCellBadge":
			if strings.TrimSpace(element.RowKey) == "" || strings.TrimSpace(element.ColumnKey) == "" || strings.TrimSpace(element.Label) == "" {
				return fmt.Errorf("%s[%d].rowKey, columnKey, and label are required for %s elements", location, index, strings.TrimSpace(element.Kind))
			}
		case "svg":
			if strings.TrimSpace(element.SVG) == "" {
				return fmt.Errorf("%s[%d].svg is required for svg elements", location, index)
			}
		case "image":
			if element.Image == nil || strings.TrimSpace(element.Image.MimeType) == "" || strings.TrimSpace(element.Image.Payload) == "" {
				return fmt.Errorf("%s[%d].image.mimeType and image.payload are required for image elements", location, index)
			}
		}
	}
	return nil
}
