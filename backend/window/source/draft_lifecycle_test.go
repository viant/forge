package window

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestDraftLifecycleSourceCompilePreservesMetadata(t *testing.T) {
	// Synthetic source bundle: no application captures or external dependencies.
	manifest := WindowSourceManifest{Version: 1, Binding: ResourceBinding{WindowKey: "draftExample", URI: "window://example/draftExample"}, Files: map[string]string{
		"extension/forge/windows/draftExample/main.yaml": `windowKey: draftExample
resources: {dataSources: [draft, settings]}
view:
  dataSourceRef: draft
  content:
    id: editor
    dataSourceRef: draft
    fetchData: false
    draftForm:
      lifecycle:
        openWhen: {source: windowForm, field: open, equals: true}
        key: [{name: parentId, in: windowForm, location: parentId}]
        defaults:
          - {name: enabled, default: false}
          - {name: count, default: 0}
          - {name: nullable, default: null}
          - {name: name, default: ''}
          - {name: absent}
        source:
          dataSourceRef: settings
          watch: [{name: parentId, in: windowForm, location: parentId}]
          when: {source: windowForm, field: parentId, gt: 0}
          parameters: [{name: id, in: windowForm, location: parentId}]
          defaults: [{name: currency, in: form, location: settings.currency}]
        load: Host.prepareDefaults
      validate: Host.validate
`,
		"extension/forge/datasources/draft.yaml":    "id: draft\nautoFetch: false\nbackend: {kind: inline, rows: []}\n",
		"extension/forge/datasources/settings.yaml": "id: settings\nautoFetch: false\nbackend: {kind: inline, rows: [{id: 7, currency: EUR}]}\n",
	}}
	root := t.TempDir()
	for name, body := range manifest.Files {
		filename := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(filename), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filename, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	captured, definition, err := CaptureWindowSource(context.Background(), root, manifest.Binding)
	if err != nil {
		t.Fatal(err)
	}
	for name, body := range manifest.Files {
		if captured.Files[name] != body {
			t.Fatalf("source bytes changed: %s", name)
		}
	}
	recompiled, err := CompileWindowSource(context.Background(), captured)
	if err != nil {
		t.Fatal(err)
	}
	if string(definition) != string(recompiled) {
		t.Fatal("capture/recompile changed compiled bytes")
	}
	before, _ := json.Marshal(manifest)
	for attempt := 0; attempt < 2; attempt++ {
		compiled, err := CompileWindowSource(context.Background(), manifest)
		if err != nil {
			t.Fatal(err)
		}
		selected, err := types.SelectWindowResource(compiled, &types.WindowTarget{Platform: "web", FormFactor: "desktop"})
		if err != nil {
			t.Fatal(err)
		}
		raw, err := json.Marshal(selected.Window)
		if err != nil {
			t.Fatal(err)
		}
		var delivered map[string]interface{}
		if err = json.Unmarshal(raw, &delivered); err != nil {
			t.Fatal(err)
		}
		draft := delivered["view"].(map[string]interface{})["content"].(map[string]interface{})["draftForm"].(map[string]interface{})
		lifecycle := draft["lifecycle"].(map[string]interface{})
		expected := []interface{}{map[string]interface{}{"name": "enabled", "default": false}, map[string]interface{}{"name": "count", "default": float64(0)}, map[string]interface{}{"name": "nullable", "default": nil}, map[string]interface{}{"name": "name", "default": ""}, map[string]interface{}{"name": "absent"}}
		if !reflect.DeepEqual(lifecycle["defaults"], expected) {
			t.Fatalf("lost default semantics: %s", raw)
		}
		if lifecycle["source"].(map[string]interface{})["watch"] == nil || lifecycle["source"].(map[string]interface{})["when"] == nil {
			t.Fatal("source refresh context lost")
		}
		if lifecycle["load"] != "Host.prepareDefaults" || draft["validate"] != "Host.validate" || lifecycle["source"].(map[string]interface{})["dataSourceRef"] != "settings" {
			t.Fatalf("lost lifecycle contract: %s", raw)
		}
	}
	after, _ := json.Marshal(manifest)
	if string(before) != string(after) {
		t.Fatal("compilation changed captured source")
	}
}
