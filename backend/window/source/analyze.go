// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/viant/afs"
	metaURL "github.com/viant/afs/url"
	forgeHandlers "github.com/viant/forge/backend/handlers"
	metaSvc "github.com/viant/forge/backend/service/meta"
	forgeTypes "github.com/viant/forge/backend/types"
	wsmeta "github.com/viant/forge/backend/window/source/internal/meta"
)

// AssignmentReport describes the workspace assets a window definition refers to
// before any workspace asset is merged, so authors can derive the explicit
// resources block from the definition itself.
type AssignmentReport struct {
	WindowKey string
	// ResolvedBase is the window base Forge resolved for the requested target.
	ResolvedBase string
	// Declared is the resources block the window currently carries.
	Declared *ResourceAssignment
	// Suggested lists the direct references that must be assigned explicitly:
	// every workspace datasource/dialog/model/schema the YAML or action code
	// names that the window does not declare locally.
	Suggested *ResourceAssignment
	// UnknownDataSources and UnknownDialogs are referenced identities that no
	// workspace asset provides.
	UnknownDataSources []string
	UnknownDialogs     []string
	// DynamicDialogs lists action-code locations with computed dialog ids.
	DynamicDialogs []string
}

// AnalyzeWorkspaceWindowAt loads the raw workspace window definition for the
// target (without merging workspace assets) and reports which workspace assets
// it references directly.
func AnalyzeWorkspaceWindowAt(ctx context.Context, root, windowKey string, target *metaSvc.TargetContext) (*AssignmentReport, error) {
	if strings.TrimSpace(root) == "" {
		return nil, fmt.Errorf("window source root is required")
	}
	windowKey = strings.TrimSpace(windowKey)
	if windowKey == "" {
		return nil, fmt.Errorf("window key is required")
	}
	workspaceWindowRoot := "file://" + filepath.ToSlash(filepath.Join(root, "extension/forge/windows"))
	loader := metaSvc.New(afs.New(), workspaceWindowRoot)
	report := &AssignmentReport{WindowKey: windowKey}
	var window *forgeTypes.Window
	if resolvedBase, err := loader.ResolveWindowBase(ctx, metaURL.Join(workspaceWindowRoot, windowKey, "main"), target); err == nil {
		report.ResolvedBase = resolvedBase
		window, err = forgeHandlers.LoadWindowStructure(ctx, loader, workspaceWindowRoot, windowKey, "", target)
		if err != nil {
			return nil, err
		}
		if report.Declared, err = loadResourceAssignmentFromBase(ctx, loader, resolvedBase, target); err != nil {
			return nil, err
		}
		if window.Actions == nil || strings.TrimSpace(window.Actions.Code) == "" {
			if resolvedJSPath, err := loader.ResolveWindowAsset(ctx, metaURL.Join(workspaceWindowRoot, windowKey), ".js", target); err == nil {
				code, err := loader.Download(ctx, resolvedJSPath)
				if err != nil {
					return nil, err
				}
				window.SetCode(code)
			}
		}
	} else {
		svc := wsmeta.New(afs.New(), root)
		windowPath := filepath.Join("extension/forge/windows", windowKey+".yaml")
		report.ResolvedBase = strings.TrimSuffix(metaURL.Join(workspaceWindowRoot, windowKey+".yaml"), ".yaml")
		window = &forgeTypes.Window{}
		if err := svc.Load(ctx, windowPath, window); err != nil {
			return nil, err
		}
		holder := &resourceAssignmentHolder{}
		if err := svc.Load(ctx, windowPath, holder); err != nil {
			return nil, err
		}
		report.Declared = holder.Resources
		if resolvedJSPath, err := loader.ResolveWindowAsset(ctx, metaURL.Join(workspaceWindowRoot, windowKey), ".js", target); err == nil {
			code, err := loader.Download(ctx, resolvedJSPath)
			if err != nil {
				return nil, err
			}
			window.SetCode(code)
		}
	}
	if err := mergeWorkspaceWindowActionRefs(ctx, loader, workspaceWindowRoot, window, target); err != nil {
		return nil, err
	}
	catalog, err := loadWorkspaceCatalog(ctx, wsmeta.New(afs.New(), root))
	if err != nil {
		return nil, err
	}
	refs := CollectWindowReferences(window)
	suggested := &ResourceAssignment{}
	localDialogs := map[string]bool{}
	for _, dialog := range window.Dialogs {
		localDialogs[strings.TrimSpace(dialog.Id)] = true
	}
	for id := range refs.YAML.DataSources {
		if _, local := window.DataSource[id]; local {
			continue
		}
		if _, ok := catalog.dataSources[id]; ok {
			suggested.DataSources = append(suggested.DataSources, id)
		} else {
			report.UnknownDataSources = append(report.UnknownDataSources, id)
		}
	}
	for id := range refs.YAML.Dialogs {
		if localDialogs[id] {
			continue
		}
		if _, ok := catalog.dialogs[id]; ok {
			suggested.Dialogs = append(suggested.Dialogs, id)
		} else {
			report.UnknownDialogs = append(report.UnknownDialogs, id)
		}
	}
	for name := range refs.YAML.ResourceModels {
		if _, local := window.ResourceModels[name]; local {
			continue
		}
		if _, ok := catalog.models[name]; ok {
			suggested.ResourceModels = append(suggested.ResourceModels, name)
		}
	}
	for name := range refs.YAML.Schemas {
		if _, local := window.Schemas[name]; local {
			continue
		}
		if _, ok := catalog.schemas[name]; ok {
			suggested.Schemas = append(suggested.Schemas, name)
		}
	}
	for literal := range refs.Code.Literals {
		if _, ok := catalog.dialogs[literal]; ok && !localDialogs[literal] {
			suggested.Dialogs = append(suggested.Dialogs, literal)
		}
		if _, ok := catalog.dataSources[literal]; ok {
			if _, local := window.DataSource[literal]; !local {
				suggested.DataSources = append(suggested.DataSources, literal)
			}
		}
	}
	report.Suggested = suggested.Normalized()
	report.UnknownDataSources = normalizeIDs(report.UnknownDataSources)
	report.UnknownDialogs = normalizeIDs(report.UnknownDialogs)
	report.DynamicDialogs = refs.Code.DynamicDialogs
	return report, nil
}
