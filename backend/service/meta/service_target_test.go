package meta

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/viant/afs"
	"github.com/viant/forge/backend/types"
)

type windowFixture struct {
	Namespace string `yaml:"namespace"`
	View      struct {
		Content map[string]any `yaml:"content"`
	} `yaml:"view"`
}

func TestResolveWindowBase_TargetBranchOrder(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "schedule")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "main.yaml"), "namespace: shared\nview:\n  content: {}\n")
	mustWriteMetaFile(t, filepath.Join(base, "web", "main.yaml"), "namespace: web\nview:\n  content: {}\n")
	mustWriteMetaFile(t, filepath.Join(base, "ios", "tablet", "main.yaml"), "namespace: ios-tablet\nview:\n  content: {}\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	ctx := context.Background()

	testCases := []struct {
		name     string
		target   *TargetContext
		expected string
	}{
		{name: "exact branch", target: &TargetContext{Platform: "ios", FormFactor: "tablet"}, expected: "schedule/ios/tablet/main"},
		{name: "platform branch", target: &TargetContext{Platform: "web", FormFactor: "desktop"}, expected: "schedule/web/main"},
		{name: "shared fallback", target: &TargetContext{Platform: "android", FormFactor: "phone"}, expected: "schedule/shared/main"},
		{name: "legacy fallback", target: nil, expected: "schedule/main"},
	}

	mustWriteMetaFile(t, filepath.Join(base, "main.yaml"), "namespace: legacy\nview:\n  content: {}\n")

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := service.ResolveWindowBase(ctx, "schedule/main", testCase.target)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != testCase.expected {
				t.Fatalf("expected %q, got %q", testCase.expected, got)
			}
		})
	}
}

func TestResolveWindowBase_BroadTargetBranches(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "order")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "main.yaml"), "namespace: shared\nview:\n  content: {}\n")
	mustWriteMetaFile(t, filepath.Join(base, "mobile", "main.yaml"), "namespace: mobile\nview:\n  content: {}\n")
	mustWriteMetaFile(t, filepath.Join(base, "mobile", "phone", "main.yaml"), "namespace: mobile-phone\nview:\n  content: {}\n")
	mustWriteMetaFile(t, filepath.Join(base, "mobile", "foldable", "main.yaml"), "namespace: mobile-foldable\nview:\n  content: {}\n")
	mustWriteMetaFile(t, filepath.Join(base, "web", "main.yaml"), "namespace: web\nview:\n  content: {}\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	ctx := context.Background()

	testCases := []struct {
		name     string
		target   *TargetContext
		expected string
	}{
		{name: "web platform branch", target: &TargetContext{Platform: "web", FormFactor: "desktop", Surface: "browser"}, expected: "order/web/main"},
		{name: "mobile form factor branch", target: &TargetContext{Platform: "ios", FormFactor: "phone", Surface: "app"}, expected: "order/mobile/phone/main"},
		{name: "mobile platform family branch", target: &TargetContext{Platform: "android", FormFactor: "tablet", Surface: "app"}, expected: "order/mobile/main"},
		{name: "foldable form factor branch", target: &TargetContext{FormFactor: "foldable"}, expected: "order/mobile/foldable/main"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := service.ResolveWindowBase(ctx, "order/main", testCase.target)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != testCase.expected {
				t.Fatalf("expected %q, got %q", testCase.expected, got)
			}
		})
	}
}

func TestResolveWindowAsset_BroadTargetBranches(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "order")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "web", "main.js"), "(() => ({}))()")
	mustWriteMetaFile(t, filepath.Join(base, "web", "main.yaml"), "namespace: web\nview:\n  content: {}\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	ctx := context.Background()

	got, err := service.ResolveWindowAsset(ctx, "order/main", ".js", &TargetContext{
		Platform:   "web",
		FormFactor: "desktop",
		Surface:    "app",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "order/shared/web/main.js" {
		t.Fatalf("expected %q, got %q", "order/shared/web/main.js", got)
	}
}

func TestLoadWithTarget_ImportFallbacksToShared(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "demo")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "table", "main.yaml"), "id: shared-table\n")
	mustWriteMetaFile(t, filepath.Join(base, "ios", "tablet", "main.yaml"), "namespace: demo\nview:\n  content:\n    table: $import('table/main.yaml')\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	ctx := context.Background()
	var decoded windowFixture

	if err := service.LoadWithTarget(ctx, "demo/ios/tablet/main.yaml", &decoded, &TargetContext{
		Platform:   "ios",
		FormFactor: "tablet",
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if decoded.Namespace != "demo" {
		t.Fatalf("expected namespace demo, got %q", decoded.Namespace)
	}
	if decoded.View.Content == nil {
		t.Fatalf("expected content to be populated")
	}
	table, ok := decoded.View.Content["table"].(map[string]any)
	if !ok {
		t.Fatalf("expected imported table object, got %#v", decoded.View.Content["table"])
	}
	if table["id"] != "shared-table" {
		t.Fatalf("expected shared fallback import, got %#v", table)
	}
}

func TestLoadWithTarget_ImportPrefersCurrentTargetBranchOverLegacyRoot(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "demo")
	mustWriteMetaFile(t, filepath.Join(base, "content.yaml"), "id: legacy-root\n")
	mustWriteMetaFile(t, filepath.Join(base, "ios", "tablet", "content.yaml"), "id: ios-tablet\n")
	mustWriteMetaFile(t, filepath.Join(base, "ios", "tablet", "main.yaml"), "namespace: demo\nview:\n  content:\n    table: $import('content.yaml')\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	ctx := context.Background()
	var decoded windowFixture

	if err := service.LoadWithTarget(ctx, "demo/ios/tablet/main.yaml", &decoded, &TargetContext{
		Platform:   "ios",
		FormFactor: "tablet",
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	table, ok := decoded.View.Content["table"].(map[string]any)
	if !ok {
		t.Fatalf("expected imported table object, got %#v", decoded.View.Content["table"])
	}
	if table["id"] != "ios-tablet" {
		t.Fatalf("expected target branch import to win over legacy root, got %#v", table)
	}
}

func TestLoadWithTarget_SharedImportPrefersTargetBranchBeforeSharedDefault(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "demo")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "content.yaml"), "id: shared-default\n")
	mustWriteMetaFile(t, filepath.Join(base, "mobile", "phone", "content.yaml"), "id: mobile-phone\n")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "main.yaml"), "namespace: demo\nview:\n  content:\n    table: $import('content.yaml')\n")
	mustWriteMetaFile(t, filepath.Join(base, "mobile", "phone", "main.yaml"), "$import('../../shared/main.yaml')\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	ctx := context.Background()
	var decoded windowFixture

	if err := service.LoadWithTarget(ctx, "demo/mobile/phone/main.yaml", &decoded, &TargetContext{
		Platform:   "ios",
		FormFactor: "phone",
		Surface:    "app",
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	table, ok := decoded.View.Content["table"].(map[string]any)
	if !ok {
		t.Fatalf("expected imported table object, got %#v", decoded.View.Content["table"])
	}
	if table["id"] != "mobile-phone" {
		t.Fatalf("expected shared import to prefer target branch before shared default, got %#v", table)
	}
}

func TestLoadWithTarget_SharedImportPrefersExactPlatformBranchBeforeMobileBranch(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "demo")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "content.yaml"), "id: shared-default\n")
	mustWriteMetaFile(t, filepath.Join(base, "mobile", "phone", "content.yaml"), "id: mobile-phone\n")
	mustWriteMetaFile(t, filepath.Join(base, "ios", "phone", "content.yaml"), "id: ios-phone\n")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "main.yaml"), "namespace: demo\nview:\n  content:\n    table: $import('content.yaml')\n")
	mustWriteMetaFile(t, filepath.Join(base, "ios", "phone", "main.yaml"), "$import('../../shared/main.yaml')\n")
	mustWriteMetaFile(t, filepath.Join(base, "mobile", "phone", "main.yaml"), "$import('../../shared/main.yaml')\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	ctx := context.Background()

	testCases := []struct {
		name     string
		path     string
		target   *TargetContext
		expected string
	}{
		{
			name: "ios phone exact branch",
			path: "demo/ios/phone/main.yaml",
			target: &TargetContext{
				Platform:   "ios",
				FormFactor: "phone",
				Surface:    "app",
			},
			expected: "ios-phone",
		},
		{
			name: "android phone mobile branch",
			path: "demo/mobile/phone/main.yaml",
			target: &TargetContext{
				Platform:   "android",
				FormFactor: "phone",
				Surface:    "app",
			},
			expected: "mobile-phone",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			var decoded windowFixture
			if err := service.LoadWithTarget(ctx, testCase.path, &decoded, testCase.target); err != nil {
				t.Fatalf("unexpected load error: %v", err)
			}
			table, ok := decoded.View.Content["table"].(map[string]any)
			if !ok {
				t.Fatalf("expected imported table object, got %#v", decoded.View.Content["table"])
			}
			if table["id"] != testCase.expected {
				t.Fatalf("expected %q import, got %#v", testCase.expected, table)
			}
		})
	}
}

func TestLoadWithTarget_RootImport(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "order")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "main.yaml"), "namespace: imported\nview:\n  content: {}\n")
	mustWriteMetaFile(t, filepath.Join(base, "web", "main.yaml"), "$import(shared/main.yaml)\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	ctx := context.Background()
	var decoded windowFixture

	if err := service.LoadWithTarget(ctx, "order/web/main.yaml", &decoded, &TargetContext{
		Platform:   "web",
		FormFactor: "desktop",
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if decoded.Namespace != "imported" {
		t.Fatalf("expected namespace imported, got %q", decoded.Namespace)
	}
}

func TestLoadWithTarget_ChainedRootImport(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "campaign")
	mustWriteMetaFile(t, filepath.Join(root, "window", "campaign.yaml"), "$import(campaign/shared/main.yaml)\n")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "main.yaml"), "$import(web/main.yaml)\n")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "web", "main.yaml"), "namespace: imported-through-chain\nview:\n  content: {}\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	var decoded windowFixture
	if err := service.LoadWithTarget(context.Background(), "campaign.yaml", &decoded, &TargetContext{
		Platform:   "web",
		FormFactor: "desktop",
	}); err != nil {
		t.Fatalf("unexpected chained root import error: %v", err)
	}
	if decoded.Namespace != "imported-through-chain" {
		t.Fatalf("expected chained import namespace, got %q", decoded.Namespace)
	}
}

func TestLoadWithTarget_ChainedRootImportFileURLBase(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "advertiser")
	mustWriteMetaFile(t, filepath.Join(root, "window", "advertiser.yaml"), "$import(advertiser/shared/main.yaml)\n")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "main.yaml"), "namespace: advertiser\nview:\n  content:\n    $import(content.yaml)\n")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "content.yaml"), "id: advertiserRoot\ncontainers:\n  - $import(tabs/defaults.yaml)\n")
	mustWriteMetaFile(t, filepath.Join(base, "shared", "tabs", "defaults.yaml"), "id: defaults\nsection: $import(../../../shared/targeting/category.yaml:section)\n")
	mustWriteMetaFile(t, filepath.Join(root, "window", "shared", "targeting", "category.yaml"), "section:\n  collapsible: true\n")

	service := New(afs.New(), "file://"+filepath.ToSlash(filepath.Join(root, "window")))
	var decoded windowFixture
	if err := service.LoadWithTarget(context.Background(), "advertiser.yaml", &decoded, &TargetContext{
		Platform:   "web",
		FormFactor: "desktop",
	}); err != nil {
		t.Fatalf("unexpected file URL chained import error: %v", err)
	}
	if decoded.Namespace != "advertiser" {
		t.Fatalf("expected advertiser namespace, got %q", decoded.Namespace)
	}
}

func TestLoadWithTarget_FolderizedWindowImportsSharedContentByKey(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "analyticsBuilder")
	mustWriteMetaFile(t, filepath.Join(root, "shared", "report_builder.yaml"), `
reportBuilder:
  filterPresentation: rail-left
  measures:
    - id: spend
      label: Spend
`)
	mustWriteMetaFile(t, filepath.Join(base, "shared", "content.yaml"), `
kind: dashboard.reportBuilder
id: metricsCubeBuilder
reportBuilder:
  $import('../../../shared/report_builder.yaml:reportBuilder')
targetOverrides:
  mobile:
    reportBuilder:
      filterPresentation: drawer-left
`)
	mustWriteMetaFile(t, filepath.Join(base, "shared", "main.yaml"), `
namespace: Performance Metrics
view:
  content:
    $import(content.yaml)
`)
	mustWriteMetaFile(t, filepath.Join(base, "web", "main.yaml"), "$import(../shared/main.yaml)\n")
	mustWriteMetaFile(t, filepath.Join(base, "mobile", "phone", "main.yaml"), "$import(../../shared/main.yaml)\n")
	mustWriteMetaFile(t, filepath.Join(root, "window", "analyticsBuilder.yaml"), "$import(analyticsBuilder/shared/main.yaml)\n")

	service := New(afs.New(), filepath.Join(root, "window"))
	ctx := context.Background()

	resolvedBase, err := service.ResolveWindowBase(ctx, "analyticsBuilder/main", &TargetContext{
		Platform:   "ios",
		FormFactor: "phone",
		Surface:    "app",
	})
	if err != nil {
		t.Fatalf("unexpected resolve error: %v", err)
	}
	if resolvedBase != "analyticsBuilder/mobile/phone/main" {
		t.Fatalf("expected phone branch, got %q", resolvedBase)
	}

	var decoded windowFixture
	if err := service.LoadWithTarget(ctx, resolvedBase+".yaml", &decoded, &TargetContext{
		Platform:   "ios",
		FormFactor: "phone",
		Surface:    "app",
	}); err != nil {
		t.Fatalf("unexpected load error: %v", err)
	}
	if decoded.Namespace != "Performance Metrics" {
		t.Fatalf("expected namespace Performance Metrics, got %q", decoded.Namespace)
	}
	if decoded.View.Content["kind"] != "dashboard.reportBuilder" {
		t.Fatalf("expected imported dashboard.reportBuilder content, got %#v", decoded.View.Content)
	}
	reportBuilder, ok := decoded.View.Content["reportBuilder"].(map[string]any)
	if !ok {
		t.Fatalf("expected keyed reportBuilder import, got %#v", decoded.View.Content["reportBuilder"])
	}
	if reportBuilder["filterPresentation"] != "rail-left" {
		t.Fatalf("expected shared report builder import, got %#v", reportBuilder)
	}
	overrides, ok := decoded.View.Content["targetOverrides"].(map[string]any)
	if !ok {
		t.Fatalf("expected content targetOverrides, got %#v", decoded.View.Content["targetOverrides"])
	}
	if _, ok := overrides["mobile"].(map[string]any); !ok {
		t.Fatalf("expected mobile target override, got %#v", overrides)
	}

	var typed types.Window
	if err := service.LoadWithTarget(ctx, resolvedBase+".yaml", &typed, &TargetContext{
		Platform:   "ios",
		FormFactor: "phone",
		Surface:    "app",
	}); err != nil {
		t.Fatalf("unexpected typed load error: %v", err)
	}
	if typed.View.Content == nil {
		t.Fatalf("expected typed window view content")
	}
	if typed.View.Content.Kind != "dashboard.reportBuilder" {
		t.Fatalf("expected typed dashboard.reportBuilder content, got %q", typed.View.Content.Kind)
	}
	if typed.View.Content.Dashboard == nil || typed.View.Content.Dashboard.ReportBuilder == nil {
		t.Fatalf("expected compact reportBuilder to normalize under dashboard.reportBuilder: %#v", typed.View.Content)
	}
	if typed.View.Content.Dashboard.ReportBuilder["filterPresentation"] != "rail-left" {
		t.Fatalf("expected normalized shared report builder import, got %#v", typed.View.Content.Dashboard.ReportBuilder)
	}
	if _, ok := typed.View.Content.TargetOverrides["mobile"]; !ok {
		t.Fatalf("expected typed content targetOverrides to retain mobile override, got %#v", typed.View.Content.TargetOverrides)
	}
}

func TestLoad_ParameterizedImportInstantiatesIndependentTargetingCards(t *testing.T) {
	root := t.TempDir()
	mustWriteMetaFile(t, filepath.Join(root, "main.yaml"), `
containers:
  - '$import(shared/targeting.yaml:card, {"prefix":"advertiser","dataSourceRef":"advertiser_defaults","dataRoot":"targetingGroups","handlerNamespace":"Advertiser Workspace","readOnly":false,"layout":{"kind":"grid","columns":2},"visibleWhen":{"source":"authorization","field":"resource.capabilities.write","equals":true},"options":["context","location"]})'
  - '$import(shared/targeting.yaml:card, {"prefix":"line","dataSourceRef":"line_properties","dataRoot":"targeting","handlerNamespace":"Line Workspace","readOnly":true,"layout":{"kind":"grid","columns":1},"visibleWhen":{"source":"authorization","field":"resource.capabilities.read","equals":true},"options":["location"]})'
`)
	mustWriteMetaFile(t, filepath.Join(root, "shared", "targeting.yaml"), `
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
	mustWriteMetaFile(t, filepath.Join(root, "shared", "nested", "item.yaml"), `
item:
  id: $param(prefix)Item
  dataField: $param(dataRoot).location
`)

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
	service := New(afs.New(), root)
	if err := service.Load(context.Background(), "main.yaml", &actual); err != nil {
		t.Fatalf("load parameterized imports: %v", err)
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

func TestLoad_ParameterizedImportFailsOnMissingParameter(t *testing.T) {
	root := t.TempDir()
	mustWriteMetaFile(t, filepath.Join(root, "main.yaml"), `$import(fragment.yaml, {"prefix":"advertiser"})`)
	mustWriteMetaFile(t, filepath.Join(root, "fragment.yaml"), "id: $param(missing)\n")
	var actual map[string]interface{}
	err := New(afs.New(), root).Load(context.Background(), "main.yaml", &actual)
	if err == nil || !strings.Contains(err.Error(), `missing import parameter "missing"`) {
		t.Fatalf("expected missing-parameter error, got %v", err)
	}
}

func TestGetImportPathKeyAndParams_PreservesExtensionlessKeyedImports(t *testing.T) {
	path, key, params, err := getImportPathKeyAndParams(`$import(shared/card:content, {"prefix":"advertiser"})`)
	if err != nil {
		t.Fatal(err)
	}
	if path != "shared/card.yaml" || key != "content" || params["prefix"] != "advertiser" {
		t.Fatalf("unexpected extensionless import parse: path=%q key=%q params=%#v", path, key, params)
	}
}

func TestLoad_KeyedImportDoesNotEvaluateUnselectedParameterizedSibling(t *testing.T) {
	root := t.TempDir()
	mustWriteMetaFile(t, filepath.Join(root, "main.yaml"), "selected: $import(fragment.yaml:selected)\n")
	mustWriteMetaFile(t, filepath.Join(root, "fragment.yaml"), "selected:\n  id: ready\nunselected:\n  id: $param(missing)\n")
	var actual struct {
		Selected struct {
			ID string `yaml:"id"`
		} `yaml:"selected"`
	}
	if err := New(afs.New(), root).Load(context.Background(), "main.yaml", &actual); err != nil {
		t.Fatalf("unselected sibling consumed parameters: %v", err)
	}
	if actual.Selected.ID != "ready" {
		t.Fatalf("unexpected selected fragment: %#v", actual)
	}
}

func mustWriteMetaFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir failed: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write failed: %v", err)
	}
}
