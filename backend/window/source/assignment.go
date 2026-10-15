// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"context"
	"fmt"
	"sort"
	"strings"

	metaURL "github.com/viant/afs/url"
	metaSvc "github.com/viant/forge/backend/service/meta"
)

// ResourceAssignmentKey is the window metadata key that owns the explicit
// workspace resource whitelist.
const ResourceAssignmentKey = "resources"

// ResourceAssignment is the explicit, window-owned whitelist of workspace Forge
// assets a window may use. The loader attaches only the assigned assets plus
// their transitive dependencies; nothing else from the workspace leaks into the
// effective window.
//
//	resources:
//	  dataSources: [advertiser_properties, advertiser_campaigns]
//	  dialogs: [advertiserCampaignCreate]
//	  models: [advertiser]            # extension/forge/models/advertiser.yaml
//	  schemas: [advertiserFlight]     # individual schema names
//	  resourceModels: [advertiserFlight]
type ResourceAssignment struct {
	DataSources    []string `yaml:"dataSources,omitempty" json:"dataSources,omitempty"`
	Dialogs        []string `yaml:"dialogs,omitempty" json:"dialogs,omitempty"`
	Models         []string `yaml:"models,omitempty" json:"models,omitempty"`
	Schemas        []string `yaml:"schemas,omitempty" json:"schemas,omitempty"`
	ResourceModels []string `yaml:"resourceModels,omitempty" json:"resourceModels,omitempty"`
}

type resourceAssignmentHolder struct {
	Resources *ResourceAssignment `yaml:"resources,omitempty"`
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
	result.DataSources = normalizeIDs(a.DataSources)
	result.Dialogs = normalizeIDs(a.Dialogs)
	result.Models = normalizeIDs(a.Models)
	result.Schemas = normalizeIDs(a.Schemas)
	result.ResourceModels = normalizeIDs(a.ResourceModels)
	return result
}

func normalizeIDs(values []string) []string {
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

// LoadResourceAssignment resolves the same window base Forge uses for the
// supplied key/target and decodes only the window-owned resources block. It
// returns nil when the window declares no assignment.
func LoadResourceAssignment(ctx context.Context, loader *metaSvc.Service, baseURL, key, subKey string, target *metaSvc.TargetContext) (*ResourceAssignment, error) {
	if loader == nil {
		return nil, nil
	}
	subPath := "main"
	if subKey != "" {
		subPath = subKey + "/main"
	}
	filePath := metaURL.Join(baseURL, key, subPath)
	resolvedBase, err := loader.ResolveWindowBase(ctx, filePath, target)
	if err != nil && subKey == "" {
		resolvedBase, err = loader.ResolveWindowBase(ctx, metaURL.Join(baseURL, key), target)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to resolve window %s for resource assignment: %w", key, err)
	}
	return loadResourceAssignmentFromBase(ctx, loader, resolvedBase, target)
}

func loadResourceAssignmentFromBase(ctx context.Context, loader *metaSvc.Service, resolvedBase string, target *metaSvc.TargetContext) (*ResourceAssignment, error) {
	holder := &resourceAssignmentHolder{}
	if err := loader.LoadWithTarget(ctx, resolvedBase+".yaml", holder, target); err != nil {
		return nil, fmt.Errorf("failed to load resource assignment from %s: %w", resolvedBase, err)
	}
	return holder.Resources, nil
}
