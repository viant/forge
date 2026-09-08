package meta

import (
	"context"
	"fmt"
	"github.com/viant/afs"
	"github.com/viant/afs/file"
	"github.com/viant/afs/storage"
	"github.com/viant/afs/url"
	"gopkg.in/yaml.v3"
	"path"
	"regexp"
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

	if err := l.resolveImports(ctx, &node, baseDir, target, nil); err != nil {
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
func (l *Service) resolveImports(ctx context.Context, node *yaml.Node, baseDir string, target *TargetContext, params map[string]interface{}) error {
	switch node.Kind {
	case yaml.DocumentNode:
		// Recursively resolve imports in document content.
		for _, contentNode := range node.Content {
			if err := l.processNode(ctx, contentNode, baseDir, target, params); err != nil {
				return err
			}
		}
	case yaml.MappingNode:
		// Mapping nodes have content in key-value pairs.
		for i := 0; i < len(node.Content); i += 2 {
			keyNode := node.Content[i]
			valueNode := node.Content[i+1]

			// Resolve imports in the key and value nodes.
			if err := l.processNode(ctx, keyNode, baseDir, target, params); err != nil {
				return err
			}
			if err := l.processNode(ctx, valueNode, baseDir, target, params); err != nil {
				return err
			}
		}
	case yaml.SequenceNode:
		// Resolve imports in each item of the sequence.
		for i := 0; i < len(node.Content); i++ {
			itemNode := node.Content[i]
			if err := l.processNode(ctx, itemNode, baseDir, target, params); err != nil {
				return err
			}
		}
	case yaml.AliasNode:
		// Resolve imports in the referenced node.
		if node.Alias != nil {
			if err := l.resolveImports(ctx, node.Alias, baseDir, target, params); err != nil {
				return err
			}
		}
	default:
		// ScalarNode or others; do nothing here.
	}
	return nil
}

// processNode checks if the node contains an $import directive and processes it.
func (l *Service) processNode(ctx context.Context, node *yaml.Node, baseDir string, target *TargetContext, params map[string]interface{}) error {
	if node.Kind == yaml.ScalarNode && node.Tag == "!!str" {
		if isImportDirective(node.Value) {
			importPath, key, localParams, err := getImportPathKeyAndParams(node.Value)
			if err != nil {
				return err
			}
			params = mergeImportParams(params, localParams)
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
			if err := applyImportParams(replacementNode, params); err != nil {
				return fmt.Errorf("parameterize import %q: %w", importPath, err)
			}
			parent, _ := url.Split(fullPath, file.Scheme)
			// Resolve only the selected subtree so unselected keyed siblings cannot
			// consume parameters or nested imports from this instance. Use
			// processNode rather than resolveImports directly because a root import
			// may legitimately resolve to another scalar import (for example
			// campaign.yaml -> shared/main.yaml -> web/main.yaml).
			if err := l.processNode(ctx, replacementNode, parent, target, params); err != nil {
				return err
			}

			// Replace the current node with the imported content or the extracted node.
			*node = *replacementNode
		}
	} else {
		// Recursively resolve imports in this node.
		if err := l.resolveImports(ctx, node, baseDir, target, params); err != nil {
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

func (l *Service) ResolveWindowAsset(ctx context.Context, basePath, ext string, target *TargetContext) (string, error) {
	extension := strings.TrimSpace(ext)
	if extension == "" {
		return "", fmt.Errorf("asset extension is required")
	}
	if !strings.HasPrefix(extension, ".") {
		extension = "." + extension
	}
	baseDir, leaf := splitMetaBase(basePath)
	candidates := make([]string, 0)
	if target == nil {
		candidates = append(candidates, basePath)
	} else {
		for _, branch := range branchPathCandidates(target) {
			candidates = append(candidates, url.Join(baseDir, branch, leaf))
		}
		for _, branch := range branchPathCandidates(target) {
			candidates = append(candidates, url.Join(baseDir, "shared", branch, leaf))
		}
		candidates = append(candidates, url.Join(baseDir, "shared", leaf))
		candidates = append(candidates, basePath)
	}
	candidates = uniqueStrings(candidates)
	for _, candidate := range candidates {
		ok, err := l.Exists(ctx, candidate+extension)
		if err != nil {
			continue
		}
		if ok {
			return candidate + extension, nil
		}
	}
	return "", fmt.Errorf("open %s%s: file does not exist", basePath, extension)
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
	for _, branch := range branchPathCandidates(target) {
		result = append(result, url.Join(baseDir, branch, leaf))
	}
	result = append(result, url.Join(baseDir, "shared", leaf))
	result = append(result, basePath)
	return uniqueStrings(result)
}

func importCandidates(baseDir, importPath string, target *TargetContext) []string {
	if target == nil {
		return []string{joinMetaPath(baseDir, importPath)}
	}
	rootDir, inBranch := branchRoot(baseDir, target)
	if !inBranch {
		return []string{joinMetaPath(baseDir, importPath)}
	}
	currentBranchPath := joinMetaPath(baseDir, importPath)
	sharedPath := joinMetaPath(rootDir, path.Join("shared", importPath))
	currentIsShared := isSharedBranch(baseDir)
	candidates := make([]string, 0, len(branchPathCandidates(target))+3)
	if !currentIsShared {
		candidates = append(candidates, currentBranchPath)
	}
	for _, branch := range branchPathCandidates(target) {
		candidates = append(candidates, joinMetaPath(rootDir, path.Join(branch, importPath)))
	}
	candidates = append(candidates, sharedPath)
	if currentIsShared {
		candidates = append(candidates, currentBranchPath)
	}
	candidates = append(candidates, joinMetaPath(rootDir, importPath))
	return uniqueStrings(candidates)
}

func branchRoot(baseDir string, target *TargetContext) (string, bool) {
	if target == nil {
		return baseDir, false
	}
	for _, branch := range append(branchPathCandidates(target), "shared") {
		suffix := "/" + strings.Trim(branch, "/")
		if strings.HasSuffix(baseDir, suffix) {
			return strings.TrimSuffix(baseDir, suffix), true
		}
	}
	return baseDir, false
}

func isSharedBranch(baseDir string) bool {
	return strings.HasSuffix(strings.TrimSuffix(baseDir, "/"), "/shared")
}

func branchPathCandidates(target *TargetContext) []string {
	if target == nil {
		return nil
	}
	platform := strings.TrimSpace(target.Platform)
	formFactor := strings.TrimSpace(target.FormFactor)
	surface := strings.TrimSpace(target.Surface)
	isMobile := isMobileTarget(platform, formFactor, surface)
	var result []string
	if platform != "" && formFactor != "" {
		result = append(result, path.Join(platform, formFactor), platform+"."+formFactor)
	}
	if platform != "" {
		result = append(result, platform)
	}
	if isMobile && formFactor != "" {
		result = append(result, path.Join("mobile", formFactor), "mobile."+formFactor)
	}
	if isMobile {
		result = append(result, "mobile")
	}
	if formFactor != "" {
		result = append(result, formFactor)
	}
	return uniqueStrings(result)
}

func isMobileTarget(platform, formFactor, surface string) bool {
	switch platform {
	case "android", "ios":
		return true
	}
	switch formFactor {
	case "phone", "tablet", "foldable":
		return true
	}
	return surface == "app" && platform != "web"
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
	path, key, _, err = getImportPathKeyAndParams(value)
	return path, key, err
}

func getImportPathKeyAndParams(value string) (path string, key string, params map[string]interface{}, err error) {
	value = strings.TrimSpace(value)
	if !isImportDirective(value) {
		return "", "", nil, fmt.Errorf("not an import directive: %s", value)
	}
	// Extract the path inside the parentheses.
	start := strings.Index(value, "(")
	end := strings.LastIndex(value, ")")
	if start == -1 || end == -1 || start >= end {
		return "", "", nil, fmt.Errorf("invalid import directive syntax: %s", value)
	}
	pathValue, rawParams, splitErr := splitImportArguments(strings.TrimSpace(value[start+1 : end]))
	if splitErr != nil {
		return "", "", nil, splitErr
	}
	// Remove surrounding quotes if present.
	pathValue = strings.Trim(pathValue, "\"'")

	path, key = splitImportPathAndKey(pathValue)
	if !strings.HasSuffix(path, ".yaml") {
		path += ".yaml"
	}
	params = map[string]interface{}{}
	if rawParams != "" {
		if err := yaml.Unmarshal([]byte(rawParams), &params); err != nil {
			return "", "", nil, fmt.Errorf("invalid import parameter map: %w", err)
		}
		if params == nil {
			return "", "", nil, fmt.Errorf("import parameters must be a map")
		}
	}
	return path, key, params, nil
}

func splitImportPathAndKey(value string) (string, string) {
	lower := strings.ToLower(value)
	for _, ext := range []string{".yaml", ".yml"} {
		extensionEnd := strings.LastIndex(lower, ext)
		if extensionEnd == -1 {
			continue
		}
		selectorStart := extensionEnd + len(ext)
		if selectorStart < len(value) && value[selectorStart] == ':' {
			return value[:selectorStart], strings.TrimSpace(value[selectorStart+1:])
		}
	}
	if separator := strings.LastIndex(value, ":"); separator > 0 && !strings.Contains(value[:separator], "://") {
		return value[:separator], strings.TrimSpace(value[separator+1:])
	}
	return value, ""
}

func splitImportArguments(value string) (string, string, error) {
	quote := rune(0)
	escaped := false
	depth := 0
	for index, r := range value {
		if escaped {
			escaped = false
			continue
		}
		if quote != 0 {
			if r == '\\' {
				escaped = true
			} else if r == quote {
				quote = 0
			}
			continue
		}
		switch r {
		case '\'', '"':
			quote = r
		case '{', '[', '(':
			depth++
		case '}', ']', ')':
			depth--
			if depth < 0 {
				return "", "", fmt.Errorf("invalid import arguments %q", value)
			}
		case ',':
			if depth == 0 {
				return strings.TrimSpace(value[:index]), strings.TrimSpace(value[index+1:]), nil
			}
		}
	}
	if quote != 0 || depth != 0 {
		return "", "", fmt.Errorf("invalid import arguments %q", value)
	}
	return strings.TrimSpace(value), "", nil
}

func mergeImportParams(parent, local map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{}, len(parent)+len(local))
	for key, value := range parent {
		result[key] = value
	}
	for key, value := range local {
		result[key] = value
	}
	return result
}

var importParamPattern = regexp.MustCompile(`\$param\(([^)]+)\)`)

func applyImportParams(node *yaml.Node, params map[string]interface{}) error {
	if node == nil {
		return nil
	}
	if node.Kind == yaml.ScalarNode && node.Tag == "!!str" && strings.Contains(node.Value, "$param(") {
		matches := importParamPattern.FindAllStringSubmatchIndex(node.Value, -1)
		if len(matches) == 0 {
			return fmt.Errorf("malformed import parameter expression %q", node.Value)
		}
		if len(matches) == 1 && matches[0][0] == 0 && matches[0][1] == len(node.Value) {
			name := strings.TrimSpace(node.Value[matches[0][2]:matches[0][3]])
			value, ok := importParamValue(params, name)
			if !ok {
				return fmt.Errorf("missing import parameter %q", name)
			}
			var replacement yaml.Node
			if err := replacement.Encode(value); err != nil {
				return err
			}
			*node = replacement
			return nil
		}
		var replacement strings.Builder
		last := 0
		for _, match := range matches {
			replacement.WriteString(node.Value[last:match[0]])
			name := strings.TrimSpace(node.Value[match[2]:match[3]])
			value, ok := importParamValue(params, name)
			if !ok {
				return fmt.Errorf("missing import parameter %q", name)
			}
			text, ok := importParamText(value)
			if !ok {
				return fmt.Errorf("import parameter %q is not scalar and cannot be interpolated", name)
			}
			replacement.WriteString(text)
			last = match[1]
		}
		replacement.WriteString(node.Value[last:])
		node.Value = replacement.String()
	}
	for _, child := range node.Content {
		if err := applyImportParams(child, params); err != nil {
			return err
		}
	}
	if node.Alias != nil {
		return applyImportParams(node.Alias, params)
	}
	return nil
}

func importParamValue(params map[string]interface{}, selector string) (interface{}, bool) {
	var current interface{} = params
	for _, part := range strings.Split(selector, ".") {
		part = strings.TrimSpace(part)
		mapping, ok := current.(map[string]interface{})
		if !ok || part == "" {
			return nil, false
		}
		current, ok = mapping[part]
		if !ok {
			return nil, false
		}
	}
	return current, true
}

func importParamText(value interface{}) (string, bool) {
	switch actual := value.(type) {
	case nil:
		return "", true
	case string:
		return actual, true
	case bool, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		return fmt.Sprint(actual), true
	default:
		return "", false
	}
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
