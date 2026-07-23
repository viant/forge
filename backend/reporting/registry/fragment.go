package registry

import (
	"fmt"
	"strings"
)

const fragmentMacroPrefix = "${"

type fragmentParameter struct {
	ID         string
	Required   bool
	Default    any
	HasDefault bool
}

func (r *Registry) expandFragments() []Diagnostic {
	diagnostics := make([]Diagnostic, 0)
	for _, fragment := range r.Fragments {
		diagnostics = append(diagnostics, validateFragmentDefinition(fragment)...)
	}
	for _, preset := range r.Presets {
		diagnostics = append(diagnostics, r.expandPresetFragments(preset)...)
	}
	return diagnostics
}

func validateFragmentDefinition(fragment *Asset) []Diagnostic {
	if fragment == nil {
		return nil
	}
	diagnostics := duplicateIDs(
		listValue(fragment.Raw["blocks"]),
		fragment.SourcePath,
		fragment.YAMLPath+".blocks",
		"fragmentBlockDuplicate",
		"block",
	)
	parameters, parameterDiagnostics := parseFragmentParameters(fragment)
	diagnostics = append(diagnostics, parameterDiagnostics...)
	declared := map[string]bool{}
	for _, parameter := range parameters {
		declared[normalizeID(parameter.ID)] = true
	}
	walkFragmentValue(fragment.Raw, fragment.YAMLPath, func(path, key string, value any) {
		normalizedKey := strings.ToLower(strings.TrimSpace(key))
		if normalizedKey == "script" || normalizedKey == "javascript" || normalizedKey == "runtimecode" {
			diagnostics = append(diagnostics, Diagnostic{
				Code:       "fragmentRuntimeCodeUnsupported",
				Message:    fmt.Sprintf("fragment %q cannot contain runtime code", fragment.ID),
				SourcePath: fragment.SourcePath,
				YAMLPath:   path,
			})
		}
		if normalizedKey != "datasetref" {
			return
		}
		text, ok := value.(string)
		parameterID, exact := exactFragmentMacro(text)
		if !ok || !exact || !declared[normalizeID(parameterID)] {
			diagnostics = append(diagnostics, Diagnostic{
				Code:       "fragmentDatasetRefMustBeParameterized",
				Message:    fmt.Sprintf("fragment %q datasetRef must use one declared parameter", fragment.ID),
				SourcePath: fragment.SourcePath,
				YAMLPath:   path,
			})
		}
	})
	return diagnostics
}

func (r *Registry) expandPresetFragments(preset *Asset) []Diagnostic {
	if preset == nil {
		return nil
	}
	documentKey := "document"
	document := mapValue(preset.Raw[documentKey])
	if len(document) == 0 {
		documentKey = "documentPatch"
		document = mapValue(preset.Raw[documentKey])
	}
	if len(document) == 0 {
		return nil
	}
	nextDocument := cloneMap(document)
	diagnostics := make([]Diagnostic, 0)
	blocks, blockDiagnostics := r.expandFragmentEntries(
		preset,
		listValue(document["blocks"]),
		preset.YAMLPath+"."+documentKey+".blocks",
		"blocks",
	)
	diagnostics = append(diagnostics, blockDiagnostics...)
	nextDocument["blocks"] = blocks

	if layout := mapValue(document["layout"]); len(layout) > 0 {
		nextLayout := cloneMap(layout)
		items, layoutDiagnostics := r.expandFragmentEntries(
			preset,
			listValue(layout["items"]),
			preset.YAMLPath+"."+documentKey+".layout.items",
			"layout",
		)
		diagnostics = append(diagnostics, layoutDiagnostics...)
		nextLayout["items"] = items
		nextDocument["layout"] = nextLayout
	}

	diagnostics = append(diagnostics, duplicateIDs(
		blocks,
		preset.SourcePath,
		preset.YAMLPath+"."+documentKey+".blocks",
		"presetBlockDuplicate",
		"block",
	)...)
	diagnostics = append(diagnostics, r.validateExpandedLayoutReferences(
		preset,
		blocks,
		mapValue(nextDocument["layout"]),
		preset.YAMLPath+"."+documentKey+".layout",
	)...)

	nextRaw := cloneMap(preset.Raw)
	nextRaw[documentKey] = nextDocument
	preset.Raw = nextRaw
	return diagnostics
}

func (r *Registry) expandFragmentEntries(preset *Asset, entries []any, yamlPath, section string) ([]any, []Diagnostic) {
	result := make([]any, 0, len(entries))
	diagnostics := make([]Diagnostic, 0)
	for index, item := range entries {
		entry := mapValue(item)
		fragmentRef := stringValue(entry["fragmentRef"])
		if fragmentRef == "" {
			result = append(result, cloneValue(item))
			continue
		}
		entryPath := fmt.Sprintf("%s[%d]", yamlPath, index)
		fragment := r.Fragment(fragmentRef)
		if fragment == nil {
			diagnostics = append(diagnostics, Diagnostic{
				Code:       "presetFragmentUnavailable",
				Message:    fmt.Sprintf("preset %q references unavailable fragment %q", preset.ID, fragmentRef),
				SourcePath: preset.SourcePath,
				YAMLPath:   entryPath + ".fragmentRef",
			})
			continue
		}
		params, paramDiagnostics := resolveFragmentParams(fragment, mapValue(entry["params"]), preset.SourcePath, entryPath+".params")
		diagnostics = append(diagnostics, paramDiagnostics...)
		if len(paramDiagnostics) > 0 {
			continue
		}
		var sourceEntries []any
		if section == "layout" {
			sourceEntries = listValue(mapValue(fragment.Raw["layout"])["items"])
			if len(sourceEntries) == 0 {
				for _, block := range listValue(fragment.Raw["blocks"]) {
					expanded := substituteFragmentValue(block, params)
					blockID := stringValue(mapValue(expanded)["id"])
					if blockID != "" {
						sourceEntries = append(sourceEntries, map[string]any{"blockId": blockID})
					}
				}
			}
		} else {
			sourceEntries = listValue(fragment.Raw["blocks"])
		}
		for _, sourceEntry := range sourceEntries {
			result = append(result, substituteFragmentValue(sourceEntry, params))
		}
	}
	return result, diagnostics
}

func parseFragmentParameters(fragment *Asset) ([]fragmentParameter, []Diagnostic) {
	items := listValue(fragment.Raw["parameters"])
	result := make([]fragmentParameter, 0, len(items))
	diagnostics := make([]Diagnostic, 0)
	seen := map[string]bool{}
	for index, item := range items {
		entry := mapValue(item)
		id := stringValue(entry["id"])
		path := fmt.Sprintf("%s.parameters[%d].id", fragment.YAMLPath, index)
		if id == "" {
			diagnostics = append(diagnostics, Diagnostic{Code: "fragmentParameterIDRequired", Message: fmt.Sprintf("fragment %q parameter id is required", fragment.ID), SourcePath: fragment.SourcePath, YAMLPath: path})
			continue
		}
		key := normalizeID(id)
		if seen[key] {
			diagnostics = append(diagnostics, Diagnostic{Code: "fragmentParameterDuplicate", Message: fmt.Sprintf("fragment %q contains duplicate parameter %q", fragment.ID, id), SourcePath: fragment.SourcePath, YAMLPath: path})
			continue
		}
		seen[key] = true
		defaultValue, hasDefault := entry["default"]
		result = append(result, fragmentParameter{ID: id, Required: boolValue(entry["required"]), Default: cloneValue(defaultValue), HasDefault: hasDefault})
	}
	return result, diagnostics
}

func resolveFragmentParams(fragment *Asset, supplied map[string]any, sourcePath, yamlPath string) (map[string]any, []Diagnostic) {
	definitions, _ := parseFragmentParameters(fragment)
	diagnostics := make([]Diagnostic, 0)
	known := map[string]fragmentParameter{}
	for _, definition := range definitions {
		known[normalizeID(definition.ID)] = definition
	}
	result := map[string]any{}
	for key, value := range supplied {
		definition, ok := known[normalizeID(key)]
		if !ok {
			diagnostics = append(diagnostics, Diagnostic{Code: "fragmentParameterUnknown", Message: fmt.Sprintf("fragment %q does not declare parameter %q", fragment.ID, key), SourcePath: sourcePath, YAMLPath: yamlPath + "." + key})
			continue
		}
		result[definition.ID] = cloneValue(value)
	}
	for _, definition := range definitions {
		if _, ok := result[definition.ID]; ok {
			continue
		}
		if definition.HasDefault {
			result[definition.ID] = cloneValue(definition.Default)
			continue
		}
		if definition.Required {
			diagnostics = append(diagnostics, Diagnostic{Code: "fragmentParameterRequired", Message: fmt.Sprintf("fragment %q requires parameter %q", fragment.ID, definition.ID), SourcePath: sourcePath, YAMLPath: yamlPath + "." + definition.ID})
		}
	}
	return result, diagnostics
}

func substituteFragmentValue(value any, params map[string]any) any {
	switch actual := value.(type) {
	case []any:
		result := make([]any, len(actual))
		for index, item := range actual {
			result[index] = substituteFragmentValue(item, params)
		}
		return result
	case map[string]any:
		result := make(map[string]any, len(actual))
		for key, item := range actual {
			result[key] = substituteFragmentValue(item, params)
		}
		return result
	case string:
		if parameterID, exact := exactFragmentMacro(actual); exact {
			if replacement, ok := lookupFragmentParam(params, parameterID); ok {
				return cloneValue(replacement)
			}
		}
		result := actual
		for key, replacement := range params {
			result = strings.ReplaceAll(result, "${"+key+"}", fmt.Sprint(replacement))
		}
		return result
	default:
		return cloneValue(value)
	}
}

func exactFragmentMacro(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if !strings.HasPrefix(value, fragmentMacroPrefix) || !strings.HasSuffix(value, "}") || strings.Count(value, fragmentMacroPrefix) != 1 {
		return "", false
	}
	id := strings.TrimSpace(value[2 : len(value)-1])
	return id, id != ""
}

func lookupFragmentParam(params map[string]any, id string) (any, bool) {
	for key, value := range params {
		if normalizeID(key) == normalizeID(id) {
			return value, true
		}
	}
	return nil, false
}

func (r *Registry) validateExpandedLayoutReferences(preset *Asset, blocks []any, layout map[string]any, yamlPath string) []Diagnostic {
	known := map[string]bool{}
	for _, item := range blocks {
		if id := stringValue(mapValue(item)["id"]); id != "" {
			known[normalizeID(id)] = true
		}
	}
	if builder := r.Builder(preset.BuilderRef); builder != nil {
		if _, configured := builder.Raw["reportBuilder"]; configured {
			known[normalizeID("primaryBuilder")] = true
		}
	}
	diagnostics := make([]Diagnostic, 0)
	walkFragmentValue(layout, yamlPath, func(path, key string, value any) {
		if strings.EqualFold(strings.TrimSpace(key), "blockId") {
			blockID := stringValue(value)
			if blockID != "" && !known[normalizeID(blockID)] {
				diagnostics = append(diagnostics, Diagnostic{Code: "presetLayoutBlockUnavailable", Message: fmt.Sprintf("preset %q layout references unavailable block %q", preset.ID, blockID), SourcePath: preset.SourcePath, YAMLPath: path})
			}
		}
	})
	return diagnostics
}

func walkFragmentValue(value any, path string, visit func(path, key string, value any)) {
	switch actual := value.(type) {
	case []any:
		for index, item := range actual {
			walkFragmentValue(item, fmt.Sprintf("%s[%d]", path, index), visit)
		}
	case map[string]any:
		for key, item := range actual {
			nextPath := path + "." + key
			visit(nextPath, key, item)
			walkFragmentValue(item, nextPath, visit)
		}
	}
}

func cloneMap(value map[string]any) map[string]any {
	result := make(map[string]any, len(value))
	for key, item := range value {
		result[key] = cloneValue(item)
	}
	return result
}

func cloneValue(value any) any {
	switch actual := value.(type) {
	case []any:
		result := make([]any, len(actual))
		for index, item := range actual {
			result[index] = cloneValue(item)
		}
		return result
	case map[string]any:
		return cloneMap(actual)
	default:
		return actual
	}
}

func boolValue(value any) bool {
	result, _ := value.(bool)
	return result
}
