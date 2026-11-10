// SPDX-License-Identifier: Apache-2.0
package primitive

import (
	"fmt"
	"strings"

	lookup "github.com/viant/forge/backend/lookup/contract"
)

const StarterTaskKind = "startertask"
const StarterTaskResourceName = "default"

// StarterTask describes a suggested prompt for an empty chat.
type StarterTask struct {
	AgentID         string                    `yaml:"agentId,omitempty" json:"agentId,omitempty"`
	ID              string                    `yaml:"id,omitempty" json:"id,omitempty"`
	CategoryID      string                    `yaml:"categoryId,omitempty" json:"categoryId,omitempty"`
	Title           string                    `yaml:"title,omitempty" json:"title,omitempty"`
	Prompt          string                    `yaml:"prompt,omitempty" json:"prompt,omitempty"`
	Description     string                    `yaml:"description,omitempty" json:"description,omitempty"`
	ResultLabel     string                    `yaml:"resultLabel,omitempty" json:"resultLabel,omitempty"`
	Icon            string                    `yaml:"icon,omitempty" json:"icon,omitempty"`
	CoverageEvalIDs []string                  `yaml:"coverageEvalIds,omitempty" json:"coverageEvalIds,omitempty"`
	Priority        int                       `yaml:"priority,omitempty" json:"priority,omitempty"`
	LookupLibraries []lookup.LibraryReference `yaml:"lookupLibraries,omitempty" json:"lookupLibraries,omitempty"`
}

// StarterTaskCategory describes an optional grouping for starter tasks.
type StarterTaskCategory struct {
	ID          string `yaml:"id,omitempty" json:"id,omitempty"`
	Title       string `yaml:"title,omitempty" json:"title,omitempty"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
	Icon        string `yaml:"icon,omitempty" json:"icon,omitempty"`
}

// StarterTaskEnvelope is the namespace's published set. An explicit empty
// tasks array is a configured set and suppresses the host's agent defaults.
type StarterTaskEnvelope struct {
	SchemaVersion int64                 `json:"schemaVersion" yaml:"schemaVersion"`
	Tasks         []StarterTask         `json:"tasks" yaml:"tasks"`
	Categories    []StarterTaskCategory `json:"categories,omitempty" yaml:"categories,omitempty"`
}

func (d StarterTaskEnvelope) Validate() error {
	if d.SchemaVersion != AIEnvelopeVersion || d.Tasks == nil {
		return fmt.Errorf("starter tasks require schema version %d and a tasks array", AIEnvelopeVersion)
	}
	categories := make(map[string]bool, len(d.Categories))
	for _, category := range d.Categories {
		if !validStarterTaskID(category.ID) || strings.TrimSpace(category.Title) == "" || categories[category.ID] {
			return fmt.Errorf("invalid or duplicate starter task category %q", category.ID)
		}
		categories[category.ID] = true
	}
	tasks := make(map[string]bool, len(d.Tasks))
	for _, task := range d.Tasks {
		if err := task.Validate(); err != nil {
			return err
		}
		if tasks[task.ID] || task.CategoryID != "" && !categories[task.CategoryID] {
			return fmt.Errorf("duplicate starter task or unknown category for %q", task.ID)
		}
		tasks[task.ID] = true
	}
	return nil
}

// Validate applies to newly authored namespace and personal tasks. Older agent
// defaults retain their existing decoding behavior.
func (t StarterTask) Validate() error {
	if !validStarterTaskID(t.ID) || strings.TrimSpace(t.Title) == "" || strings.TrimSpace(t.Prompt) == "" {
		return fmt.Errorf("starter task requires an ID, title and prompt")
	}
	return lookup.ValidateLibraryReferences(t.LookupLibraries, true)
}

func validStarterTaskID(id string) bool {
	return len(id) <= 128 && id != "" && strings.TrimSpace(id) == id && !strings.ContainsAny(id, "#|\t\r\n")
}
