// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"context"
	"fmt"

	metaURL "github.com/viant/afs/url"
	metaSvc "github.com/viant/forge/backend/service/meta"
	"github.com/viant/forge/backend/types"
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
type ResourceAssignment = types.ResourceAssignment

type resourceAssignmentHolder struct {
	Resources *ResourceAssignment `yaml:"resources,omitempty"`
}

func normalizeIDs(values []string) []string {
	return (&ResourceAssignment{DataSources: values}).Normalized().DataSources
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
