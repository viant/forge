package handlers

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/viant/afs"
	"github.com/viant/forge/backend/service/meta"
)

func TestFetchNavigationData_TargetAwareBranchSelection(t *testing.T) {
	root := t.TempDir()
	mustWriteNavigationFile(t, filepath.Join(root, "shared", "navigation.yaml"), "- id: shared\n  label: Shared\n  icon: home\n  windowKey: shared\n  windowTitle: Shared\n")
	mustWriteNavigationFile(t, filepath.Join(root, "web", "navigation.yaml"), "- id: web\n  label: Web\n  icon: globe\n  windowKey: web\n  windowTitle: Web\n")
	mustWriteNavigationFile(t, filepath.Join(root, "ios", "tablet", "navigation.yaml"), "- id: ipad\n  label: iPad\n  icon: tablet\n  windowKey: ios-tablet\n  windowTitle: iPad\n")
	mustWriteNavigationFile(t, filepath.Join(root, "navigation.yaml"), "- id: legacy\n  label: Legacy\n  icon: archive\n  windowKey: legacy\n  windowTitle: Legacy\n")

	loader := meta.New(afs.New(), root)
	ctx := context.Background()

	testCases := []struct {
		name     string
		target   *meta.TargetContext
		expected string
	}{
		{name: "exact branch", target: &meta.TargetContext{Platform: "ios", FormFactor: "tablet"}, expected: "ipad"},
		{name: "platform branch", target: &meta.TargetContext{Platform: "web", FormFactor: "desktop"}, expected: "web"},
		{name: "shared branch", target: &meta.TargetContext{Platform: "android", FormFactor: "phone"}, expected: "shared"},
		{name: "legacy fallback", target: nil, expected: "legacy"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			items, err := FetchNavigationData(ctx, loader, root, testCase.target)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(items) != 1 {
				t.Fatalf("expected one navigation item, got %d", len(items))
			}
			if items[0].ID != testCase.expected {
				t.Fatalf("expected item %q, got %q", testCase.expected, items[0].ID)
			}
		})
	}
}

func mustWriteNavigationFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir failed: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write failed: %v", err)
	}
}
