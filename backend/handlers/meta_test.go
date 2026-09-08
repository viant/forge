package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/viant/afs"
	afsurl "github.com/viant/afs/url"
	"github.com/viant/forge/backend/service/meta"
)

func TestWindowHandlerRejectsFinalResourceModelDatasourceMismatch(t *testing.T) {
	tests := map[string]string{
		"reader": `
schemas: {record: {type: object, properties: {id: {type: integer}}}}
resourceModels:
  record: {schemaRef: record, read: {dataSourceRef: read}, fields: {id: {write: Id}}}
  other: {schemaRef: record, read: {dataSourceRef: otherRead}, fields: {id: {write: Id}}}
dataSource:
  read: {resourceModelRef: other, cardinality: collection}
  otherRead: {resourceModelRef: other, cardinality: collection}
view: {content: {id: root}}
`,
		"writer": `
schemas: {record: {type: object, properties: {id: {type: integer}}}}
resourceModels:
  record: {schemaRef: record, write: {dataSourceRef: patch, inputPath: Records}, fields: {id: {write: Id}}}
dataSource: {patch: {cardinality: object}, otherPatch: {cardinality: object}}
view:
  content:
    id: root
    mutationCommand:
      dataSourceRef: otherPatch
      payload: {modelRef: record, source: {scope: extras, selector: data}}
`,
	}
	for name, source := range tests {
		t.Run(name, func(t *testing.T) {
			root := t.TempDir()
			mustWriteHandlerMetaFile(t, filepath.Join(root, "window", "record.yaml"), source)
			baseURL := "file://" + filepath.ToSlash(filepath.Join(root, "window"))
			loader := meta.New(afs.New(), baseURL)
			if _, err := LoadWindow(context.Background(), loader, baseURL, "record", "", nil); err == nil {
				t.Fatal("public LoadWindow accepted a datasource symmetry mismatch")
			}
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/v1/window/record", nil)
			WindowHandler(loader, baseURL, "/v1/window/").ServeHTTP(recorder, request)
			if recorder.Code != http.StatusInternalServerError || !strings.Contains(recorder.Body.String(), "resource model") {
				t.Fatalf("expected final resource-model validation failure, status=%d body=%s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

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

func TestLoadWindow_LoadsRootSiblingActionCodeForFolderizedWindow(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "window", "metricReportBuilder")
	mustWriteHandlerMetaFile(t, filepath.Join(base, "shared", "main.yaml"), "namespace: Performance Metrics\nview:\n  content: {}\n")
	mustWriteHandlerMetaFile(t, filepath.Join(root, "window", "metricReportBuilder.js"), "(() => ({ stewardReportBuilder: { buildRequest: () => ({}) } }))()")

	baseURL := "file://" + filepath.ToSlash(filepath.Join(root, "window"))
	loader := meta.New(afs.New(), baseURL)
	window, err := LoadWindow(context.Background(), loader, baseURL, "metricReportBuilder", "", &meta.TargetContext{
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
		t.Fatalf("expected folderized root sibling action code to load")
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
