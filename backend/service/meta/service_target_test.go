package meta

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/viant/afs"
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
		name      string
		target    *TargetContext
		expected  string
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

func mustWriteMetaFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir failed: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write failed: %v", err)
	}
}
