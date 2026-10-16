// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package meta

import (
	"context"
	"fmt"
	neturl "net/url"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/viant/afs"
	"github.com/viant/afs/storage"
	"gopkg.in/yaml.v3"
)

// ResolveImports recursively resolves $import(...) directives in YAML nodes.
// Scalar imports may target YAML or plain-text files. Plain-text files are
// injected as YAML string scalars so they can be used in any text field.
func ResolveImports(ctx context.Context, fs afs.Service, node *yaml.Node, baseDir string, options ...storage.Option) error {
	if node == nil || fs == nil {
		return nil
	}
	return resolveImports(ctx, fs, node, baseDir, nil, options...)
}

func resolveImports(ctx context.Context, fs afs.Service, node *yaml.Node, baseDir string, params map[string]interface{}, options ...storage.Option) error {
	if node != nil && node.Kind == yaml.ScalarNode && node.Tag == "!!str" && isImportDirective(node.Value) {
		return replaceImportNode(ctx, fs, node, baseDir, params, options...)
	}
	switch node.Kind {
	case yaml.DocumentNode:
		for _, child := range node.Content {
			if err := resolveImports(ctx, fs, child, baseDir, params, options...); err != nil {
				return err
			}
		}
	case yaml.MappingNode:
		for i := 0; i+1 < len(node.Content); i += 2 {
			if err := processImportNode(ctx, fs, node.Content[i], baseDir, params, options...); err != nil {
				return err
			}
			if err := processImportNode(ctx, fs, node.Content[i+1], baseDir, params, options...); err != nil {
				return err
			}
		}
	case yaml.SequenceNode:
		for _, child := range node.Content {
			if err := processImportNode(ctx, fs, child, baseDir, params, options...); err != nil {
				return err
			}
		}
	case yaml.AliasNode:
		if node.Alias != nil {
			if err := resolveImports(ctx, fs, node.Alias, baseDir, params, options...); err != nil {
				return err
			}
		}
	}
	return nil
}

func processImportNode(ctx context.Context, fs afs.Service, node *yaml.Node, baseDir string, params map[string]interface{}, options ...storage.Option) error {
	if node.Kind == yaml.ScalarNode && node.Tag == "!!str" && isImportDirective(node.Value) {
		return replaceImportNode(ctx, fs, node, baseDir, params, options...)
	}
	return resolveImports(ctx, fs, node, baseDir, params, options...)
}

func replaceImportNode(ctx context.Context, fs afs.Service, node *yaml.Node, baseDir string, inherited map[string]interface{}, options ...storage.Option) error {
	importPath, key, localParams, err := getImportPathKeyAndParams(node.Value)
	if err != nil {
		return err
	}
	params := mergeImportParams(inherited, localParams)
	fullPath := resolveImportPath(baseDir, importPath)
	data, err := fs.DownloadWithURL(ctx, fullPath, options...)
	if err != nil {
		return err
	}
	imported, err := importedReplacementNode(importPath, data)
	if err != nil {
		return err
	}
	replacement := contentNode(imported)
	if key != "" {
		replacement, err = nodeByKey(imported, key)
		if err != nil {
			return err
		}
	}
	if err := applyImportParams(replacement, params); err != nil {
		return fmt.Errorf("parameterize import %q: %w", importPath, err)
	}
	if isYAMLPath(importPath) {
		if err := resolveImports(ctx, fs, replacement, importBaseDir(fullPath), params, options...); err != nil {
			return err
		}
	}
	*node = *replacement
	return nil
}

func isImportDirective(value string) bool {
	return strings.HasPrefix(strings.TrimSpace(value), "$import")
}

func getImportPath(value string) (string, error) {
	path, _, err := getImportPathAndKey(value)
	return path, err
}

func getImportPathAndKey(value string) (string, string, error) {
	path, key, _, err := getImportPathKeyAndParams(value)
	return path, key, err
}

func getImportPathKeyAndParams(value string) (string, string, map[string]interface{}, error) {
	value = strings.TrimSpace(value)
	if !isImportDirective(value) {
		return "", "", nil, fmt.Errorf("not an import directive: %s", value)
	}
	start := strings.Index(value, "(")
	end := strings.LastIndex(value, ")")
	if start == -1 || end == -1 || start >= end {
		return "", "", nil, fmt.Errorf("invalid import directive syntax: %s", value)
	}
	pathValue, rawParams, err := splitImportArguments(strings.TrimSpace(value[start+1 : end]))
	if err != nil {
		return "", "", nil, err
	}
	pathValue = strings.Trim(pathValue, "\"'")
	if strings.TrimSpace(pathValue) == "" {
		return "", "", nil, fmt.Errorf("empty import path: %s", value)
	}
	importPath, key := splitImportPathAndKey(pathValue)
	params := map[string]interface{}{}
	if rawParams != "" {
		if err := yaml.Unmarshal([]byte(rawParams), &params); err != nil {
			return "", "", nil, fmt.Errorf("invalid import parameter map: %w", err)
		}
		if params == nil {
			return "", "", nil, fmt.Errorf("import parameters must be a map")
		}
	}
	return importPath, key, params, nil
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
	return value, ""
}

func resolveImportPath(baseDir, importPath string) string {
	if filepath.IsAbs(importPath) {
		return filepath.Clean(importPath)
	}
	if parsed, err := neturl.Parse(baseDir); err == nil && parsed.Scheme != "" {
		if reference, refErr := neturl.Parse(importPath); refErr == nil {
			parsed.Path = strings.TrimSuffix(parsed.Path, "/") + "/"
			return parsed.ResolveReference(reference).String()
		}
	}
	return filepath.Clean(filepath.Join(baseDir, importPath))
}

func importBaseDir(resource string) string {
	resource = strings.TrimSpace(resource)
	if strings.HasPrefix(resource, "file://localhost") {
		resource = strings.TrimPrefix(resource, "file://localhost")
	} else if strings.HasPrefix(resource, "file://") {
		resource = strings.TrimPrefix(resource, "file://")
	}
	if parsed, err := neturl.Parse(resource); err == nil && parsed.Scheme != "" {
		parsed.Path = strings.TrimSuffix(parsed.Path, "/")
		parsed.Path = filepath.ToSlash(filepath.Dir(filepath.FromSlash(parsed.Path)))
		parsed.RawPath = ""
		return parsed.String()
	}
	return filepath.Dir(resource)
}

func isYAMLPath(path string) bool {
	lower := strings.ToLower(strings.TrimSpace(path))
	return strings.HasSuffix(lower, ".yaml") || strings.HasSuffix(lower, ".yml")
}

func importedReplacementNode(importPath string, data []byte) (*yaml.Node, error) {
	if isYAMLPath(importPath) {
		var node yaml.Node
		if err := yaml.Unmarshal(data, &node); err != nil {
			return nil, err
		}
		return &node, nil
	}
	return &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: string(data)}, nil
}

func contentNode(node *yaml.Node) *yaml.Node {
	if node == nil {
		return &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: ""}
	}
	if node.Kind == yaml.DocumentNode && len(node.Content) > 0 {
		return node.Content[0]
	}
	return node
}

func nodeByKey(node *yaml.Node, key string) (*yaml.Node, error) {
	current := contentNode(node)
	for _, part := range strings.Split(key, ".") {
		part = strings.TrimSpace(part)
		if part == "" {
			return nil, fmt.Errorf("empty import selector in %q", key)
		}
		if current.Kind == yaml.DocumentNode {
			current = contentNode(current)
		}
		if current.Kind != yaml.MappingNode {
			return nil, fmt.Errorf("import selector %q cannot descend into %v", part, current.Kind)
		}
		found := false
		for i := 0; i+1 < len(current.Content); i += 2 {
			if current.Content[i].Value == part {
				current = current.Content[i+1]
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("import selector %q not found", key)
		}
	}
	return current, nil
}
