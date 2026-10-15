package registry

import (
	"fmt"
	forgeTypes "github.com/viant/forge/backend/types"
	"strings"
)

// EnrichWindow attaches registry-owned builders and presets to a native Forge window.
// It is static metadata composition; it does not authorize or execute a datasource.
func (registry *Registry) EnrichWindow(window *forgeTypes.Window) error {
	if window == nil || window.View.Content == nil {
		return nil
	}
	content := window.View.Content
	if content.Kind != "dashboard.reportCatalog" && content.Kind != "dashboard.reportBuilder" {
		return nil
	}
	if registry == nil {
		return fmt.Errorf("workspace reporting registry is not initialized")
	}
	if content.Kind == "dashboard.reportCatalog" {
		if content.Dashboard == nil {
			content.Dashboard = &forgeTypes.Dashboard{}
		}
		if content.Dashboard.ReportCatalog == nil {
			content.Dashboard.ReportCatalog = map[string]any{}
		}
		content.Dashboard.ReportCatalog["groups"] = mergeDiscoveredReportGroups(
			listOfMaps(content.Dashboard.ReportCatalog["groups"]),
			registry.Groups,
		)
		return nil
	}
	if content.Dashboard == nil {
		return nil
	}
	if content.Dashboard.ReportBuilders != nil {
		for _, builder := range registry.Builders {
			if builder == nil {
				continue
			}
			content.Dashboard.ReportBuilders[builder.ID] = reportBuilderVariant(builder, registry.PresetsForBuilder(builder.ID))
		}
	}
	builderRef := strings.TrimSpace(content.Dashboard.ReportBuilderRef)
	if builderRef == "" {
		return nil
	}
	builder := registry.Builder(builderRef)
	if builder == nil {
		return fmt.Errorf("report builder %q is not available in workspace reporting root %s", builderRef, registry.Root)
	}
	base := reportBuilderConfig(builder.Raw)
	merged := mergeReportingMaps(base, content.Dashboard.ReportBuilder)
	merged["reportDocumentTemplates"] = mergeDiscoveredPresetTemplates(
		listOfMaps(merged["reportDocumentTemplates"]),
		registry.PresetsForBuilder(builder.ID),
	)
	content.Dashboard.ReportBuilder = merged
	return nil
}

func mergeDiscoveredReportGroups(existing []map[string]any, groups []*Asset) []any {
	result := make([]any, 0, len(groups)+len(existing))
	byID := map[string]int{}
	for _, group := range groups {
		if group == nil {
			continue
		}
		variant := reportGroupVariant(group)
		id := normalizeReportingID(variant["id"])
		if id == "" {
			continue
		}
		byID[id] = len(result)
		result = append(result, variant)
	}
	for _, configured := range existing {
		id := normalizeReportingID(configured["id"])
		if id == "" {
			continue
		}
		if index, ok := byID[id]; ok {
			merged := mergeReportingMaps(result[index].(map[string]any), configured)
			// The ID is the merge key. Keep the discovered canonical identity even
			// when the authored spelling differs only by case or whitespace.
			merged["id"] = result[index].(map[string]any)["id"]
			result[index] = merged
			continue
		}
		byID[id] = len(result)
		result = append(result, cloneReportingMap(configured))
	}
	return result
}

func reportGroupVariant(group *Asset) map[string]any {
	result := cloneReportingMap(group.Raw)
	delete(result, "kind")
	result["id"] = group.ID
	result["label"] = group.Label
	result["builderRef"] = group.BuilderRef
	if group.Description != "" {
		result["description"] = group.Description
	}
	if group.Icon != "" {
		result["icon"] = group.Icon
	}
	if group.Order != nil {
		result["order"] = *group.Order
	}
	if group.Visibility != "" {
		result["visibility"] = group.Visibility
	}
	if group.DefinitionRef != "" {
		result["definitionRef"] = group.DefinitionRef
	}
	if group.CatalogRef != "" {
		result["catalogRef"] = group.CatalogRef
	}
	if group.CatalogDataSourceRef != "" {
		result["catalogDataSourceRef"] = group.CatalogDataSourceRef
	}
	if group.DefinitionDataSourceRef != "" {
		result["definitionDataSourceRef"] = group.DefinitionDataSourceRef
	}
	if len(group.PresetRefs) > 0 {
		result["presetRefs"] = append([]string(nil), group.PresetRefs...)
	}
	if len(group.DefinitionRefs) > 0 {
		result["definitionRefs"] = append([]string(nil), group.DefinitionRefs...)
	}
	return result
}

func reportBuilderVariant(builder *Asset, presets []*Asset) map[string]any {
	config := reportBuilderConfig(builder.Raw)
	config["reportDocumentTemplates"] = mergeDiscoveredPresetTemplates(
		listOfMaps(config["reportDocumentTemplates"]),
		presets,
	)
	result := map[string]any{
		"id":            builder.ID,
		"reportBuilder": config,
	}
	if value, ok := builder.Raw["dataSourceRef"]; ok && value != nil {
		if dataSourceRef := strings.TrimSpace(fmt.Sprint(value)); dataSourceRef != "" {
			result["dataSourceRef"] = dataSourceRef
		}
	}
	if builder.Label != "" {
		result["label"] = builder.Label
	} else if rawTitle, ok := builder.Raw["title"]; ok && rawTitle != nil {
		if title := strings.TrimSpace(fmt.Sprint(rawTitle)); title != "" {
			result["label"] = title
		}
	}
	return result
}

func reportBuilderConfig(raw map[string]any) map[string]any {
	if nested, ok := raw["reportBuilder"].(map[string]any); ok {
		return cloneReportingMap(nested)
	}
	result := cloneReportingMap(raw)
	for _, key := range []string{"kind", "id", "label", "title", "description"} {
		delete(result, key)
	}
	return result
}

func mergeDiscoveredPresetTemplates(existing []map[string]any, presets []*Asset) []any {
	result := make([]any, 0, len(existing)+len(presets))
	byID := map[string]int{}
	for _, template := range existing {
		next := cloneReportingMap(template)
		next["sourceKind"] = "report"
		next["readOnly"] = true
		id := normalizeReportingID(next["id"])
		if id != "" {
			byID[id] = len(result)
		}
		result = append(result, next)
	}
	for _, preset := range presets {
		if preset == nil {
			continue
		}
		template := presetTemplate(preset)
		id := normalizeReportingID(template["id"])
		if id == "" {
			continue
		}
		if index, ok := byID[id]; ok {
			merged := mergeReportingMaps(result[index].(map[string]any), template)
			merged["id"] = result[index].(map[string]any)["id"]
			result[index] = merged
			continue
		}
		byID[id] = len(result)
		result = append(result, template)
	}
	return result
}

func presetTemplate(preset *Asset) map[string]any {
	result := cloneReportingMap(preset.Raw)
	result["id"] = preset.ID
	result["builderRef"] = preset.BuilderRef
	result["resourceUri"] = preset.ResourceURI
	result["sourceKind"] = "report"
	result["readOnly"] = true
	if preset.Label != "" {
		result["label"] = preset.Label
	}
	if preset.Description != "" {
		result["description"] = preset.Description
	}
	if document, ok := result["document"].(map[string]any); ok {
		result["documentPatch"] = document
		delete(result, "document")
	}
	delete(result, "kind")
	return result
}

func mergeReportingMaps(base, override map[string]any) map[string]any {
	result := cloneReportingMap(base)
	for key, value := range override {
		if overrideMap, ok := value.(map[string]any); ok {
			if baseMap, baseOK := result[key].(map[string]any); baseOK {
				result[key] = mergeReportingMaps(baseMap, overrideMap)
				continue
			}
		}
		result[key] = cloneReportingValue(value)
	}
	return result
}

func cloneReportingMap(source map[string]any) map[string]any {
	result := make(map[string]any, len(source))
	for key, value := range source {
		result[key] = cloneReportingValue(value)
	}
	return result
}

func cloneReportingValue(value any) any {
	switch actual := value.(type) {
	case map[string]any:
		return cloneReportingMap(actual)
	case []any:
		result := make([]any, len(actual))
		for index, item := range actual {
			result[index] = cloneReportingValue(item)
		}
		return result
	default:
		return actual
	}
}

func listOfMaps(value any) []map[string]any {
	items, _ := value.([]any)
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if mapped, ok := item.(map[string]any); ok {
			result = append(result, mapped)
		}
	}
	return result
}

func normalizeReportingID(value any) string {
	if value == nil {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(fmt.Sprint(value)))
}
