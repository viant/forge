package reporting

import (
	"context"
	"encoding/json"
	"strings"
	"sync"

	requestctx "github.com/viant/forge/backend/requestctx"
)

// ExecutionProgress describes admitted work only; it never carries data rows.
type ExecutionProgress struct {
	Kind         string        `json:"kind"`
	Phase        string        `json:"phase"`
	Total        int           `json:"total"`
	Completed    int           `json:"completed"`
	DatasetID    string        `json:"datasetId,omitempty"`
	DatasetLabel string        `json:"datasetLabel,omitempty"`
	DataSourceID string        `json:"dataSourceId,omitempty"`
	Tabs         []ProgressTab `json:"tabs,omitempty"`
}
type ProgressTab struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}
type datasetProgress struct {
	id, label, source string
	tabs              []ProgressTab
}
type executionProgress struct {
	mu               sync.Mutex
	total, completed int
	ctx              context.Context
}

func newExecutionProgress(ctx context.Context, total int) *executionProgress {
	p := &executionProgress{ctx: ctx, total: total}
	p.emit("planned", datasetProgress{})
	return p
}
func (p *executionProgress) emit(phase string, dataset datasetProgress) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if phase == "completed" {
		p.completed++
	}
	requestctx.EmitToolProgress(p.ctx, ExecutionProgress{Kind: "reportExecution", Phase: phase, Total: p.total, Completed: p.completed, DatasetID: dataset.id, DatasetLabel: dataset.label, DataSourceID: dataset.source, Tabs: dataset.tabs})
}
func reportProgressLabel(label, title, id string) string {
	for _, value := range []string{label, title, id} {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return ""
}

// Only explicit tab-group/section membership is reported. Position or a
// similarly named dataset is insufficient evidence of tab ownership.
func reportProgressTabs(raw json.RawMessage) map[string][]ProgressTab {
	var root struct {
		Blocks []struct {
			ID                  string   `json:"id"`
			Kind                string   `json:"kind"`
			Title               string   `json:"title"`
			NavigationLabel     string   `json:"navigationLabel"`
			SectionIDs          []string `json:"sectionIds"`
			BlockIDs            []string `json:"blockIds"`
			DatasetRef          string   `json:"datasetRef"`
			SecondaryDatasetRef string   `json:"secondaryDatasetRef"`
		} `json:"blocks"`
	}
	_ = json.Unmarshal(raw, &root)
	tabs := map[string]bool{}
	for _, b := range root.Blocks {
		if b.Kind == "tabGroupBlock" {
			for _, id := range b.SectionIDs {
				tabs[id] = true
			}
		}
	}
	result := map[string][]ProgressTab{}
	for _, section := range root.Blocks {
		if section.Kind != "sectionBlock" || !tabs[section.ID] {
			continue
		}
		owned := map[string]bool{section.ID: true}
		for _, id := range section.BlockIDs {
			owned[id] = true
		}
		tab := ProgressTab{ID: section.ID, Label: reportProgressLabel(section.NavigationLabel, section.Title, section.ID)}
		seen := map[string]bool{}
		for _, b := range root.Blocks {
			if owned[b.ID] {
				for _, id := range []string{b.DatasetRef, b.SecondaryDatasetRef} {
					if id != "" && !seen[id] {
						result[id] = append(result[id], tab)
						seen[id] = true
					}
				}
			}
		}
	}
	return result
}
