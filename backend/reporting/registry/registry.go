package registry

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"
)

type Options struct {
	WorkspaceRoot string
	ReportingRoot string
}

// ResolveRoot resolves the singular workspace reporting root and rejects paths
// outside the workspace. This prevents a workspace configuration from turning
// recursive discovery into an arbitrary filesystem scanner.
func ResolveRoot(workspaceRoot, reportingRoot string) (string, error) {
	workspaceRoot = strings.TrimSpace(workspaceRoot)
	if workspaceRoot == "" {
		return "", fmt.Errorf("workspace root is required")
	}
	workspaceAbs, err := filepath.Abs(workspaceRoot)
	if err != nil {
		return "", fmt.Errorf("resolve workspace root: %w", err)
	}
	reportingRoot = strings.TrimSpace(reportingRoot)
	if reportingRoot == "" {
		reportingRoot = DefaultRoot
	}
	resolved := reportingRoot
	if !filepath.IsAbs(resolved) {
		resolved = filepath.Join(workspaceAbs, filepath.FromSlash(resolved))
	}
	resolved, err = filepath.Abs(resolved)
	if err != nil {
		return "", fmt.Errorf("resolve reporting root: %w", err)
	}
	if !pathWithin(workspaceAbs, resolved) {
		return "", fmt.Errorf("reporting root %q is outside workspace root %q", resolved, workspaceAbs)
	}
	if evaluated, evalErr := filepath.EvalSymlinks(resolved); evalErr == nil {
		workspaceEvaluated := workspaceAbs
		if value, workspaceErr := filepath.EvalSymlinks(workspaceAbs); workspaceErr == nil {
			workspaceEvaluated = value
		}
		if !pathWithin(workspaceEvaluated, evaluated) {
			return "", fmt.Errorf("reporting root %q resolves outside workspace root %q", resolved, workspaceAbs)
		}
	}
	return filepath.Clean(resolved), nil
}

func pathWithin(parent, candidate string) bool {
	rel, err := filepath.Rel(parent, candidate)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel)
}

func Discover(ctx context.Context, options Options) (*Registry, error) {
	root, err := ResolveRoot(options.WorkspaceRoot, options.ReportingRoot)
	if err != nil {
		return nil, err
	}
	result := newRegistry(root)
	if _, err = os.Stat(root); errors.Is(err, os.ErrNotExist) {
		return result, nil
	} else if err != nil {
		return nil, fmt.Errorf("stat reporting root: %w", err)
	}

	paths := make([]string, 0)
	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if ext == ".yaml" || ext == ".yml" {
			paths = append(paths, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("scan reporting root: %w", err)
	}
	sort.Strings(paths)

	diagnostics := make([]Diagnostic, 0)
	for _, path := range paths {
		assets, fileDiagnostics := loadAssets(options.WorkspaceRoot, path)
		diagnostics = append(diagnostics, fileDiagnostics...)
		for _, asset := range assets {
			diagnostics = append(diagnostics, result.add(asset)...)
		}
	}
	diagnostics = append(diagnostics, result.expandFragments()...)
	diagnostics = append(diagnostics, result.validateReferences()...)
	if len(diagnostics) > 0 {
		sortDiagnostics(diagnostics)
		return nil, &ValidationError{Diagnostics: diagnostics}
	}
	return result, nil
}

func newRegistry(root string) *Registry {
	return &Registry{
		Root:          root,
		buildersByID:  map[string]*Asset{},
		presetsByID:   map[string]*Asset{},
		fragmentsByID: map[string]*Asset{},
	}
}

func loadAssets(workspaceRoot, filename string) ([]*Asset, []Diagnostic) {
	relativePath, err := filepath.Rel(workspaceRoot, filename)
	if err != nil {
		relativePath = filename
	}
	relativePath = filepath.ToSlash(relativePath)
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, []Diagnostic{{Code: "assetReadFailed", Message: err.Error(), SourcePath: relativePath}}
	}
	var node yaml.Node
	if err = yaml.Unmarshal(data, &node); err != nil {
		return nil, []Diagnostic{{Code: "assetYAMLInvalid", Message: err.Error(), SourcePath: relativePath}}
	}
	var raw map[string]any
	if err = node.Decode(&raw); err != nil {
		return nil, []Diagnostic{{Code: "assetDecodeFailed", Message: err.Error(), SourcePath: relativePath}}
	}
	kind := stringValue(raw["kind"])
	if kind != KindBuilder && kind != KindPreset && kind != KindFragment && kind != legacyBuilderKind {
		return nil, nil
	}
	id := stringValue(raw["id"])
	idNode := mappingValue(documentContent(&node), "id")
	if id == "" {
		return nil, []Diagnostic{diagnosticAt("assetIDRequired", "reporting asset id is required", relativePath, "$.id", idNode)}
	}
	asset := &Asset{
		Kind:        kind,
		ID:          id,
		BuilderRef:  stringValue(raw["builderRef"]),
		Label:       firstString(raw, "label", "title"),
		Description: stringValue(raw["description"]),
		SourcePath:  relativePath,
		YAMLPath:    "$",
		Raw:         raw,
	}
	if kind == legacyBuilderKind {
		asset.Kind = KindBuilder
		asset.Legacy = true
	}
	assets := []*Asset{asset}
	diagnostics := validateAsset(asset, documentContent(&node))
	if asset.Kind == KindBuilder {
		embedded := embeddedLegacyPresets(asset)
		assets = append(assets, embedded...)
		for _, preset := range embedded {
			diagnostics = append(diagnostics, validateAsset(preset, nil)...)
		}
	}
	return assets, diagnostics
}

func embeddedLegacyPresets(builder *Asset) []*Asset {
	reportBuilder, _ := builder.Raw["reportBuilder"].(map[string]any)
	templates, _ := reportBuilder["reportDocumentTemplates"].([]any)
	result := make([]*Asset, 0, len(templates))
	for index, item := range templates {
		raw, ok := item.(map[string]any)
		if !ok {
			continue
		}
		id := stringValue(raw["id"])
		if id == "" {
			continue
		}
		result = append(result, &Asset{
			Kind:        KindPreset,
			ID:          id,
			BuilderRef:  builder.ID,
			Label:       firstString(raw, "label", "title"),
			Description: stringValue(raw["description"]),
			SourcePath:  builder.SourcePath,
			YAMLPath:    fmt.Sprintf("$.reportBuilder.reportDocumentTemplates[%d]", index),
			Legacy:      true,
			Raw:         raw,
		})
	}
	return result
}

func validateAsset(asset *Asset, rootNode *yaml.Node) []Diagnostic {
	if asset == nil {
		return nil
	}
	diagnostics := make([]Diagnostic, 0)
	if asset.Kind == KindBuilder {
		reportBuilder, _ := asset.Raw["reportBuilder"].(map[string]any)
		dataSources := listValue(asset.Raw["dataSources"])
		dataSourcePath := "$.dataSources"
		if len(dataSources) == 0 {
			dataSources = listValue(reportBuilder["dataSources"])
			dataSourcePath = "$.reportBuilder.dataSources"
		}
		diagnostics = append(diagnostics, duplicateIDs(
			dataSources,
			asset.SourcePath,
			dataSourcePath,
			"builderDataSourceDuplicate",
			"data source",
		)...)
	}
	if asset.Kind == KindPreset {
		if strings.TrimSpace(asset.BuilderRef) == "" {
			diagnostics = append(diagnostics, diagnosticAt(
				"presetBuilderRefRequired",
				fmt.Sprintf("preset %q must reference a builder", asset.ID),
				asset.SourcePath,
				asset.YAMLPath+".builderRef",
				mappingValue(rootNode, "builderRef"),
			))
		}
		document := mapValue(asset.Raw["document"])
		documentPath := asset.YAMLPath + ".document"
		if len(document) == 0 {
			document = mapValue(asset.Raw["documentPatch"])
			documentPath = asset.YAMLPath + ".documentPatch"
		}
		diagnostics = append(diagnostics, duplicateIDs(
			listValue(document["blocks"]),
			asset.SourcePath,
			documentPath+".blocks",
			"presetBlockDuplicate",
			"block",
		)...)
	}
	return diagnostics
}

func duplicateIDs(items []any, sourcePath, yamlPath, code, noun string) []Diagnostic {
	seen := map[string]int{}
	result := make([]Diagnostic, 0)
	for index, item := range items {
		entry := mapValue(item)
		id := stringValue(entry["id"])
		if id == "" {
			continue
		}
		key := normalizeID(id)
		if first, ok := seen[key]; ok {
			result = append(result, Diagnostic{
				Code:       code,
				Message:    fmt.Sprintf("duplicate %s id %q (first declared at index %d)", noun, id, first),
				SourcePath: sourcePath,
				YAMLPath:   fmt.Sprintf("%s[%d].id", yamlPath, index),
			})
			continue
		}
		seen[key] = index
	}
	return result
}

func (r *Registry) add(asset *Asset) []Diagnostic {
	if asset == nil {
		return nil
	}
	key := normalizeID(asset.ID)
	var index map[string]*Asset
	switch asset.Kind {
	case KindBuilder:
		index = r.buildersByID
	case KindPreset:
		index = r.presetsByID
	case KindFragment:
		index = r.fragmentsByID
	default:
		return nil
	}
	if previous := index[key]; previous != nil {
		return []Diagnostic{{
			Code:       "assetIDDuplicate",
			Message:    fmt.Sprintf("duplicate %s id %q; first declared in %s", asset.Kind, asset.ID, previous.SourcePath),
			SourcePath: asset.SourcePath,
			YAMLPath:   asset.YAMLPath + ".id",
		}}
	}
	index[key] = asset
	switch asset.Kind {
	case KindBuilder:
		r.Builders = append(r.Builders, asset)
	case KindPreset:
		r.Presets = append(r.Presets, asset)
	case KindFragment:
		r.Fragments = append(r.Fragments, asset)
	}
	return nil
}

func (r *Registry) validateReferences() []Diagnostic {
	result := make([]Diagnostic, 0)
	for _, preset := range r.Presets {
		if normalizeID(preset.BuilderRef) == "" || r.Builder(preset.BuilderRef) != nil {
			continue
		}
		result = append(result, Diagnostic{
			Code:       "presetBuilderUnavailable",
			Message:    fmt.Sprintf("preset %q references unavailable builder %q", preset.ID, preset.BuilderRef),
			SourcePath: preset.SourcePath,
			YAMLPath:   preset.YAMLPath + ".builderRef",
		})
	}
	return result
}

func sortDiagnostics(items []Diagnostic) {
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].SourcePath != items[j].SourcePath {
			return items[i].SourcePath < items[j].SourcePath
		}
		if items[i].YAMLPath != items[j].YAMLPath {
			return items[i].YAMLPath < items[j].YAMLPath
		}
		return items[i].Code < items[j].Code
	})
}

func documentContent(node *yaml.Node) *yaml.Node {
	if node != nil && node.Kind == yaml.DocumentNode && len(node.Content) > 0 {
		return node.Content[0]
	}
	return node
}

func mappingValue(node *yaml.Node, key string) *yaml.Node {
	if node == nil || node.Kind != yaml.MappingNode {
		return nil
	}
	for index := 0; index+1 < len(node.Content); index += 2 {
		if node.Content[index].Value == key {
			return node.Content[index+1]
		}
	}
	return nil
}

func diagnosticAt(code, message, sourcePath, yamlPath string, node *yaml.Node) Diagnostic {
	result := Diagnostic{Code: code, Message: message, SourcePath: sourcePath, YAMLPath: yamlPath}
	if node != nil {
		result.Line = node.Line
		result.Column = node.Column
	}
	return result
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func firstString(values map[string]any, keys ...string) string {
	for _, key := range keys {
		if value := stringValue(values[key]); value != "" {
			return value
		}
	}
	return ""
}

func mapValue(value any) map[string]any {
	result, _ := value.(map[string]any)
	return result
}

func listValue(value any) []any {
	result, _ := value.([]any)
	return result
}

// Loader retains the prior valid registry when a development reload contains
// invalid YAML or references. Callers can surface the returned error while
// continuing to serve Loader.Current().
type Loader struct {
	options Options
	mu      sync.RWMutex
	current *Registry
}

func NewLoader(options Options) *Loader {
	return &Loader{options: options}
}

func (l *Loader) Reload(ctx context.Context) (*Registry, error) {
	next, err := Discover(ctx, l.options)
	if err != nil {
		return l.Current(), err
	}
	l.mu.Lock()
	l.current = next
	l.mu.Unlock()
	return next, nil
}

func (l *Loader) Current() *Registry {
	if l == nil {
		return nil
	}
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.current
}
