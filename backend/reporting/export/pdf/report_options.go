package pdf

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"

	reportprint "github.com/viant/forge/backend/reporting/print"
	"github.com/viant/forge/backend/reporting/textwrap"
)

// reportOptionLines reads the existing option definitions and effective values.
// Presentation anchors affect interactive controls only. Never substitute defaults
// here: a PDF describes the values used by the request that produced its data.
func reportOptionLines(options Options) []string {
	var metadata struct {
		Definitions []struct {
			Name         string            `json:"name"`
			Hidden       bool              `json:"hidden"`
			Visible      *bool             `json:"visible"`
			Presentation json.RawMessage   `json:"presentation"`
			Label        string            `json:"label"`
			Values       []json.RawMessage `json:"values"`
		} `json:"reportOptions"`
		Values map[string]any `json:"options"`
	}
	_ = json.Unmarshal(options.Metadata, &metadata)
	var spec struct {
		Datasets []struct {
			Request struct {
				Options map[string]any `json:"options"`
			} `json:"request"`
		} `json:"datasets"`
	}
	_ = json.Unmarshal(options.ReportSpec, &spec)
	selections := []map[string]any{}
	for _, dataset := range spec.Datasets {
		if len(dataset.Request.Options) > 0 {
			selections = append(selections, dataset.Request.Options)
		}
	}
	// Fenced mobile exports contain materialized datasets; their original request
	// values travel in export metadata rather than executable datasource requests.
	if len(selections) == 0 && len(metadata.Values) > 0 {
		selections = append(selections, metadata.Values)
	}
	lines := []string{}
	seen := map[string]bool{}
	for _, selected := range selections {
		names := make([]string, 0, len(selected))
		for name := range selected {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			// A definition list is the public control catalog. Compatibility
			// request fields absent from it must not become printed controls.
			visible := len(metadata.Definitions) == 0
			for _, definition := range metadata.Definitions {
				if definition.Name != name {
					continue
				}
				visible = !definition.Hidden && (definition.Visible == nil || *definition.Visible)
				var placement string
				var presentation struct {
					Placement string `json:"placement"`
				}
				_ = json.Unmarshal(definition.Presentation, &placement)
				_ = json.Unmarshal(definition.Presentation, &presentation)
				if placement == "hidden" || presentation.Placement == "hidden" {
					visible = false
				}
				break
			}
			if !visible {
				continue
			}
			value := selected[name]
			switch value.(type) {
			case string, bool, float64:
			default:
				continue
			}
			label, display := name, fmt.Sprint(value)
			for _, definition := range metadata.Definitions {
				if definition.Name != name {
					continue
				}
				if strings.TrimSpace(definition.Label) != "" {
					label = definition.Label
				}
				for _, raw := range definition.Values {
					var entry struct {
						Value any    `json:"value"`
						Label string `json:"label"`
					}
					if json.Unmarshal(raw, &entry) == nil && entry.Label != "" {
						left, _ := json.Marshal(entry.Value)
						right, _ := json.Marshal(value)
						if string(left) == string(right) {
							display = entry.Label
							break
						}
					}
				}
				break
			}
			line := label + ": " + display
			if !seen[line] {
				seen[line] = true
				lines = append(lines, line)
			}
		}
	}
	return lines
}

// withReportOptionContext adds static context at the backend rendering boundary,
// without changing caller-owned print artifacts or moving their authored content.
func withReportOptionContext(report *reportprint.ReportPrint, options Options) (*reportprint.ReportPrint, error) {
	lines := reportOptionLines(options)
	if len(lines) == 0 {
		return report, nil
	}
	raw, err := json.Marshal(report)
	if err != nil {
		return nil, err
	}
	var result reportprint.ReportPrint
	if err = json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	geometry := result.PageGeometry
	width := geometry.Width - geometry.MarginLeft - geometry.MarginRight
	top := geometry.MarginTop + math.Max(geometry.HeaderHeight, 20) + 12
	bottom := geometry.Height - geometry.MarginBottom - math.Max(geometry.FooterHeight+8, 22)
	if width <= 0 || bottom-top < 48 {
		return nil, fmt.Errorf("report option context requires printable page space")
	}
	page := &result.Pages[len(result.Pages)-1]
	y := top
	for _, element := range page.Elements {
		y = math.Max(y, element.Box.Y+element.Box.Height+12)
	}
	for _, element := range page.FooterElements {
		bottom = math.Min(bottom, element.Box.Y-8)
	}
	sequence := 0
	newPage := func() {
		number := len(result.Pages) + 1
		result.Pages = append(result.Pages, reportprint.Page{
			Number: number, Elements: []reportprint.Element{},
			HeaderElements: []reportprint.Element{{ID: fmt.Sprintf("option_context_header_%d", number), Kind: "text", Text: result.Title, FontSize: 14, Box: reportprint.Box{X: geometry.MarginLeft, Y: geometry.MarginTop, Width: width, Height: 20}}},
			FooterElements: []reportprint.Element{{ID: fmt.Sprintf("option_context_footer_%d", number), Kind: "text", Text: fmt.Sprintf("Page %d", number), FontSize: 9, Align: "right", Box: reportprint.Box{X: geometry.MarginLeft, Y: geometry.Height - geometry.MarginBottom - 14, Width: width, Height: 14}}},
		})
		page = &result.Pages[len(result.Pages)-1]
		y = top
		bottom = geometry.Height - geometry.MarginBottom - math.Max(geometry.FooterHeight+8, 22)
	}
	if y+36 > bottom {
		newPage()
	}
	add := func(text, weight string) {
		if y+14 > bottom {
			newPage()
		}
		page.Elements = append(page.Elements, reportprint.Element{ID: fmt.Sprintf("option_context_%d_%d", page.Number, sequence), Kind: "text", Text: text, FontSize: 10, FontWeight: weight, Box: reportprint.Box{X: geometry.MarginLeft, Y: y, Width: width, Height: 14}})
		sequence++
		y += 14
	}
	add("Report options", "700")
	for _, line := range lines {
		for _, wrapped := range textwrap.Lines(line, width, 10) {
			if wrapped != "" {
				add(wrapped, "")
			}
		}
	}
	return &result, result.Validate()
}
