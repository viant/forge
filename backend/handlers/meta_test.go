package handlers

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/viant/afs"
	afsurl "github.com/viant/afs/url"
	"github.com/viant/forge/backend/service/meta"
)

func TestLoadWindow_LoadsSharedWebActionCodeForWebTarget(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "order")
	mustWriteHandlerMetaFile(t, filepath.Join(base, "web", "main.yaml"), "namespace: Order Summary\nview:\n  content: {}\n")
	mustWriteHandlerMetaFile(t, filepath.Join(base, "shared", "web", "main.js"), "(() => ({ ping: () => true }))()")

	baseURL := "file://" + filepath.ToSlash(filepath.Join(root, "window"))
	loader := meta.New(afs.New(), baseURL)
	window, err := LoadWindow(context.Background(), loader, baseURL, "order", "", &meta.TargetContext{
		Platform:   "web",
		FormFactor: "desktop",
		Surface:    "app",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if window == nil {
		t.Fatalf("expected window")
	}
	if got := strings.TrimSpace(window.Actions.Code); got == "" {
		t.Fatalf("expected shared web action code to load")
	}
	if resolved, err := loader.ResolveWindowAsset(context.Background(), afsurl.Join(baseURL, "order", "main"), ".js", &meta.TargetContext{
		Platform:   "web",
		FormFactor: "desktop",
		Surface:    "app",
	}); err != nil || !strings.HasSuffix(resolved, "/order/shared/web/main.js") {
		t.Fatalf("expected shared web asset resolution, got path=%q err=%v", resolved, err)
	}
}

func TestLoadWindow_LoadsRootSiblingActionCodeForSingleFileWindow(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window")
	mustWriteHandlerMetaFile(t, filepath.Join(base, "campaign.yaml"), "namespace: Campaign Summary\nview:\n  content: {}\n")
	mustWriteHandlerMetaFile(t, filepath.Join(base, "campaign.js"), "(() => ({ ready: true }))()")

	baseURL := "file://" + filepath.ToSlash(base)
	loader := meta.New(afs.New(), baseURL)
	window, err := LoadWindow(context.Background(), loader, baseURL, "campaign", "", &meta.TargetContext{
		Platform:   "web",
		FormFactor: "desktop",
		Surface:    "app",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if window == nil {
		t.Fatalf("expected window")
	}
	if got := strings.TrimSpace(window.Actions.Code); got == "" {
		t.Fatalf("expected root sibling action code to load")
	}
}

func mustWriteHandlerMetaFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir failed: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write failed: %v", err)
	}
}
