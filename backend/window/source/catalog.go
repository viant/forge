// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"context"
	"log"
	"path"
	"path/filepath"
	"reflect"
	"strings"

	forgeTypes "github.com/viant/forge/backend/types"
	wsmeta "github.com/viant/forge/backend/window/source/internal/meta"
)

// workspaceCatalog indexes every workspace Forge asset by identity. It is the
// pool the loader selects from; nothing in it is attached to a window unless
// the window's resource assignment (or a transitive dependency) asks for it.
type workspaceCatalog struct {
	dataSources     map[string]forgeTypes.DataSource
	dataSourcePaths map[string]string
	dialogs         map[string]workspaceDialogAsset
	// registries are model files keyed by their path relative to the models
	// root without extension, e.g. "advertiser" or "campaign/flights".
	registries map[string]*modelRegistry
	schemas    map[string]catalogSchema
	models     map[string]catalogModel
	// conflicted names were declared with different shapes by multiple
	// registries and are quarantined until the workspace resolves them.
	conflictedSchemas map[string]bool
	conflictedModels  map[string]bool
}

type modelRegistry struct {
	name           string
	path           string
	Schemas        map[string]forgeTypes.ResourceSchema `yaml:"schemas"`
	ResourceModels map[string]forgeTypes.ResourceModel  `yaml:"resourceModels"`
}

type catalogSchema struct {
	schema   forgeTypes.ResourceSchema
	registry string
}

type catalogModel struct {
	model    forgeTypes.ResourceModel
	registry string
}

type workspaceDialogAsset struct {
	path   string
	dialog forgeTypes.Dialog
}

func newWorkspaceCatalog() *workspaceCatalog {
	return &workspaceCatalog{
		dataSources:       map[string]forgeTypes.DataSource{},
		dataSourcePaths:   map[string]string{},
		dialogs:           map[string]workspaceDialogAsset{},
		registries:        map[string]*modelRegistry{},
		schemas:           map[string]catalogSchema{},
		models:            map[string]catalogModel{},
		conflictedSchemas: map[string]bool{},
		conflictedModels:  map[string]bool{},
	}
}

func loadWorkspaceCatalog(ctx context.Context, svc *wsmeta.Service) (*workspaceCatalog, error) {
	catalog := newWorkspaceCatalog()
	dataSources, paths, err := loadWorkspaceDataSources(ctx, svc)
	if err != nil {
		return nil, err
	}
	catalog.dataSources = dataSources
	catalog.dataSourcePaths = paths
	dialogs, err := loadWorkspaceDialogs(ctx, svc)
	if err != nil {
		return nil, err
	}
	for _, asset := range dialogs {
		id := strings.TrimSpace(asset.dialog.Id)
		if id == "" {
			continue
		}
		if _, exists := catalog.dialogs[id]; exists {
			log.Printf("workspace forge: skipping duplicate dialog id %q from %s", id, workspaceAssetPath(asset.path))
			continue
		}
		catalog.dialogs[id] = asset
	}
	if err := catalog.loadModelRegistries(ctx, svc); err != nil {
		return nil, err
	}
	return catalog, nil
}

func (c *workspaceCatalog) loadModelRegistries(ctx context.Context, svc *wsmeta.Service) error {
	paths, err := svc.ListRecursive(ctx, "extension/forge/models")
	if err != nil {
		return nil
	}
	for _, modelPath := range paths {
		registry := &modelRegistry{path: modelPath, name: modelRegistryName(modelPath)}
		if err := svc.Load(ctx, modelPath, registry); err != nil {
			log.Printf("workspace forge: skipping invalid resource model asset %s: %v", workspaceAssetPath(modelPath), err)
			continue
		}
		// Global model files are lazy assets. Validate each registry before it
		// enters the catalog so an invalid Advertiser (or Campaign/Order)
		// registry cannot make an unrelated requested window fail. A window that
		// actually assigns or references a quarantined model still fails closed
		// during assignment resolution or final effective-window validation.
		probe := &forgeTypes.Window{Schemas: registry.Schemas, ResourceModels: registry.ResourceModels}
		if err := forgeTypes.ValidateResourceModelStructure(probe); err != nil {
			log.Printf("workspace forge: quarantining invalid resource model asset %s: %v", workspaceAssetPath(modelPath), err)
			continue
		}
		if _, exists := c.registries[registry.name]; exists {
			log.Printf("workspace forge: skipping duplicate resource model registry %q from %s", registry.name, workspaceAssetPath(modelPath))
			continue
		}
		c.registries[registry.name] = registry
		for name, schema := range registry.Schemas {
			if c.conflictedSchemas[name] {
				continue
			}
			if existing, ok := c.schemas[name]; ok {
				if reflect.DeepEqual(existing.schema, schema) {
					continue
				}
				log.Printf("workspace forge: quarantining conflicting resource schema %q from %s and %s", name, workspaceAssetPath(c.registries[existing.registry].path), workspaceAssetPath(modelPath))
				delete(c.schemas, name)
				c.conflictedSchemas[name] = true
				continue
			}
			c.schemas[name] = catalogSchema{schema: schema, registry: registry.name}
		}
		for name, model := range registry.ResourceModels {
			if c.conflictedModels[name] {
				continue
			}
			if existing, ok := c.models[name]; ok {
				if reflect.DeepEqual(existing.model, model) {
					continue
				}
				log.Printf("workspace forge: quarantining conflicting resource model %q from %s and %s", name, workspaceAssetPath(c.registries[existing.registry].path), workspaceAssetPath(modelPath))
				delete(c.models, name)
				c.conflictedModels[name] = true
				continue
			}
			c.models[name] = catalogModel{model: model, registry: registry.name}
		}
	}
	return nil
}

// modelRegistryName derives the assignable registry name from a model asset
// URL or path: the path relative to extension/forge/models without extension,
// e.g. "advertiser" or "campaign/flights".
func modelRegistryName(modelPath string) string {
	normalized := stripScheme(filepath.ToSlash(modelPath))
	marker := "/" + filepath.ToSlash("extension/forge/models") + "/"
	if idx := strings.LastIndex(normalized, marker); idx >= 0 {
		normalized = normalized[idx+len(marker):]
	} else {
		normalized = path.Base(normalized)
	}
	return strings.TrimSuffix(normalized, path.Ext(normalized))
}

func stripScheme(location string) string {
	if idx := strings.Index(location, "://"); idx >= 0 {
		location = location[idx+3:]
		location = strings.TrimPrefix(location, "localhost")
	}
	return location
}

func loadWorkspaceDialogs(ctx context.Context, svc *wsmeta.Service) ([]workspaceDialogAsset, error) {
	paths, err := svc.List(ctx, "extension/forge/dialogs")
	if err != nil {
		return nil, nil
	}
	result := make([]workspaceDialogAsset, 0, len(paths))
	for _, dialogPath := range paths {
		var dialog forgeTypes.Dialog
		if err := svc.Load(ctx, filepath.Clean(dialogPath), &dialog); err != nil {
			log.Printf("workspace forge: skipping invalid dialog asset %s: %v", workspaceAssetPath(dialogPath), err)
			continue
		}
		result = append(result, workspaceDialogAsset{path: dialogPath, dialog: dialog})
	}
	return result, nil
}

func loadWorkspaceDataSources(ctx context.Context, svc *wsmeta.Service) (map[string]forgeTypes.DataSource, map[string]string, error) {
	paths, err := svc.ListRecursive(ctx, "extension/forge/datasources")
	if err != nil {
		return nil, nil, nil
	}
	result := make(map[string]forgeTypes.DataSource, len(paths))
	sources := make(map[string]string, len(paths))
	conflicted := map[string]bool{}
	for _, dataSourcePath := range paths {
		var identity struct {
			ID string `yaml:"id"`
		}
		if err := svc.Load(ctx, dataSourcePath, &identity); err != nil {
			log.Printf("workspace forge: skipping invalid datasource identity %s: %v", workspaceAssetPath(dataSourcePath), err)
			continue
		}
		var dataSource forgeTypes.DataSource
		if err := svc.Load(ctx, dataSourcePath, &dataSource); err != nil {
			log.Printf("workspace forge: skipping invalid datasource asset %s: %v", workspaceAssetPath(dataSourcePath), err)
			continue
		}
		id := strings.TrimSpace(identity.ID)
		if id == "" && strings.TrimSpace(dataSource.DataSourceRef) != "" {
			id = strings.TrimSpace(dataSource.DataSourceRef)
		}
		if id == "" {
			id = strings.TrimSpace(filepath.Base(strings.TrimSuffix(dataSourcePath, filepath.Ext(dataSourcePath))))
		}
		if id == "" {
			continue
		}
		if conflicted[id] {
			log.Printf("workspace forge: skipping additional duplicate datasource id %q from %s", id, workspaceAssetPath(dataSourcePath))
			continue
		}
		dataSource = forgeTypes.ProjectNativeDataSource(id, dataSource)
		if _, exists := result[id]; exists {
			log.Printf("workspace forge: quarantining duplicate datasource id %q from %s and %s", id, workspaceAssetPath(sources[id]), workspaceAssetPath(dataSourcePath))
			delete(result, id)
			delete(sources, id)
			conflicted[id] = true
			continue
		}
		result[id] = dataSource
		sources[id] = dataSourcePath
	}
	return result, sources, nil
}

func workspaceAssetPath(assetPath string) string {
	cleaned := filepath.Clean(stripScheme(assetPath))
	return filepath.ToSlash(cleaned)
}
