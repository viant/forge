package registry

import (
	"reflect"
	"strings"
	"testing"

	forgeTypes "github.com/viant/forge/backend/types"
)

func TestEnrichWindowMergesReportCatalogGroups(t *testing.T) {
	registry := &Registry{Groups: []*Asset{
		{ID: "delivery", Kind: KindGroup, Label: "Discovered delivery", BuilderRef: "performance", CatalogDataSourceRef: "catalog", Raw: map[string]any{
			"custom": map[string]any{"tags": []any{"registry"}},
		}},
		{ID: "new-group", Kind: KindGroup, Label: "New group", BuilderRef: "performance"},
	}}
	authored := []any{
		map[string]any{"id": " DELIVERY ", "label": "Authored label", "builderRef": "custom-builder", "settings": map[string]any{"color": "blue"}},
		map[string]any{"id": "local-only", "label": "Local group", "children": []any{map[string]any{"name": "nested"}}},
	}
	authoredBefore := cloneReportingValue(authored)
	window := reportWindow("dashboard.reportCatalog", &forgeTypes.Dashboard{ReportCatalog: map[string]any{
		"title": "Reports", "groups": authored,
	}})

	if err := registry.EnrichWindow(window); err != nil {
		t.Fatalf("EnrichWindow() error = %v", err)
	}
	groups, ok := window.View.Content.Dashboard.ReportCatalog["groups"].([]any)
	if !ok || len(groups) != 3 {
		t.Fatalf("expected discovered and authored groups, got %#v", window.View.Content.Dashboard.ReportCatalog["groups"])
	}
	merged := groups[0].(map[string]any)
	if merged["id"] != "delivery" || merged["label"] != "Authored label" || merged["builderRef"] != "custom-builder" || merged["catalogDataSourceRef"] != "catalog" {
		t.Fatalf("discovered group was not merged with authored values and references: %#v", merged)
	}
	if window.View.Content.Dashboard.ReportCatalog["title"] != "Reports" || groups[1].(map[string]any)["id"] != "new-group" || groups[2].(map[string]any)["id"] != "local-only" {
		t.Fatalf("unexpected catalog merge: %#v", groups)
	}
	if !reflect.DeepEqual(authored, authoredBefore) {
		t.Fatalf("authored catalog source was mutated: before=%#v after=%#v", authoredBefore, authored)
	}
	merged["settings"].(map[string]any)["color"] = "red"
	merged["custom"].(map[string]any)["tags"].([]any)[0] = "changed"
	if !reflect.DeepEqual(authored, authoredBefore) {
		t.Fatalf("mutating enriched output changed authored nested maps or arrays: %#v", authored)
	}
	if got := registry.Groups[0].Raw["custom"].(map[string]any)["tags"].([]any)[0]; got != "registry" {
		t.Fatalf("mutating enriched output changed registry source: %v", got)
	}
}

func TestEnrichWindowComposesReportBuilderAndPresets(t *testing.T) {
	builder := &Asset{ID: "performance", Kind: KindBuilder, Label: "Performance", Raw: map[string]any{
		"dataSourceRef": " metrics ",
		"reportBuilder": map[string]any{
			"dataSources":             []any{map[string]any{"id": "primary", "dataSourceRef": "metrics"}},
			"reportDocumentTemplates": []any{map[string]any{"id": "overview", "label": "Registry overview", "document": map[string]any{"blocks": []any{map[string]any{"id": "trend"}}}}},
			"custom":                  map[string]any{"nested": []any{"registry"}},
		},
	}}
	preset := &Asset{ID: "overview", Kind: KindPreset, BuilderRef: "performance", Label: "Authored overview", ResourceURI: "workspace://reports/overview", Raw: map[string]any{
		"document": map[string]any{"blocks": []any{map[string]any{"id": "summary", "kind": "kpiBlock"}}},
		"custom":   map[string]any{"nested": []any{"preset"}},
	}}
	registry := registryWithBuilder(builder, preset)
	authoredConfig := map[string]any{
		"dataSources":             []any{map[string]any{"id": "secondary", "dataSourceRef": "secondary_source"}},
		"reportDocumentTemplates": []any{map[string]any{"id": "local-template", "documentPatch": map[string]any{"blocks": []any{}}}},
		"custom":                  map[string]any{"authored": []any{map[string]any{"keep": true}}},
	}
	builderBefore := cloneReportingValue(builder.Raw)
	presetBefore := cloneReportingValue(preset.Raw)
	authoredBefore := cloneReportingValue(authoredConfig)
	window := reportWindow("dashboard.reportBuilder", &forgeTypes.Dashboard{
		ReportBuilderRef: " performance ",
		ReportBuilders:   map[string]map[string]any{"local": {"label": "Local builder"}},
		ReportBuilder:    authoredConfig,
	})

	if err := registry.EnrichWindow(window); err != nil {
		t.Fatalf("EnrichWindow() error = %v", err)
	}
	dashboard := window.View.Content.Dashboard
	if dashboard.ReportBuilders["performance"]["dataSourceRef"] != "metrics" {
		t.Fatalf("builder variant did not retain its datasource reference: %#v", dashboard.ReportBuilders)
	}
	if dashboard.ReportBuilders["local"]["label"] != "Local builder" {
		t.Fatalf("existing builder variants were dropped: %#v", dashboard.ReportBuilders)
	}
	if dashboard.ReportBuilder["dataSources"].([]any)[0].(map[string]any)["dataSourceRef"] != "secondary_source" {
		t.Fatalf("authored datasource refs were not preserved: %#v", dashboard.ReportBuilder["dataSources"])
	}
	templates := dashboard.ReportBuilder["reportDocumentTemplates"].([]any)
	if len(templates) != 2 || templates[0].(map[string]any)["id"] != "local-template" || templates[1].(map[string]any)["id"] != "overview" {
		t.Fatalf("expected authored and discovered preset templates: %#v", templates)
	}
	discovered := templates[1].(map[string]any)
	if discovered["sourceKind"] != "report" || discovered["readOnly"] != true || discovered["resourceUri"] != preset.ResourceURI {
		t.Fatalf("discovered preset metadata missing: %#v", discovered)
	}
	if _, ok := discovered["documentPatch"].(map[string]any); !ok {
		t.Fatalf("preset document was not composed as documentPatch: %#v", discovered)
	}
	if !reflect.DeepEqual(builder.Raw, builderBefore) || !reflect.DeepEqual(preset.Raw, presetBefore) || !reflect.DeepEqual(authoredConfig, authoredBefore) {
		t.Fatalf("enrichment mutated registry or authored sources")
	}
	// The result owns its nested data too: edits must not flow back to any source.
	dashboard.ReportBuilder["custom"].(map[string]any)["authored"].([]any)[0].(map[string]any)["keep"] = false
	discovered["documentPatch"].(map[string]any)["blocks"].([]any)[0].(map[string]any)["id"] = "edited"
	if !reflect.DeepEqual(builder.Raw, builderBefore) || !reflect.DeepEqual(preset.Raw, presetBefore) || !reflect.DeepEqual(authoredConfig, authoredBefore) {
		t.Fatalf("mutating enriched builder changed nested source maps or arrays")
	}
}

func TestEnrichWindowReportBuilderAbsentAndUnknown(t *testing.T) {
	registry := registryWithBuilder(&Asset{ID: "known", Raw: map[string]any{"dataSourceRef": "source"}}, nil)
	window := reportWindow("dashboard.reportBuilder", &forgeTypes.Dashboard{ReportBuilder: map[string]any{"keep": true}})
	if err := registry.EnrichWindow(window); err != nil {
		t.Fatalf("builder ref is optional: %v", err)
	}
	if window.View.Content.Dashboard.ReportBuilder["keep"] != true {
		t.Fatalf("absent builder ref should leave authored config intact: %#v", window.View.Content.Dashboard.ReportBuilder)
	}
	window.View.Content.Dashboard.ReportBuilderRef = "missing"
	err := registry.EnrichWindow(window)
	if err == nil || !strings.Contains(err.Error(), `report builder "missing" is not available`) {
		t.Fatalf("expected useful unknown-builder error, got %v", err)
	}
}

func TestEnrichWindowIgnoresMissingAndNullCatalogIDs(t *testing.T) {
	window := reportWindow("dashboard.reportCatalog", &forgeTypes.Dashboard{ReportCatalog: map[string]any{
		"groups": []any{
			map[string]any{"label": "No identity"},
			map[string]any{"id": nil, "label": "Null identity"},
			map[string]any{"id": "kept", "label": "Kept"},
		},
	}})
	if err := (&Registry{}).EnrichWindow(window); err != nil {
		t.Fatalf("EnrichWindow() error = %v", err)
	}
	groups := window.View.Content.Dashboard.ReportCatalog["groups"].([]any)
	if len(groups) != 1 || groups[0].(map[string]any)["id"] != "kept" {
		t.Fatalf("missing or null IDs became catalog identities: %#v", groups)
	}
}

func TestReportBuilderVariantOmitsAbsentOptionalDataSourceRef(t *testing.T) {
	for _, raw := range []map[string]any{nil, {}, {"dataSourceRef": nil}, {"dataSourceRef": "  "}} {
		variant := reportBuilderVariant(&Asset{ID: "builder", Raw: raw}, nil)
		if _, ok := variant["dataSourceRef"]; ok {
			t.Errorf("absent dataSourceRef should be omitted, raw=%#v variant=%#v", raw, variant)
		}
	}
}

func TestEnrichWindowLeavesOtherKindsAndNilWindowsAlone(t *testing.T) {
	if err := (*Registry)(nil).EnrichWindow(nil); err != nil {
		t.Fatalf("nil window should be ignored: %v", err)
	}
	window := reportWindow("dashboard.summary", &forgeTypes.Dashboard{ReportCatalog: map[string]any{"groups": []any{}}})
	if err := (*Registry)(nil).EnrichWindow(window); err != nil {
		t.Fatalf("non-registry window should be ignored: %v", err)
	}
}

func reportWindow(kind string, dashboard *forgeTypes.Dashboard) *forgeTypes.Window {
	return &forgeTypes.Window{View: forgeTypes.View{Content: &forgeTypes.Container{Kind: kind, Dashboard: dashboard}}}
}

func registryWithBuilder(builder *Asset, presets ...*Asset) *Registry {
	builders := map[string]*Asset{}
	if builder != nil {
		builders[normalizeID(builder.ID)] = builder
	}
	return &Registry{Builders: []*Asset{builder}, Presets: presets, buildersByID: builders}
}
