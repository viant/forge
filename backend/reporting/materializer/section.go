package materializer

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

type SectionNavigation struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// SectionPlan is derived only from the admitted effective spec. Spec is a
// complete projection: no unavailable dataset is represented as empty rows.
type SectionPlan struct {
	SectionID  string
	DatasetIDs []string
	Sections   []SectionNavigation
	Spec       json.RawMessage
}

// PlanInitialSection is deliberately conservative. Ambiguous or incomplete
// section ownership retains ordinary complete execution.
func PlanInitialSection(raw json.RawMessage, requested string) *SectionPlan {
	var root map[string]json.RawMessage
	if json.Unmarshal(raw, &root) != nil {
		return nil
	}
	var blocks []map[string]interface{}
	var datasets []map[string]interface{}
	if json.Unmarshal(root["blocks"], &blocks) != nil || json.Unmarshal(root["datasets"], &datasets) != nil || len(datasets) < 2 {
		return nil
	}
	name := func(value interface{}) string { v, _ := value.(string); return strings.TrimSpace(v) }
	list := func(value interface{}) []string {
		var out []string
		values, _ := value.([]interface{})
		for _, v := range values {
			id := name(v)
			if id == "" {
				return nil
			}
			out = append(out, id)
		}
		return out
	}
	indexed := map[string]map[string]interface{}{}
	var tabs map[string]interface{}
	for _, b := range blocks {
		id := name(b["id"])
		if id == "" || indexed[id] != nil {
			return nil
		}
		indexed[id] = b
		if name(b["kind"]) == "tabGroupBlock" {
			if tabs != nil {
				return nil
			}
			tabs = b
		}
	}
	if tabs == nil || tabs["includeUnlistedSections"] != false {
		return nil
	}
	sectionIDs := list(tabs["sectionIds"])
	if len(sectionIDs) < 2 {
		return nil
	}
	known := map[string]bool{}
	for _, d := range datasets {
		id := name(d["id"])
		if id == "" || known[id] {
			return nil
		}
		known[id] = true
	}
	seenSections := map[string]bool{}
	sections := make([]SectionNavigation, 0, len(sectionIDs))
	for _, id := range sectionIDs {
		b := indexed[id]
		if b == nil || name(b["kind"]) != "sectionBlock" || seenSections[id] || len(list(b["blockIds"])) == 0 {
			return nil
		}
		seenSections[id] = true
		label := name(b["navigationLabel"])
		if label == "" {
			label = name(b["title"])
		}
		if label == "" {
			label = id
		}
		sections = append(sections, SectionNavigation{id, label})
	}
	selected := requested
	if !seenSections[selected] {
		selected = name(tabs["defaultSectionId"])
		if !seenSections[selected] {
			selected = sectionIDs[0]
		}
	}
	children := func(b map[string]interface{}) []string {
		return append(list(b["blockIds"]), list(b["childBlockIds"])...)
	}
	var mark func(string, map[string]bool) bool
	mark = func(id string, out map[string]bool) bool {
		if out[id] {
			return true
		}
		b := indexed[id]
		if b == nil {
			return false
		}
		out[id] = true
		for _, child := range children(b) {
			if !mark(child, out) {
				return false
			}
		}
		return true
	}
	selectedBlocks := map[string]bool{}
	if !mark(selected, selectedBlocks) {
		return nil
	}
	commonBlocks := map[string]bool{}
	for _, b := range blocks {
		id := name(b["id"])
		// Exclusive section membership excludes unlisted analytical blocks.
		// ReportRuntime deliberately renders filter bars in its global toolbar,
		// regardless of section membership; only those blocks are common.
		if name(b["kind"]) == "filterBarBlock" {
			if !mark(id, commonBlocks) {
				return nil
			}
		}
	}
	// Recursively collect all declared dataset references, including comparison,
	// trend, container/visibility and scope/filter references.
	var collect func(interface{}, map[string]bool) bool
	collect = func(value interface{}, refs map[string]bool) bool {
		switch v := value.(type) {
		case map[string]interface{}:
			for key, item := range v {
				switch key {
				case "datasetRef", "secondaryDatasetRef", "comparisonDatasetRef":
					id := name(item)
					if id != "" {
						if !known[id] {
							return false
						}
						refs[id] = true
					}
				case "datasetRefs":
					for _, id := range list(item) {
						if !known[id] {
							return false
						}
						refs[id] = true
					}
				default:
					if !collect(item, refs) {
						return false
					}
				}
			}
		case []interface{}:
			for _, item := range v {
				if !collect(item, refs) {
					return false
				}
			}
		}
		return true
	}
	commonRefs := map[string]bool{}
	for id := range commonBlocks {
		if !collect(indexed[id], commonRefs) {
			return nil
		}
	}
	// Root scope controls are global. Drill/other presentation metadata is not
	// rendered source data and must not promote hidden datasets into this wave.
	if value, ok := root["scope"]; ok {
		var scope interface{}
		if json.Unmarshal(value, &scope) != nil || !collect(scope, commonRefs) {
			return nil
		}
	}
	// Validate every section's closure before choosing a narrower first wave.
	selectedRefs := map[string]bool{}
	for id := range commonRefs {
		selectedRefs[id] = true
	}
	for _, section := range sectionIDs {
		members := map[string]bool{}
		if !mark(section, members) {
			return nil
		}
		refs := map[string]bool{}
		for id := range members {
			if !collect(indexed[id], refs) {
				return nil
			}
		}
		if section == selected {
			for id := range refs {
				selectedRefs[id] = true
			}
		}
	}
	if len(selectedRefs) == 0 || len(selectedRefs) >= len(known) {
		return nil
	}
	projectedBlocks := []map[string]interface{}{}
	projectedIDs := map[string]bool{}
	for _, b := range blocks {
		id := name(b["id"])
		if selectedBlocks[id] || commonBlocks[id] {
			projectedBlocks = append(projectedBlocks, b)
			projectedIDs[id] = true
		} else if b == nil {
			return nil
		}
	}
	// Retain a valid one-section tab group; the UI receives the full navigation
	// separately, without synthesizing any pending section's data blocks.
	tabCopy := map[string]interface{}{}
	for key, value := range tabs {
		tabCopy[key] = value
	}
	tabCopy["sectionIds"] = []string{selected}
	tabCopy["defaultSectionId"] = selected
	projectedBlocks = append([]map[string]interface{}{tabCopy}, projectedBlocks...)
	projectedIDs[name(tabs["id"])] = true
	projectedDatasets := []map[string]interface{}{}
	var datasetIDs []string
	for _, d := range datasets {
		if id := name(d["id"]); selectedRefs[id] {
			projectedDatasets = append(projectedDatasets, d)
			datasetIDs = append(datasetIDs, id)
		}
	}
	root["blocks"], _ = json.Marshal(projectedBlocks)
	root["datasets"], _ = json.Marshal(projectedDatasets)
	var layout map[string]interface{}
	if json.Unmarshal(root["layoutIntent"], &layout) == nil && layout != nil {
		var order []string
		for _, id := range list(layout["blockOrder"]) {
			if projectedIDs[id] {
				order = append(order, id)
			}
		}
		layout["blockOrder"] = order
		if items, ok := layout["items"].([]interface{}); ok {
			filtered := []interface{}{}
			for _, item := range items {
				entry, _ := item.(map[string]interface{})
				if projectedIDs[name(entry["blockId"])] {
					filtered = append(filtered, item)
				}
			}
			layout["items"] = filtered
		}
		root["layoutIntent"], _ = json.Marshal(layout)
	}
	projected, err := json.Marshal(root)
	if err != nil {
		return nil
	}
	return &SectionPlan{SectionID: selected, DatasetIDs: datasetIDs, Sections: sections, Spec: projected}
}

func MaterializeSection(ctx context.Context, plan *SectionPlan, payloads map[string]json.RawMessage, presentations TablePresentations) (*Artifacts, error) {
	if plan == nil {
		return nil, fmt.Errorf("section plan required")
	}
	selected := map[string]json.RawMessage{}
	for _, id := range plan.DatasetIDs {
		payload, ok := payloads[id]
		if !ok || len(payload) == 0 {
			return nil, fmt.Errorf("section dataset unavailable: %s", id)
		}
		selected[id] = payload
	}
	var root struct {
		Blocks []struct {
			ID string `json:"id"`
		} `json:"blocks"`
	}
	if json.Unmarshal(plan.Spec, &root) != nil {
		return nil, fmt.Errorf("invalid section spec")
	}
	choices := TablePresentations{}
	for _, block := range root.Blocks {
		if value, ok := presentations[block.ID]; ok {
			choices[block.ID] = value
		}
	}
	return MaterializePresented(ctx, plan.Spec, selected, choices, true)
}
