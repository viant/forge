package window

import (
	"context"
	"github.com/viant/forge/backend/types"
	"os"
	"path/filepath"
	"testing"
)

func TestCompileWindowRetainsDraftValidationBinding(t *testing.T) {
	manifest := WindowSourceManifest{Version: 1, Binding: ResourceBinding{WindowKey: "editor", URI: "window://example/editor"}, Files: map[string]string{"extension/forge/windows/editor/main.yaml": `# Independent synthetic frontend draft schema.
windowKey: editor
schemas:
  draft:
    type: object
    required: [title, enabled]
    properties:
      title: {type: string, maxLength: 2}
      enabled: {type: boolean}
view:
  content:
    id: editor
    draftForm:
      validation: {schemaRef: draft}
`}}
	raw, err := CompileWindowSource(context.Background(), manifest)
	if err != nil {
		t.Fatal(err)
	}
	selected, err := types.SelectWindowResource(raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	for name, body := range manifest.Files {
		filename := filepath.Join(root, filepath.FromSlash(name))
		if err = os.MkdirAll(filepath.Dir(filename), 0700); err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(filename, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	captured, capturedRaw, err := CaptureWindowSource(context.Background(), root, manifest.Binding)
	if err != nil {
		t.Fatal(err)
	}
	for name, body := range manifest.Files {
		if captured.Files[name] != body {
			t.Fatal("draft schema source bytes changed")
		}
	}
	recompiled, err := CompileWindowSource(context.Background(), captured)
	if err != nil {
		t.Fatal(err)
	}
	if string(capturedRaw) != string(recompiled) {
		t.Fatal("retained source changed compiled validation binding")
	}
	if selected.Window.View.Content.DraftForm.Validation.SchemaRef != "draft" || selected.Window.Schemas["draft"].Properties["title"].MaxLength == nil {
		t.Fatal("draft validation schema or binding lost")
	}
}
