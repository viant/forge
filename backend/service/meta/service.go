package meta

import (
	"context"
	"fmt"
	"path"
	"github.com/viant/afs"
	"github.com/viant/afs/file"
	"github.com/viant/afs/storage"
	"github.com/viant/afs/url"
	"gopkg.in/yaml.v3"
	"strconv"
	"strings"
)

// Service represents a YAML loader that can resolve $import directives.
type Service struct {
	fs      afs.Service
	baseURL string
	options []storage.Option
}

type TargetContext struct {
	Platform     string
	FormFactor   string
	Surface      string
	Capabilities []string
}

// Load reads the YAML file at the given path, resolves $import directives,
// and decodes the result into the provided Go variable v.
func (l *Service) Load(ctx context.Context, path string, v interface{}) error {
	return l.LoadWithTarget(ctx, path, v, nil)
}

func (l *Service) LoadWithTarget(ctx context.Context, path string, v interface{}, target *TargetContext) error {
	URL := l.getURL(path)
	return l.LoadWithURLAndTarget(ctx, URL, v, target)
}

func (l *Service) LoadWithURL(ctx context.Context, URL string, v interface{}) error {
	return l.LoadWithURLAndTarget(ctx, URL, v, nil)
}

func (l *Service) LoadWithURLAndTarget(ctx context.Context, URL string, v interface{}, target *TargetContext) error {
	// Read the file content using the filesystem service.
	data, err := l.fs.DownloadWithURL(ctx, URL, l.options...)
	if err != nil {
		return err
	}
	object, _ := l.fs.Object(ctx, URL, l.options)

	// Parse the YAML into a yaml.Node.
	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		return err
	}

	// Resolve $import directives recursively.
	baseDir, _ := url.Split(object.URL(), file.Scheme)

	if err := l.resolveImports(ctx, &node, baseDir, target); err != nil {
		return err
	}

	// Decode the resolved YAML node into the provided Go variable.
	err = node.Decode(v)

	return err
}

func (l *Service) Exists(ctx context.Context, path string) (bool, error) {
	URL := l.getURL(path)

	return l.fs.Exists(ctx, URL, l.options...)
}

func (l *Service) List(ctx context.Context, path string) ([]string, error) {
	var result []string
	URL := l.getURL(path)
	objects, err := l.fs.List(ctx, URL, l.options...)
	if err != nil {
		return nil, err
	}
	for _, object := range objects {
		if object.IsDir() {
			continue
		}
		result = append(result, object.URL())
	}
	return result, nil
}

func (l *Service) Download(ctx context.Context, path string) ([]byte, error) {
	URL := l.getURL(path)
	return l.fs.DownloadWithURL(ctx, URL, l.options...)
}

// resolveImports recursively resolves $import directives within a YAML node.
func (l *Service) resolveImports(ctx context.Context, node *yaml.Node, baseDir string, target *TargetContext) error {
	switch node.Kind {
	case yaml.DocumentNode:
		// Recursively resolve imports in document content.
		for _, contentNode := range node.Content {
			if err := l.resolveImports(ctx, contentNode, baseDir, target); err != nil {
				return err
			}
		}
	case yaml.MappingNode:
		// Mapping nodes have content in key-value pairs.
		for i := 0; i < len(node.Content); i += 2 {
			keyNode := node.Content[i]
			valueNode := node.Content[i+1]

			// Resolve imports in the key and value nodes.
			if err := l.processNode(ctx, keyNode, baseDir, target); err != nil {
				return err
			}
			if err := l.processNode(ctx, valueNode, baseDir, target); err != nil {
				return err
			}
		}
	case yaml.SequenceNode:
		// Resolve imports in each item of the sequence.
		for i := 0; i < len(node.Content); i++ {
			itemNode := node.Content[i]
			if err := l.processNode(ctx, itemNode, baseDir, target); err != nil {
				return err
			}
		}
	case yaml.AliasNode:
		// Resolve imports in the referenced node.
		if node.Alias != nil {
			if err := l.resolveImports(ctx, node.Alias, baseDir, target); err != nil {
				return err
			}
		}
	default:
		// ScalarNode or others; do nothing here.
	}
	return nil
}

// processNode checks if the node contains an $import directive and processes it.
func (l *Service) processNode(ctx context.Context, node *yaml.Node, baseDir string, target *TargetContext) error {
	if node.Kind == yaml.ScalarNode && node.Tag == "!!str" {
		if isImportDirective(node.Value) {
			importPath, key, err := getImportPathAndKey(node.Value)
			if err != nil {
				return err
			}
			fullPath, err := l.resolveImportURL(ctx, baseDir, importPath, target)
			if err != nil {
				return err
			}
			data, err := l.fs.DownloadWithURL(ctx, fullPath, l.options...)
			if err != nil {
				return err
			}
			var importedNode yaml.Node
			if err := yaml.Unmarshal(data, &importedNode); err != nil {
				return err
			}
			parent, _ := url.Split(fullPath, file.Scheme)
			// Resolve imports in the imported node recursively.
			if err := l.resolveImports(ctx, &importedNode, parent, target); err != nil {
				return err
			}

			var replacementNode *yaml.Node
			if key == "" {
				// No specific key requested; use the entire imported content.
				replacementNode = getContentNode(&importedNode)
			} else {
				// Extract the node under the specified key.
				extractedNode, err := getNodeByKey(&importedNode, key)
				if err != nil {
					return err
				}
				replacementNode = extractedNode
			}

			// Replace the current node with the imported content or the extracted node.
			*node = *replacementNode
		}
	} else {
		// Recursively resolve imports in this node.
		if err := l.resolveImports(ctx, node, baseDir, target); err != nil {
			return err
		}
	}
	return nil
}

func (l *Service) ResolveWindowBase(ctx context.Context, basePath string, target *TargetContext) (string, error) {
	candidates := branchCandidates(basePath, target)
	for _, candidate := range candidates {
		ok, err := l.Exists(ctx, candidate+".yaml")
		if err != nil {
			continue
		}
		if ok {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("open %s.yaml: file does not exist", basePath)
}

func (l *Service) resolveImportURL(ctx context.Context, baseDir, importPath string, target *TargetContext) (string, error) {
	candidates := importCandidates(baseDir, importPath, target)
	for _, candidate := range candidates {
		ok, err := l.fs.Exists(ctx, candidate, l.options...)
		if err != nil {
			continue
		}
		if ok {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("open %s: file does not exist", url.Join(baseDir, importPath))
}

func branchCandidates(basePath string, target *TargetContext) []string {
	baseDir, leaf := splitMetaBase(basePath)
	if target == nil {
		return []string{basePath}
	}
	var result []string
	platform := strings.TrimSpace(target.Platform)
	formFactor := strings.TrimSpace(target.FormFactor)
	if platform != "" && formFactor != "" {
		result = append(result, url.Join(baseDir, platform, formFactor, leaf))
	}
	if platform != "" {
		result = append(result, url.Join(baseDir, platform, leaf))
	}
	result = append(result, url.Join(baseDir, "shared", leaf))
	result = append(result, basePath)
	return uniqueStrings(result)
}

func importCandidates(baseDir, importPath string, target *TargetContext) []string {
	if target == nil {
		return []string{joinMetaPath(baseDir, importPath)}
	}
	rootDir, branchLevel := branchRoot(baseDir, target)
	logicalBase := baseDir
	if branchLevel > 0 {
		logicalBase = rootDir
	}
	logicalPath := joinMetaPath(logicalBase, importPath)
	candidates := []string{logicalPath}
	relativeImport := strings.TrimPrefix(logicalPath, strings.TrimSuffix(rootDir, "/"))
	relativeImport = strings.TrimPrefix(relativeImport, "/")
	switch branchLevel {
	case 2:
		if platform := strings.TrimSpace(target.Platform); platform != "" {
			if formFactor := strings.TrimSpace(target.FormFactor); formFactor != "" {
				candidates = append(candidates, joinMetaPath(rootDir, path.Join(platform, formFactor, relativeImport)))
			}
			candidates = append(candidates, joinMetaPath(rootDir, path.Join(platform, relativeImport)))
		}
		candidates = append(candidates, joinMetaPath(rootDir, path.Join("shared", relativeImport)))
	case 1:
		if platform := strings.TrimSpace(target.Platform); platform != "" {
			candidates = append(candidates, joinMetaPath(rootDir, path.Join(platform, relativeImport)))
		}
		candidates = append(candidates, joinMetaPath(rootDir, path.Join("shared", relativeImport)))
	}
	return uniqueStrings(candidates)
}

func branchRoot(baseDir string, target *TargetContext) (string, int) {
	platform := strings.TrimSpace(target.Platform)
	formFactor := strings.TrimSpace(target.FormFactor)
	if platform != "" && formFactor != "" {
		suffix := "/" + platform + "/" + formFactor
		if strings.HasSuffix(baseDir, suffix) {
			return strings.TrimSuffix(baseDir, suffix), 2
		}
	}
	if platform != "" {
		suffix := "/" + platform
		if strings.HasSuffix(baseDir, suffix) {
			return strings.TrimSuffix(baseDir, suffix), 1
		}
	}
	if strings.HasSuffix(baseDir, "/shared") {
		return strings.TrimSuffix(baseDir, "/shared"), 1
	}
	return baseDir, 0
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func splitMetaBase(basePath string) (string, string) {
	trimmed := strings.TrimSuffix(basePath, "/")
	index := strings.LastIndex(trimmed, "/")
	if index == -1 {
		return "", trimmed
	}
	return trimmed[:index], trimmed[index+1:]
}

func joinMetaPath(base, rel string) string {
	if url.Scheme(base, "") != "" {
		return url.Join(base, rel)
	}
	return path.Clean(path.Join(base, rel))
}

// getImportPathAndKey extracts the path and key from an $import directive.
func getImportPathAndKey(value string) (path string, key string, err error) {
	value = strings.TrimSpace(value)
	if !isImportDirective(value) {
		return "", "", fmt.Errorf("not an import directive: %s", value)
	}
	// Extract the path inside the parentheses.
	start := strings.Index(value, "(")
	end := strings.LastIndex(value, ")")
	if start == -1 || end == -1 || start >= end {
		return "", "", fmt.Errorf("invalid import directive syntax: %s", value)
	}
	pathValue := strings.TrimSpace(value[start+1 : end])
	// Remove surrounding quotes if present.
	pathValue = strings.Trim(pathValue, "\"'")

	// Check if a key is specified after a colon.
	parts := strings.SplitN(pathValue, ":", 2)
	path = parts[0]
	if len(parts) > 1 {
		key = parts[1]
	}
	if !strings.HasSuffix(path, ".yaml") {
		path += ".yaml"
	}
	return path, key, nil
}

// isImportDirective checks if a string is an $import directive.
func isImportDirective(value string) bool {
	return strings.HasPrefix(strings.TrimSpace(value), "$import")
}

// getNodeByKey navigates through the YAML node to find the node under the specified key path.
func getNodeByKey(node *yaml.Node, key string) (*yaml.Node, error) {
	keys := strings.Split(key, ".")
	currentNode := node

	for _, k := range keys {
		if currentNode.Kind == yaml.DocumentNode {
			if len(currentNode.Content) > 0 {
				currentNode = currentNode.Content[0]
			} else {
				return nil, fmt.Errorf("document node has no content")
			}
		}

		if currentNode.Kind == yaml.MappingNode {
			found := false
			for i := 0; i < len(currentNode.Content); i += 2 {
				keyNode := currentNode.Content[i]
				valueNode := currentNode.Content[i+1]
				if keyNode.Value == k {
					currentNode = valueNode
					found = true
					break
				}
			}
			if !found {
				return nil, fmt.Errorf("key '%s' not found in mapping", k)
			}
		} else if currentNode.Kind == yaml.SequenceNode {
			// Allow numeric keys for sequences.
			index, err := parseIndex(k)
			if err != nil {
				return nil, fmt.Errorf("invalid sequence index '%s': %v", k, err)
			}
			if index < 0 || index >= len(currentNode.Content) {
				return nil, fmt.Errorf("sequence index '%d' out of range", index)
			}
			currentNode = currentNode.Content[index]
		} else {
			return nil, fmt.Errorf("cannot navigate through node of kind %d", currentNode.Kind)
		}
	}

	return currentNode, nil
}

func (l *Service) getURL(path string) string {
	URL := path
	if l.baseURL != "" && url.Scheme(path, "") == "" {
		URL = url.Join(l.baseURL, path)
	}
	return URL
}

// parseIndex converts a string to an integer index.
func parseIndex(s string) (int, error) {
	return strconv.Atoi(s)
}

// getContentNode extracts the content node from a YAML node,
// handling DocumentNode and other cases.
func getContentNode(node *yaml.Node) *yaml.Node {
	if node.Kind == yaml.DocumentNode && len(node.Content) > 0 {
		return node.Content[0]
	}
	return node
}

// New creates a new Service with the provided filesystem service.
func New(fs afs.Service, baseURL string, options ...storage.Option) *Service {
	return &Service{fs: fs, baseURL: baseURL, options: options}
}
