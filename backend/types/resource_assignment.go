package types

import (
	"sort"
	"strings"
)

// ResourceAssignment retains authored resource links without loading their definitions.
type ResourceAssignment struct {
	DataSources    []string `yaml:"dataSources,omitempty" json:"dataSources,omitempty"`
	Dialogs        []string `yaml:"dialogs,omitempty" json:"dialogs,omitempty"`
	Models         []string `yaml:"models,omitempty" json:"models,omitempty"`
	Schemas        []string `yaml:"schemas,omitempty" json:"schemas,omitempty"`
	ResourceModels []string `yaml:"resourceModels,omitempty" json:"resourceModels,omitempty"`
}

// IsEmpty reports whether the assignment whitelists nothing.
func (a *ResourceAssignment) IsEmpty() bool {
	return a == nil || (len(a.DataSources) == 0 && len(a.Dialogs) == 0 && len(a.Models) == 0 && len(a.Schemas) == 0 && len(a.ResourceModels) == 0)
}

// Normalized returns a trimmed, de-duplicated, sorted copy; a nil receiver
// yields an empty assignment.
func (a *ResourceAssignment) Normalized() *ResourceAssignment {
	result := &ResourceAssignment{}
	if a == nil {
		return result
	}
	result.DataSources = normalizeResourceIDs(a.DataSources)
	result.Dialogs = normalizeResourceIDs(a.Dialogs)
	result.Models = normalizeResourceIDs(a.Models)
	result.Schemas = normalizeResourceIDs(a.Schemas)
	result.ResourceModels = normalizeResourceIDs(a.ResourceModels)
	return result
}

func normalizeResourceIDs(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}
