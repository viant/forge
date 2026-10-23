// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"unicode"

	forgeTypes "github.com/viant/forge/backend/types"
	"gopkg.in/yaml.v3"
)

// AssetReferences are the workspace asset identities a Forge definition points
// at. They are collected generically from the YAML shape so every reference
// vocabulary (dataSourceRef, lookup.dataSource, link.dialogId, on[].handler
// window.openDialog args, modelRef/resourceModelRef, schemaRef/$ref) is covered
// without enumerating Forge container kinds.
type AssetReferences struct {
	DataSources    map[string]bool
	Dialogs        map[string]bool
	ResourceModels map[string]bool
	Schemas        map[string]bool
}

func newAssetReferences() *AssetReferences {
	return &AssetReferences{
		DataSources:    map[string]bool{},
		Dialogs:        map[string]bool{},
		ResourceModels: map[string]bool{},
		Schemas:        map[string]bool{},
	}
}

func (r *AssetReferences) merge(other *AssetReferences) {
	if other == nil {
		return
	}
	for id := range other.DataSources {
		r.DataSources[id] = true
	}
	for id := range other.Dialogs {
		r.Dialogs[id] = true
	}
	for id := range other.ResourceModels {
		r.ResourceModels[id] = true
	}
	for id := range other.Schemas {
		r.Schemas[id] = true
	}
}

// CodeReferences summarise how window action JavaScript refers to dialogs and
// datasources: literal identifiers that can be validated statically and the
// dynamic dialog id expressions that cannot.
type CodeReferences struct {
	// Literals holds every string literal in the code; callers intersect it
	// with the workspace catalog to find dialog/datasource usage.
	Literals map[string]bool
	// DynamicDialogs lists code locations where a dialog id is computed
	// (variable, map lookup, template) and therefore cannot be validated.
	DynamicDialogs []string
}

// WindowReferences is the effective reference surface of a window: the YAML
// definition (view, dialogs, settings, authorization, resource models) and the
// attached action code.
type WindowReferences struct {
	YAML *AssetReferences
	Code *CodeReferences
}

// CollectWindowReferences extracts every workspace asset reference the window
// makes from its YAML shape and action code.
func CollectWindowReferences(window *forgeTypes.Window) *WindowReferences {
	result := &WindowReferences{YAML: newAssetReferences(), Code: &CodeReferences{Literals: map[string]bool{}}}
	if window == nil {
		return result
	}
	result.YAML.merge(collectAssetReferences(window))
	if window.Actions != nil {
		result.Code = collectCodeReferences(window.Actions.Code)
	}
	return result
}

// collectAssetReferences walks the YAML projection of any Forge value.
func collectAssetReferences(value interface{}) *AssetReferences {
	refs := newAssetReferences()
	if value == nil {
		return refs
	}
	data, err := yaml.Marshal(value)
	if err != nil {
		return refs
	}
	var generic interface{}
	if err := yaml.Unmarshal(data, &generic); err != nil {
		return refs
	}
	walkAssetReferences(generic, "", refs)
	return refs
}

var dialogHandlerPattern = regexp.MustCompile(`(?i)(^|\.)(open|close|show|hide|toggle)Dialog$`)

func walkAssetReferences(node interface{}, parentKey string, refs *AssetReferences) {
	switch actual := node.(type) {
	case map[string]interface{}:
		if handler, ok := actual["handler"].(string); ok && dialogHandlerPattern.MatchString(strings.TrimSpace(handler)) {
			if args, ok := actual["args"].([]interface{}); ok && len(args) > 0 {
				if id, ok := args[0].(string); ok && strings.TrimSpace(id) != "" {
					refs.Dialogs[strings.TrimSpace(id)] = true
				}
			}
		}
		for key, child := range actual {
			if key == "dataSourceRefs" {
				// Binding.DataSourceRefs maps aliases to datasource identities.
				if aliases, ok := child.(map[string]interface{}); ok {
					for _, aliased := range aliases {
						if id, ok := aliased.(string); ok && strings.TrimSpace(id) != "" {
							refs.DataSources[strings.TrimSpace(id)] = true
						}
					}
					continue
				}
			}
			switch text := child.(type) {
			case string:
				text = strings.TrimSpace(text)
				if text == "" || text == "_" {
					continue
				}
				switch key {
				case "dataSourceRef", "optionsDataSourceRef", "fallbackOptionsDataSourceRef", "catalogDataSourceRef", "definitionDataSourceRef":
					refs.DataSources[text] = true
				case "dataSource":
					if parentKey == "lookup" {
						refs.DataSources[text] = true
					}
				case "dialogId":
					refs.Dialogs[text] = true
				case "modelRef":
					// Report builders carry a semantic model URI in their
					// binding and inline semanticModel. It identifies the
					// report model, not a Forge resourceModels registry key.
					if (parentKey == "binding" || parentKey == "semanticModel") && strings.HasPrefix(text, "model://") {
						continue
					}
					refs.ResourceModels[text] = true
				case "resourceModelRef":
					refs.ResourceModels[text] = true
				case "schemaRef", "$ref":
					refs.Schemas[text] = true
				}
			default:
				walkAssetReferences(child, key, refs)
			}
		}
	case []interface{}:
		for _, child := range actual {
			walkAssetReferences(child, parentKey, refs)
		}
	}
}

var (
	// dynamicDialogPatterns detect dialog ids that are computed at runtime:
	//   dialogId = someVariable / dialogById[kind]   (assignment)
	//   dialogId: someVariable                       (object property)
	//   {dialogId, context}                          (shorthand property)
	//   execution: {args: [variable, ...]}           (openDialog execution args)
	//   `template ${literal}`                        (template literal)
	dynamicDialogPatterns = []*regexp.Regexp{
		regexp.MustCompile(`\bdialogId\s*[:=]\s*([A-Za-z_$][\w$]*(?:[\.\[?][^,;\n}]*)?)`),
		regexp.MustCompile(`[{,]\s*dialogId\s*[,}]`),
		regexp.MustCompile(`\bargs\s*:\s*\[\s*([A-Za-z_$][\w$]*)`),
	}
	stringLiteralKeywords = map[string]bool{"true": true, "false": true, "null": true, "undefined": true}
)

// collectCodeReferences tokenises JavaScript for string literals and flags
// dynamic dialog identifiers. It skips line and block comments so commented
// out code does not create phantom references.
func collectCodeReferences(code string) *CodeReferences {
	result := &CodeReferences{Literals: map[string]bool{}}
	if strings.TrimSpace(code) == "" {
		return result
	}
	runes := []rune(code)
	line := 1
	for i := 0; i < len(runes); i++ {
		ch := runes[i]
		switch {
		case ch == '\n':
			line++
		case ch == '/' && i+1 < len(runes) && runes[i+1] == '/':
			for i < len(runes) && runes[i] != '\n' {
				i++
			}
			line++
		case ch == '/' && i+1 < len(runes) && runes[i+1] == '*':
			i += 2
			for i+1 < len(runes) && !(runes[i] == '*' && runes[i+1] == '/') {
				if runes[i] == '\n' {
					line++
				}
				i++
			}
			i++
		case ch == '/' && regexLiteralFollows(runes, i):
			// Skip a regular expression literal so quotes inside it (e.g. /"/g)
			// do not open a phantom string that swallows real literals.
			inClass := false
			j := i + 1
			for ; j < len(runes); j++ {
				current := runes[j]
				if current == '\\' {
					j++
					continue
				}
				if current == '\n' {
					break
				}
				if inClass {
					if current == ']' {
						inClass = false
					}
					continue
				}
				if current == '[' {
					inClass = true
					continue
				}
				if current == '/' {
					break
				}
			}
			for j+1 < len(runes) && unicode.IsLetter(runes[j+1]) {
				j++
			}
			i = j
		case ch == '\'' || ch == '"' || ch == '`':
			quote := ch
			var literal strings.Builder
			dynamic := false
			j := i + 1
			for ; j < len(runes); j++ {
				current := runes[j]
				if current == '\\' && j+1 < len(runes) {
					literal.WriteRune(runes[j+1])
					j++
					continue
				}
				if current == quote {
					break
				}
				if current == '\n' {
					line++
				}
				if quote == '`' && current == '$' && j+1 < len(runes) && runes[j+1] == '{' {
					dynamic = true
				}
				literal.WriteRune(current)
			}
			i = j
			text := strings.TrimSpace(literal.String())
			if text == "" || stringLiteralKeywords[text] {
				continue
			}
			if dynamic {
				// Only template literals that plausibly build a dialog id are
				// reported; date/format templates are irrelevant here.
				if strings.Contains(strings.ToLower(text), "dialog") {
					result.DynamicDialogs = append(result.DynamicDialogs, fmt.Sprintf("line %d: template literal `%s`", line, truncateSnippet(text)))
				}
				continue
			}
			result.Literals[text] = true
		}
	}
	for _, pattern := range dynamicDialogPatterns {
		for _, match := range pattern.FindAllStringSubmatchIndex(code, -1) {
			if len(match) >= 4 && match[2] >= 0 {
				expression := strings.TrimSpace(code[match[2]:match[3]])
				if expression == "" || stringLiteralKeywords[expression] {
					continue
				}
			}
			snippet := strings.TrimSpace(code[match[0]:match[1]])
			result.DynamicDialogs = append(result.DynamicDialogs, fmt.Sprintf("line %d: %s", 1+strings.Count(code[:match[0]], "\n"), truncateSnippet(snippet)))
		}
	}
	sort.Strings(result.DynamicDialogs)
	return result
}

// regexLiteralFollows reports whether the slash at index starts a regular
// expression literal rather than a division operator, using the standard
// previous-significant-token heuristic.
func regexLiteralFollows(runes []rune, index int) bool {
	j := index - 1
	for j >= 0 && (runes[j] == ' ' || runes[j] == '\t' || runes[j] == '\n' || runes[j] == '\r') {
		j--
	}
	if j < 0 {
		return true
	}
	switch runes[j] {
	case '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^':
		return true
	}
	if unicode.IsLetter(runes[j]) || unicode.IsDigit(runes[j]) || runes[j] == '_' || runes[j] == '$' {
		start := j
		for start > 0 && (unicode.IsLetter(runes[start-1]) || unicode.IsDigit(runes[start-1]) || runes[start-1] == '_' || runes[start-1] == '$') {
			start--
		}
		switch string(runes[start : j+1]) {
		case "return", "typeof", "case", "do", "else", "in", "instanceof", "new", "delete", "void", "throw", "yield", "await":
			return true
		}
	}
	return false
}

func truncateSnippet(text string) string {
	text = strings.Join(strings.Fields(text), " ")
	if len(text) > 80 {
		return text[:77] + "..."
	}
	return text
}

func sortedKeys(values map[string]bool) []string {
	result := make([]string, 0, len(values))
	for key := range values {
		result = append(result, key)
	}
	sort.Strings(result)
	return result
}
