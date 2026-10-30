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
		Scope *struct {
			Params json.RawMessage `json:"params"`
		} `json:"scope"`
		Datasets []struct {
			ID      string `json:"id"`
			Label   string `json:"label"`
			Title   string `json:"title"`
			Request struct {
				Options map[string]any `json:"options"`
			} `json:"request"`
		} `json:"datasets"`
		Blocks []struct {
			Kind       string `json:"kind"`
			Title      string `json:"title"`
			DatasetRef string `json:"datasetRef"`
			Hidden     bool   `json:"hidden"`
		} `json:"blocks"`
	}
	_ = json.Unmarshal(options.ReportSpec, &spec)
	type selection struct {
		caption string
		values  map[string]any
	}
	selections := []selection{}
	for index, dataset := range spec.Datasets {
		if len(dataset.Request.Options) == 0 {
			continue
		}
		caption := strings.TrimSpace(dataset.Label)
		if caption == "" {
			caption = strings.TrimSpace(dataset.Title)
		}
		if caption == "" {
			for _, block := range spec.Blocks {
				if block.DatasetRef != dataset.ID || block.Hidden || block.Kind == "filterBarBlock" || block.Kind == "refinementBarBlock" || strings.TrimSpace(block.Title) == "" {
					continue
				}
				if caption == "" || block.Kind == "tableBlock" {
					caption = strings.TrimSpace(block.Title)
				}
				if block.Kind == "tableBlock" {
					break
				}
			}
		}
		if caption == "" {
			caption = dataset.ID
			if caption == "primary" {
				caption = "Report results"
			}
			if caption == "" {
				caption = fmt.Sprintf("Report data %d", index+1)
			}
		}
		selections = append(selections, selection{caption, dataset.Request.Options})
	}
	// Materialized mobile exports carry the effective values in metadata.
	if len(selections) == 0 && len(metadata.Values) > 0 {
		selections = append(selections, selection{"Report results", metadata.Values})
	}
	type optionLine struct{ name, label, display, caption string }
	entries := []optionLine{}
	valuesByName := map[string]map[string]bool{}
	for _, selected := range selections {
		names := make([]string, 0, len(selected.values))
		for name := range selected.values {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			// A definition list is the public control catalog. Compatibility
			// request fields absent from it must not become printed controls.
			// Authored scope controls are already rendered by the canonical
			// filter bar with their labels and choice labels. Their presence
			// also declares the public catalog: fixed dataset inputs must not
			// become extra controls merely because reportOptions is absent.
			visible := len(metadata.Definitions) == 0 && (spec.Scope == nil || len(spec.Scope.Params) == 0)
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
			value := selected.values[name]
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
			encoded, _ := json.Marshal(value)
			if valuesByName[name] == nil {
				valuesByName[name] = map[string]bool{}
			}
			valuesByName[name][string(encoded)] = true
			entries = append(entries, optionLine{name, label, display, selected.caption})
		}
	}
	lines := []string{}
	seen := map[string]bool{}
	for _, entry := range entries {
		label := entry.label
		// A chart-local option is not a conflicting global selection. Retain
		// its authored context only when the visible effective values differ.
		if len(valuesByName[entry.name]) > 1 {
			label += " (" + entry.caption + ")"
		}
		line := label + ": " + entry.display
		if !seen[line] {
			seen[line] = true
			lines = append(lines, line)
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
	wrappedLines := []string{}
	for _, line := range lines {
		for _, wrapped := range textwrap.Lines(line, width, 10) {
			if wrapped != "" {
				wrappedLines = append(wrappedLines, wrapped)
			}
		}
	}
	// Preserve a compact context as one unit. Longer contexts retain a heading
	// on each continuation page rather than leaving unlabeled option values.
	contextHeight := float64(len(wrappedLines)+1) * 14
	pageCapacity := geometry.Height - geometry.MarginBottom - math.Max(geometry.FooterHeight+8, 22) - top
	if (contextHeight <= pageCapacity && y+contextHeight > bottom) || y+28 > bottom {
		newPage()
	}
	add := func(text, weight string) {
		page.Elements = append(page.Elements, reportprint.Element{ID: fmt.Sprintf("option_context_%d_%d", page.Number, sequence), Kind: "text", Text: text, FontSize: 10, FontWeight: weight, Box: reportprint.Box{X: geometry.MarginLeft, Y: y, Width: width, Height: 14}})
		sequence++
		y += 14
	}
	add("Report options", "700")
	for _, line := range wrappedLines {
		if y+14 > bottom {
			newPage()
			add("Report options (continued)", "700")
		}
		add(line, "")
	}
	return &result, result.Validate()
}
