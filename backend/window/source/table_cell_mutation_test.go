package window

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/viant/forge/backend/types"
)

// Independently authored synthetic source; no application source or captures.
func TestTableCellMutationSourceCaptureRecompile(t *testing.T) {
	manifest := WindowSourceManifest{Version: 1, Binding: ResourceBinding{WindowKey: "records", URI: "window://example/records"}, Files: map[string]string{
		"extension/forge/windows/records/main.yaml": `# Keep editable source
windowKey: records
resources: {dataSources: [rows, patch]}
view:
  content:
    id: list
    dataSourceRef: rows
    table:
      columns:
        - id: remove
          name: Remove record
          type: button
          mutationCommand:
            dataSourceRef: patch
            prepare: Fixture.prepare
            confirm: Remove this record?
            timeoutMs: 2500
            refresh: [{dataSourceRef: rows}]
          mutationCommands:
            - when: {source: row, field: mode, equals: primary}
              command: {dataSourceRef: patch, serializationGroup: recordChanges}
            - when: {source: row, field: mode, equals: secondary}
              command: {dataSourceRef: patch, serializationGroup: recordChanges}
        - {id: name, name: Name}
`,
		"extension/forge/datasources/rows.yaml":  "id: rows\nuniqueKey: [{field: id}]\nbackend: {kind: inline, rows: [{id: 0, name: Sample}]}\n",
		"extension/forge/datasources/patch.yaml": "id: patch\nbackend: {kind: inline, rows: []}\n",
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
	selected, err := types.SelectWindowResource(recompiled, nil)
	if err != nil {
		t.Fatal(err)
	}
	cols := selected.Window.View.Content.Table.Columns
	expected := &types.MutationCommand{DataSourceRef: "patch", Prepare: "Fixture.prepare", Confirm: "Remove this record?", TimeoutMs: 2500, Refresh: []types.RefreshSpec{{DataSourceRef: "rows"}}}
	if !reflect.DeepEqual(cols[0].MutationCommand, expected) {
		t.Fatalf("command lost: %#v", cols[0].MutationCommand)
	}
	if len(cols[0].MutationCommands) != 2 || cols[0].MutationCommands[0].When["source"] != "row" || cols[0].MutationCommands[1].Command.SerializationGroup != "recordChanges" {
		t.Fatal("row variants/group lost through source capture/recompile")
	}
	if cols[1].MutationCommand != nil || cols[1].ID != "name" {
		t.Fatal("legacy column changed")
	}
	if _, ok := selected.Window.DataSource["patch"]; !ok {
		t.Fatal("writer reference not included in closure")
	}
}
