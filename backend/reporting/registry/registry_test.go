package registry

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestDiscoverUsesDefaultRootAndDeterministicRecursiveOrder(t *testing.T) {
	workspace := t.TempDir()
	writeAsset(t, workspace, "extension/forge/reporting/zeta/preset.yaml", `
kind: forge.reporting.preset
id: delivery_brief
builderRef: performance
label: Delivery Brief
document:
  blocks:
    - {id: trend, kind: chartBlock, datasetRef: primary}
`)
	writeAsset(t, workspace, "extension/forge/reporting/alpha/builder.yaml", `
kind: forge.reporting.builder
id: performance
label: Performance
reportBuilder:
  dataSources:
    - {id: primary, dataSourceRef: delivery}
`)
	writeAsset(t, workspace, "extension/forge/reporting/middle/fragment.yaml", `
kind: forge.reporting.fragment
id: standard_filters
label: Standard Filters
blocks: []
`)

	got, err := Discover(context.Background(), Options{WorkspaceRoot: workspace})
	if err != nil {
		t.Fatalf("Discover() error = %v", err)
	}
	if got.Root != filepath.Join(workspace, filepath.FromSlash(DefaultRoot)) {
		t.Fatalf("unexpected root %q", got.Root)
	}
	if len(got.Builders) != 1 || got.Builders[0].ID != "performance" {
		t.Fatalf("unexpected builders %#v", got.Builders)
	}
	if len(got.Presets) != 1 || got.Presets[0].ID != "delivery_brief" {
		t.Fatalf("unexpected presets %#v", got.Presets)
	}
	if len(got.Fragments) != 1 || got.Fragments[0].ID != "standard_filters" {
		t.Fatalf("unexpected fragments %#v", got.Fragments)
	}
	if got.Preset("DELIVERY_BRIEF") == nil || got.Builder("Performance") == nil {
		t.Fatalf("expected case-insensitive registry lookup")
	}
}

func TestDiscoverSupportsConfiguredRootAndRejectsEscape(t *testing.T) {
	workspace := t.TempDir()
	writeAsset(t, workspace, "custom/reports/builder.yaml", `
kind: forge.reporting.builder
id: custom
reportBuilder: {}
`)
	got, err := Discover(context.Background(), Options{WorkspaceRoot: workspace, ReportingRoot: "custom/reports"})
	if err != nil {
		t.Fatalf("Discover() error = %v", err)
	}
	if got.Builder("custom") == nil {
		t.Fatalf("expected custom-root builder")
	}
	if _, err = ResolveRoot(workspace, "../outside"); err == nil {
		t.Fatalf("expected root escape to be rejected")
	}
}

func TestDiscoverExtractsLegacyEmbeddedPresets(t *testing.T) {
	workspace := t.TempDir()
	writeAsset(t, workspace, "extension/forge/reporting/performance/builder.yaml", `
kind: dashboard.reportBuilder
id: metricsCubeBuilder
reportBuilder:
  dataSources:
    - {id: primary, dataSourceRef: metrics}
  reportDocumentTemplates:
    - id: command_center
      label: Command Center
      description: Complete dashboard
      documentPatch:
        blocks:
          - {id: summary, kind: kpiBlock, datasetRef: primary}
`)

	got, err := Discover(context.Background(), Options{WorkspaceRoot: workspace})
	if err != nil {
		t.Fatalf("Discover() error = %v", err)
	}
	if len(got.Builders) != 1 || !got.Builders[0].Legacy {
		t.Fatalf("expected one compatibility builder, got %#v", got.Builders)
	}
	preset := got.Preset("command_center")
	if preset == nil || !preset.Legacy || preset.BuilderRef != "metricsCubeBuilder" {
		t.Fatalf("unexpected compatibility preset %#v", preset)
	}
	if preset.SourcePath != "extension/forge/reporting/performance/builder.yaml" {
		t.Fatalf("unexpected source path %q", preset.SourcePath)
	}
}

func TestDiscoverReportsDuplicateAndReferenceDiagnostics(t *testing.T) {
	workspace := t.TempDir()
	writeAsset(t, workspace, "extension/forge/reporting/a.yaml", `
kind: forge.reporting.builder
id: performance
reportBuilder:
  dataSources:
    - {id: primary}
    - {id: primary}
`)
	writeAsset(t, workspace, "extension/forge/reporting/b.yaml", `
kind: forge.reporting.builder
id: performance
reportBuilder: {}
`)
	writeAsset(t, workspace, "extension/forge/reporting/preset.yaml", `
kind: forge.reporting.preset
id: broken
builderRef: missing
document:
  blocks:
    - {id: duplicate, kind: chartBlock}
    - {id: duplicate, kind: tableBlock}
`)

	_, err := Discover(context.Background(), Options{WorkspaceRoot: workspace})
	var validationErr *ValidationError
	if !errors.As(err, &validationErr) {
		t.Fatalf("expected ValidationError, got %T %v", err, err)
	}
	codes := map[string]bool{}
	for _, diagnostic := range validationErr.Diagnostics {
		codes[diagnostic.Code] = true
		if diagnostic.SourcePath == "" || diagnostic.YAMLPath == "" {
			t.Fatalf("expected source-aware diagnostic: %#v", diagnostic)
		}
	}
	for _, code := range []string{"builderDataSourceDuplicate", "assetIDDuplicate", "presetBlockDuplicate", "presetBuilderUnavailable"} {
		if !codes[code] {
			t.Fatalf("missing diagnostic %q in %#v", code, validationErr.Diagnostics)
		}
	}
}

func TestDiscoverExpandsParameterizedFragmentsIntoPresetDocument(t *testing.T) {
	workspace := t.TempDir()
	writeAsset(t, workspace, "extension/forge/reporting/performance/builder.yaml", `
kind: forge.reporting.builder
id: performance
reportBuilder:
  dataSources:
    - {id: primary, dataSourceRef: delivery}
`)
	writeAsset(t, workspace, "extension/forge/reporting/fragments/filters.yaml", `
kind: forge.reporting.fragment
id: standard_filters
parameters:
  - {id: prefix, required: true}
  - {id: datasetRef, required: true}
  - {id: title, default: Filters}
blocks:
  - id: ${prefix}_filters
    kind: filterBarBlock
    title: ${title}
    datasetRef: ${datasetRef}
    paramIds: [dateRange, channel]
layout:
  items:
    - {blockId: "${prefix}_filters", span: 12}
`)
	writeAsset(t, workspace, "extension/forge/reporting/performance/presets/delivery.yaml", `
kind: forge.reporting.preset
id: delivery
builderRef: performance
label: Delivery
document:
  blocks:
    - fragmentRef: standard_filters
      params: {prefix: delivery, datasetRef: primary, title: Delivery Filters}
    - {id: trend, kind: chartBlock, datasetRef: primary}
  layout:
    type: grid
    items:
      - fragmentRef: standard_filters
        params: {prefix: delivery, datasetRef: primary, title: Delivery Filters}
      - {blockId: trend, span: 12}
`)

	got, err := Discover(context.Background(), Options{WorkspaceRoot: workspace})
	if err != nil {
		t.Fatalf("Discover() error = %v", err)
	}
	preset := got.Preset("delivery")
	if preset == nil {
		t.Fatal("expected expanded delivery preset")
	}
	document := mapValue(preset.Raw["document"])
	blocks := listValue(document["blocks"])
	if len(blocks) != 2 {
		t.Fatalf("expected two expanded blocks, got %#v", blocks)
	}
	filterBlock := mapValue(blocks[0])
	if filterBlock["id"] != "delivery_filters" || filterBlock["datasetRef"] != "primary" || filterBlock["title"] != "Delivery Filters" {
		t.Fatalf("unexpected expanded filter block %#v", filterBlock)
	}
	layoutItems := listValue(mapValue(document["layout"])["items"])
	if len(layoutItems) != 2 || mapValue(layoutItems[0])["blockId"] != "delivery_filters" || mapValue(layoutItems[0])["span"] != 12 {
		t.Fatalf("unexpected expanded layout %#v", layoutItems)
	}
	fragmentBlock := mapValue(listValue(got.Fragment("standard_filters").Raw["blocks"])[0])
	if fragmentBlock["id"] != "${prefix}_filters" {
		t.Fatalf("fragment template was mutated: %#v", fragmentBlock)
	}
}

func TestDiscoverReportsFragmentCompilationDiagnostics(t *testing.T) {
	workspace := t.TempDir()
	writeAsset(t, workspace, "extension/forge/reporting/builder.yaml", `
kind: forge.reporting.builder
id: performance
reportBuilder: {}
`)
	writeAsset(t, workspace, "extension/forge/reporting/fragments/bad.yaml", `
kind: forge.reporting.fragment
id: bad_fragment
parameters:
  - {id: prefix, required: true}
  - {id: prefix}
blocks:
  - id: ${prefix}_table
    kind: tableBlock
    datasetRef: hidden_source
    runtimeCode: alert(1)
`)
	writeAsset(t, workspace, "extension/forge/reporting/preset.yaml", `
kind: forge.reporting.preset
id: broken
builderRef: performance
document:
  blocks:
    - {fragmentRef: missing_fragment}
    - {fragmentRef: bad_fragment, params: {unknown: value}}
    - {fragmentRef: bad_fragment, params: {prefix: same}}
    - {fragmentRef: bad_fragment, params: {prefix: same}}
`)

	_, err := Discover(context.Background(), Options{WorkspaceRoot: workspace})
	var validationErr *ValidationError
	if !errors.As(err, &validationErr) {
		t.Fatalf("expected ValidationError, got %T %v", err, err)
	}
	codes := map[string]bool{}
	for _, diagnostic := range validationErr.Diagnostics {
		codes[diagnostic.Code] = true
		if diagnostic.SourcePath == "" || diagnostic.YAMLPath == "" {
			t.Fatalf("expected source-aware fragment diagnostic: %#v", diagnostic)
		}
	}
	for _, code := range []string{
		"fragmentParameterDuplicate",
		"fragmentDatasetRefMustBeParameterized",
		"fragmentRuntimeCodeUnsupported",
		"presetFragmentUnavailable",
		"fragmentParameterUnknown",
		"presetBlockDuplicate",
	} {
		if !codes[code] {
			t.Fatalf("missing diagnostic %q in %#v", code, validationErr.Diagnostics)
		}
	}
}

func TestLoaderRetainsLastValidRegistry(t *testing.T) {
	workspace := t.TempDir()
	path := writeAsset(t, workspace, "extension/forge/reporting/builder.yaml", `
kind: forge.reporting.builder
id: performance
reportBuilder: {}
`)
	loader := NewLoader(Options{WorkspaceRoot: workspace})
	first, err := loader.Reload(context.Background())
	if err != nil || first.Builder("performance") == nil {
		t.Fatalf("initial Reload() = %#v, %v", first, err)
	}
	if err = os.WriteFile(path, []byte("kind: [invalid"), 0o644); err != nil {
		t.Fatalf("write invalid asset: %v", err)
	}
	retained, err := loader.Reload(context.Background())
	if err == nil {
		t.Fatalf("expected invalid reload error")
	}
	if retained != first || loader.Current() != first {
		t.Fatalf("expected prior valid registry to remain active")
	}
}

func TestDiscoverConfiguredWorkspaceSmoke(t *testing.T) {
	workspace := os.Getenv("FORGE_REPORTING_TEST_WORKSPACE")
	if workspace == "" {
		t.Skip("FORGE_REPORTING_TEST_WORKSPACE is not configured")
	}
	got, err := Discover(context.Background(), Options{WorkspaceRoot: workspace})
	if err != nil {
		t.Fatalf("Discover(%q) error = %v", workspace, err)
	}
	if len(got.Builders) == 0 {
		t.Fatalf("Discover(%q) returned no reporting builders", workspace)
	}
	for _, asset := range append(append([]*Asset{}, got.Builders...), got.Presets...) {
		if asset.Legacy {
			t.Fatalf("Discover(%q) still depends on embedded compatibility asset %q from %s", workspace, asset.ID, asset.SourcePath)
		}
	}
}

func writeAsset(t *testing.T, workspace, relative, contents string) string {
	t.Helper()
	path := filepath.Join(workspace, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir asset: %v", err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write asset: %v", err)
	}
	return path
}
