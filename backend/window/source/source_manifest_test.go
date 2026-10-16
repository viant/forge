// SPDX-License-Identifier: Apache-2.0
// Window source compilation extracted from Viant Agently Core.
package window

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestCompileWindowSourceRetainsNamedImportsScriptsAndDatasource(t *testing.T) {
	m := WindowSourceManifest{Version: 1, Binding: ResourceBinding{WindowKey: "named", URI: "window://example/named"}, Files: map[string]string{
		"extension/forge/windows/named/main.yaml":    "# authored comment\nwindowKey: named\nactionRefs: [namedHooks]\nresources: {dataSources: [namedRows]}\nview:\n  content: $import(content.yaml)\n",
		"extension/forge/windows/named/content.yaml": "id: namedList\ndataSourceRef: namedRows\n",
		"extension/forge/windows/namedHooks.js":      "(() => ({ namedAction() { return 'first-script'; } }))()",
		"extension/forge/datasources/namedRows.yaml": "id: namedRows\ncardinality: collection\nparameters: [{name: term, location: Before}]\nbackend: {kind: inline, rows: [{id: 1}]}\n",
	}}
	root := t.TempDir()
	for name, text := range m.Files {
		filename := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(filename), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filename, []byte(text), 0600); err != nil {
			t.Fatal(err)
		}
	}
	captured, capturedDefinition, err := CaptureWindowSource(context.Background(), root, m.Binding)
	if err != nil {
		t.Fatal(err)
	}
	for name, text := range m.Files {
		if captured.Files[name] != text {
			t.Fatalf("named source not retained verbatim: %s", name)
		}
	}
	capturedRecompiled, err := CompileWindowSource(context.Background(), captured)
	if err != nil {
		t.Fatal(err)
	}
	if string(capturedDefinition) != string(capturedRecompiled) {
		t.Fatal("retained named source changed native compiled output")
	}
	original, _ := json.Marshal(m)
	first, err := CompileWindowSource(context.Background(), m)
	if err != nil {
		t.Fatal(err)
	}
	window, err := types.SelectWindowResource(first, nil)
	if err != nil {
		t.Fatal(err)
	}
	if window.Window.View.Content.ID != "namedList" || !strings.Contains(window.Window.Actions.Code, "first-script") {
		t.Fatal("original named loader did not resolve import/script")
	}
	if window.Window.DataSource["namedRows"].Parameters[0].Location != "Before" {
		t.Fatal("named datasource parameter not projected")
	}
	after, _ := json.Marshal(m)
	if string(original) != string(after) {
		t.Fatal("compiler mutated authoritative source")
	}
	m.Files["extension/forge/windows/namedHooks.js"] = "(() => ({ namedAction() { return 'second-script'; } }))()"
	m.Files["extension/forge/datasources/namedRows.yaml"] = strings.Replace(m.Files["extension/forge/datasources/namedRows.yaml"], "Before", "After", 1)
	second, err := CompileWindowSource(context.Background(), m)
	if err != nil {
		t.Fatal(err)
	}
	// Both hosts consume the same existing envelope selection API.
	for _, target := range []*types.WindowTarget{nil, {Platform: "web", FormFactor: "desktop"}} {
		got, err := types.SelectWindowResource(second, target)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(got.Window.Actions.Code, "second-script") || strings.Contains(got.Window.Actions.Code, "first-script") || got.Window.DataSource["namedRows"].Parameters[0].Location != "After" {
			t.Fatal("named source edit was not recompiled")
		}
	}
	if string(first) == string(second) {
		t.Fatal("compiled identity did not change with named script")
	}
}

func TestCompileWindowSourceRejectsExternalImportsAndPaths(t *testing.T) {
	base := WindowSourceManifest{Version: 1, Binding: ResourceBinding{WindowKey: "named", URI: "window://example/named"}, Files: map[string]string{"extension/forge/windows/named/main.yaml": "windowKey: named\nview:\n  content: $import(https://example.invalid/outside.yaml)\n"}}
	if _, err := CompileWindowSource(context.Background(), base); err == nil {
		t.Fatal("external import accepted")
	}
	base.Files["../escape.yaml"] = "id: bad"
	if _, err := CompileWindowSource(context.Background(), base); err == nil {
		t.Fatal("traversal accepted")
	}
	root, outside := t.TempDir(), t.TempDir()
	main := filepath.Join(root, "extension/forge/windows/named/main.yaml")
	if err := os.MkdirAll(filepath.Dir(main), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(main, []byte("windowKey: named\nview:\n  content: $import(content.yaml)\n"), 0600); err != nil {
		t.Fatal(err)
	}
	secret := filepath.Join(outside, "content.yaml")
	if err := os.WriteFile(secret, []byte("id: outside\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(secret, filepath.Join(filepath.Dir(main), "content.yaml")); err != nil {
		t.Fatal(err)
	}
	if _, _, err := CaptureWindowSource(context.Background(), root, base.Binding); err == nil {
		t.Fatal("capture followed outside symlink")
	}
}
