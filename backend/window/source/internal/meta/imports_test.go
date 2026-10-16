// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package meta

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/viant/afs"
	"gopkg.in/yaml.v3"
)

func TestResolveImports_ResolvesNestedTopLevelScalarImports(t *testing.T) {
	root := t.TempDir()
	mustWriteImportFile(t, filepath.Join(root, "main.yaml"), "$import(shared/main.yaml)\n")
	mustWriteImportFile(t, filepath.Join(root, "shared", "main.yaml"), "$import(web/main.yaml)\n")
	mustWriteImportFile(t, filepath.Join(root, "shared", "web", "main.yaml"), "id: order\nwindowKey: order\n")

	data, err := os.ReadFile(filepath.Join(root, "main.yaml"))
	if err != nil {
		t.Fatalf("read root yaml: %v", err)
	}
	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		t.Fatalf("unmarshal root yaml: %v", err)
	}
	if err := ResolveImports(context.Background(), afs.New(), &node, root); err != nil {
		t.Fatalf("resolve imports: %v", err)
	}
	var actual struct {
		ID        string `yaml:"id"`
		WindowKey string `yaml:"windowKey"`
	}
	if err := node.Decode(&actual); err != nil {
		t.Fatalf("decode resolved yaml: %v", err)
	}
	if actual.ID != "order" || actual.WindowKey != "order" {
		t.Fatalf("unexpected resolved content: %#v", actual)
	}
}

func TestServiceListRecursiveLoadResolvesFileURLImport(t *testing.T) {
	root := t.TempDir()
	mustWriteImportFile(t, filepath.Join(root, "datasources", "advanced_reporting.yaml"), `'$import(../shared/datasource.yaml:datasource, {"id":"advanced_reporting"})'`)
	mustWriteImportFile(t, filepath.Join(root, "shared", "datasource.yaml"), "datasource:\n  id: $param(id)\n  backend:\n    kind: inline\n")

	service := New(afs.New(), root)
	paths, err := service.ListRecursive(context.Background(), "datasources")
	if err != nil || len(paths) != 1 {
		t.Fatalf("list recursive paths=%v err=%v", paths, err)
	}
	var actual struct {
		ID string `yaml:"id"`
	}
	if err := service.Load(context.Background(), paths[0], &actual); err != nil {
		t.Fatalf("load recursively discovered file URL import: %v", err)
	}
	if actual.ID != "advanced_reporting" {
		t.Fatalf("unexpected imported datasource: %#v", actual)
	}
}

func TestResolveImports_SelectsYAMLKeyAndResolvesNestedImports(t *testing.T) {
	root := t.TempDir()
	mustWriteImportFile(t, filepath.Join(root, "main.yaml"), `
reportBuilder:
  $import(shared/report_builder.yaml:reportBuilder)
`)
	mustWriteImportFile(t, filepath.Join(root, "shared", "report_builder.yaml"), `
reportBuilder:
  filterPresentation: rail-left
  title: $import(title.txt)
other:
  filterPresentation: ignored
`)
	mustWriteImportFile(t, filepath.Join(root, "shared", "title.txt"), "Performance Metrics")

	data, err := os.ReadFile(filepath.Join(root, "main.yaml"))
	if err != nil {
		t.Fatalf("read root yaml: %v", err)
	}
	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		t.Fatalf("unmarshal root yaml: %v", err)
	}
	if err := ResolveImports(context.Background(), afs.New(), &node, root); err != nil {
		t.Fatalf("resolve imports: %v", err)
	}
	var actual struct {
		ReportBuilder map[string]string `yaml:"reportBuilder"`
	}
	if err := node.Decode(&actual); err != nil {
		t.Fatalf("decode resolved yaml: %v", err)
	}
	if actual.ReportBuilder["filterPresentation"] != "rail-left" {
		t.Fatalf("expected keyed reportBuilder import, got %#v", actual.ReportBuilder)
	}
	if actual.ReportBuilder["title"] != "Performance Metrics" {
		t.Fatalf("expected nested import inside keyed node, got %#v", actual.ReportBuilder)
	}
}

func TestResolveImports_PreservesMobileTargetOverridesWithImportedBuilderContent(t *testing.T) {
	root := t.TempDir()
	mustWriteImportFile(t, filepath.Join(root, "windows", "reportBuilder.yaml"), "$import(reportBuilder/shared/main.yaml)\n")
	mustWriteImportFile(t, filepath.Join(root, "windows", "reportBuilder", "shared", "main.yaml"), `
id: reportBuilder
windowKey: reportBuilder
view:
  content:
    $import(content.yaml)
`)
	mustWriteImportFile(t, filepath.Join(root, "windows", "reportBuilder", "shared", "content.yaml"), `
kind: dashboard.reportBuilder
id: reportBuilderContent
reportBuilder:
  $import('../../shared/report_builder.yaml:reportBuilder')
targetOverrides:
  mobile:
    reportBuilder:
      filterPresentation: drawer-left
  tablet:
    reportBuilder:
      filterPresentation: rail-left
  android:
    reportBuilder:
      touchDensity: roomy
  phone:
    reportBuilder:
      filterPresentation: drawer-left
      unifiedFamilyRows: true
  android:phone:
    reportBuilder:
      bottomSheetFilters: true
  iosTablet:
    reportBuilder:
      filterSummaryMode: pinned
`)
	mustWriteImportFile(t, filepath.Join(root, "windows", "shared", "report_builder.yaml"), `
reportBuilder:
  filterPresentation: rail-left
  resultMode: table
  export:
    enabled: true
ignored:
  resultMode: chart
`)

	data, err := os.ReadFile(filepath.Join(root, "windows", "reportBuilder.yaml"))
	if err != nil {
		t.Fatalf("read root yaml: %v", err)
	}
	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		t.Fatalf("unmarshal root yaml: %v", err)
	}
	if err := ResolveImports(context.Background(), afs.New(), &node, filepath.Join(root, "windows")); err != nil {
		t.Fatalf("resolve imports: %v", err)
	}
	var actual struct {
		ID        string `yaml:"id"`
		WindowKey string `yaml:"windowKey"`
		View      struct {
			Content struct {
				Kind            string                 `yaml:"kind"`
				ReportBuilder   map[string]interface{} `yaml:"reportBuilder"`
				TargetOverrides map[string]struct {
					ReportBuilder map[string]interface{} `yaml:"reportBuilder"`
				} `yaml:"targetOverrides"`
			} `yaml:"content"`
		} `yaml:"view"`
	}
	if err := node.Decode(&actual); err != nil {
		t.Fatalf("decode resolved yaml: %v", err)
	}
	if actual.ID != "reportBuilder" || actual.WindowKey != "reportBuilder" {
		t.Fatalf("unexpected resolved window identity: %#v", actual)
	}
	if actual.View.Content.Kind != "dashboard.reportBuilder" {
		t.Fatalf("expected imported report-builder content, got %q", actual.View.Content.Kind)
	}
	if actual.View.Content.ReportBuilder["filterPresentation"] != "rail-left" {
		t.Fatalf("expected keyed reportBuilder import, got %#v", actual.View.Content.ReportBuilder)
	}
	if actual.View.Content.ReportBuilder["resultMode"] != "table" {
		t.Fatalf("expected selected reportBuilder key to ignore sibling keys, got %#v", actual.View.Content.ReportBuilder)
	}
	if export, ok := actual.View.Content.ReportBuilder["export"].(map[string]interface{}); !ok || export["enabled"] != true {
		t.Fatalf("expected nested reportBuilder object import, got %#v", actual.View.Content.ReportBuilder["export"])
	}
	if actual.View.Content.TargetOverrides["mobile"].ReportBuilder["filterPresentation"] != "drawer-left" {
		t.Fatalf("expected mobile target override to survive import, got %#v", actual.View.Content.TargetOverrides)
	}
	if actual.View.Content.TargetOverrides["tablet"].ReportBuilder["filterPresentation"] != "rail-left" {
		t.Fatalf("expected tablet target override to survive import, got %#v", actual.View.Content.TargetOverrides)
	}
	if actual.View.Content.TargetOverrides["phone"].ReportBuilder["unifiedFamilyRows"] != true {
		t.Fatalf("expected phone target override to survive import, got %#v", actual.View.Content.TargetOverrides)
	}
	if actual.View.Content.TargetOverrides["android"].ReportBuilder["touchDensity"] != "roomy" {
		t.Fatalf("expected android target override to survive import, got %#v", actual.View.Content.TargetOverrides)
	}
	if actual.View.Content.TargetOverrides["android:phone"].ReportBuilder["bottomSheetFilters"] != true {
		t.Fatalf("expected android:phone target override to survive import, got %#v", actual.View.Content.TargetOverrides)
	}
	if actual.View.Content.TargetOverrides["iosTablet"].ReportBuilder["filterSummaryMode"] != "pinned" {
		t.Fatalf("expected iosTablet target override to survive import, got %#v", actual.View.Content.TargetOverrides)
	}
}

func TestResolveImports_ParameterizedFragmentInstantiatesIndependentTargetingCards(t *testing.T) {
	root := t.TempDir()
	mustWriteImportFile(t, filepath.Join(root, "main.yaml"), `
containers:
  - '$import(shared/targeting.yaml:card, {"prefix":"advertiser","dataSourceRef":"advertiser_defaults","dataRoot":"targetingGroups","handlerNamespace":"Advertiser Workspace","readOnly":false,"layout":{"kind":"grid","columns":2},"visibleWhen":{"source":"authorization","field":"resource.capabilities.write","equals":true},"options":["context","location"]})'
  - '$import(shared/targeting.yaml:card, {"prefix":"line","dataSourceRef":"line_properties","dataRoot":"targeting","handlerNamespace":"Line Workspace","readOnly":true,"layout":{"kind":"grid","columns":1},"visibleWhen":{"source":"authorization","field":"resource.capabilities.read","equals":true},"options":["location"]})'
`)
	mustWriteImportFile(t, filepath.Join(root, "shared", "targeting.yaml"), `
card:
  id: $param(prefix)Targeting
  dataSourceRef: $param(dataSourceRef)
  stateKey: $param(prefix)-$param(dataRoot)-collapsed
  readOnly: $param(readOnly)
  layout: $param(layout)
  visibleWhen: $param(visibleWhen)
  options: $param(options)
  items:
    - '$import(nested/item.yaml:item, {"prefix":"nested","dataRoot":"$param(dataRoot)"})'
    - id: $param(prefix)Sibling
      dataField: $param(dataRoot).context
      handler: $param(handlerNamespace).updateTargeting
`)
	mustWriteImportFile(t, filepath.Join(root, "shared", "nested", "item.yaml"), `
item:
  id: $param(prefix)Item
  dataField: $param(dataRoot).location
`)

	data, err := os.ReadFile(filepath.Join(root, "main.yaml"))
	if err != nil {
		t.Fatalf("read root yaml: %v", err)
	}
	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		t.Fatalf("unmarshal root yaml: %v", err)
	}
	if err := ResolveImports(context.Background(), afs.New(), &node, root); err != nil {
		t.Fatalf("resolve imports: %v", err)
	}
	var actual struct {
		Containers []struct {
			ID            string                 `yaml:"id"`
			DataSourceRef string                 `yaml:"dataSourceRef"`
			StateKey      string                 `yaml:"stateKey"`
			ReadOnly      bool                   `yaml:"readOnly"`
			Layout        map[string]interface{} `yaml:"layout"`
			VisibleWhen   map[string]interface{} `yaml:"visibleWhen"`
			Options       []string               `yaml:"options"`
			Items         []struct {
				ID        string `yaml:"id"`
				DataField string `yaml:"dataField"`
				Handler   string `yaml:"handler"`
			} `yaml:"items"`
		} `yaml:"containers"`
	}
	if err := node.Decode(&actual); err != nil {
		t.Fatalf("decode resolved yaml: %v", err)
	}
	if len(actual.Containers) != 2 {
		t.Fatalf("expected two independent cards, got %#v", actual.Containers)
	}
	advertiser, line := actual.Containers[0], actual.Containers[1]
	if advertiser.ID != "advertiserTargeting" || advertiser.DataSourceRef != "advertiser_defaults" || advertiser.StateKey != "advertiser-targetingGroups-collapsed" {
		t.Fatalf("unexpected advertiser card identity: %#v", advertiser)
	}
	if line.ID != "lineTargeting" || line.DataSourceRef != "line_properties" || line.StateKey != "line-targeting-collapsed" {
		t.Fatalf("unexpected line card identity: %#v", line)
	}
	if advertiser.ReadOnly || !line.ReadOnly || advertiser.Layout["columns"] != 2 || line.Layout["columns"] != 1 {
		t.Fatalf("typed parameters were not preserved: advertiser=%#v line=%#v", advertiser, line)
	}
	if len(advertiser.Options) != 2 || len(line.Options) != 1 {
		t.Fatalf("list parameters were not preserved: advertiser=%#v line=%#v", advertiser.Options, line.Options)
	}
	if advertiser.Items[0].ID != "nestedItem" || line.Items[0].ID != "nestedItem" {
		t.Fatalf("nested override did not apply: advertiser=%#v line=%#v", advertiser.Items, line.Items)
	}
	if advertiser.Items[1].ID != "advertiserSibling" || line.Items[1].ID != "lineSibling" {
		t.Fatalf("nested override leaked to a sibling: advertiser=%#v line=%#v", advertiser.Items, line.Items)
	}
	if advertiser.Items[1].Handler != "Advertiser Workspace.updateTargeting" || line.Items[1].Handler != "Line Workspace.updateTargeting" {
		t.Fatalf("embedded handler interpolation failed: advertiser=%#v line=%#v", advertiser.Items[1], line.Items[1])
	}
}

func TestResolveImports_ParameterizedFragmentFailsOnMissingParameter(t *testing.T) {
	root := t.TempDir()
	mustWriteImportFile(t, filepath.Join(root, "main.yaml"), `$import(fragment.yaml, {"prefix":"advertiser"})`)
	mustWriteImportFile(t, filepath.Join(root, "fragment.yaml"), "id: $param(missing)\n")
	data, err := os.ReadFile(filepath.Join(root, "main.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		t.Fatal(err)
	}
	err = ResolveImports(context.Background(), afs.New(), &node, root)
	if err == nil || !strings.Contains(err.Error(), `missing import parameter "missing"`) {
		t.Fatalf("expected missing-parameter error, got %v", err)
	}
}

func TestResolveImports_KeyedFragmentDoesNotEvaluateUnselectedParameterizedSibling(t *testing.T) {
	root := t.TempDir()
	mustWriteImportFile(t, filepath.Join(root, "main.yaml"), "selected: $import(fragment.yaml:selected)\n")
	mustWriteImportFile(t, filepath.Join(root, "fragment.yaml"), "selected:\n  id: ready\nunselected:\n  id: $param(missing)\n")
	data, err := os.ReadFile(filepath.Join(root, "main.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		t.Fatal(err)
	}
	if err := ResolveImports(context.Background(), afs.New(), &node, root); err != nil {
		t.Fatalf("unselected sibling consumed parameters: %v", err)
	}
	var actual struct {
		Selected struct {
			ID string `yaml:"id"`
		} `yaml:"selected"`
	}
	if err := node.Decode(&actual); err != nil || actual.Selected.ID != "ready" {
		t.Fatalf("unexpected selected fragment: %#v err=%v", actual, err)
	}
}

func TestServiceLoad_ParameterizedKeyedImportPreservesFileURLBase(t *testing.T) {
	root := t.TempDir()
	mustWriteImportFile(t, filepath.Join(root, "main.yaml"),
		`'$import(fragment.yaml:template, {"id":"catalog"})'`)
	mustWriteImportFile(t, filepath.Join(root, "fragment.yaml"), `
template:
  id: $param(id)
  backend:
    method: AdvancedReportingRun
`)

	var actual struct {
		ID      string `yaml:"id"`
		Backend struct {
			Method string `yaml:"method"`
		} `yaml:"backend"`
	}
	loader := New(afs.New(), "file://"+filepath.ToSlash(root))
	if err := loader.Load(context.Background(), "main.yaml", &actual); err != nil {
		t.Fatalf("load parameterized keyed import from file URL: %v", err)
	}
	if actual.ID != "catalog" || actual.Backend.Method != "AdvancedReportingRun" {
		t.Fatalf("unexpected imported datasource: %#v", actual)
	}
}

func mustWriteImportFile(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}
