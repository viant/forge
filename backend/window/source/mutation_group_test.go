package window

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/viant/forge/backend/types"
)

func TestGroupedMutationSourceClosureAndRoundTrip(t *testing.T) {
	manifest := WindowSourceManifest{Version: 1, Binding: ResourceBinding{WindowKey: "records", URI: "window://example/records"}, Files: map[string]string{
		"extension/forge/windows/records/main.yaml": `windowKey: records
resources: {dialogs: [review], dataSources: [ready, applyOne, applyTwo, current]}
view:
  content:
    id: commands
    mutationCommand:
      commandId: publishSelections
      prepare: Workspace.prepare
      group:
        - when: {source: collection, dataSourceRef: ready, field: '0.available', equals: true}
          command:
            commandId: one
            dataSourceRef: applyOne
            label: First action
            receiptIdentity: {field: key, submittedValues: body.ids}
        - command:
            commandId: two
            dataSourceRef: applyTwo
            receiptIdentity: {field: key, submittedRows: body.rows, submittedField: recordId}
      refresh: [{dataSourceRef: current, bypassCache: true}]
`,
		"extension/forge/dialogs/review.yaml": `id: review
dataSourceRef: draft
content: {id: fields}
actions:
  - id: save
    mutationCommand:
      commandId: applyReviewed
      group:
        - command: {commandId: revised, dataSourceRef: change}
        - command: {commandId: accepted, dataSourceRef: release, receiptIdentity: {field: key, generated: true}}
      refresh: [{dataSourceRef: saved}]
`,
	}}
	required := []string{"ready", "applyOne", "applyTwo", "current", "draft", "change", "release", "saved"}
	for _, id := range append(required, "unused") {
		manifest.Files["extension/forge/datasources/"+id+".yaml"] = fmt.Sprintf("id: %s\nbackend: {kind: inline, rows: []}\n", id)
	}
	raw, err := CompileWindowSource(context.Background(), manifest)
	if err != nil {
		t.Fatal(err)
	}
	selected, err := types.SelectWindowResource(raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	w := selected.Window
	if len(w.DataSource) != len(required) {
		t.Fatalf("datasource closure has %d members, want %d", len(w.DataSource), len(required))
	}
	for _, id := range required {
		if _, found := w.DataSource[id]; !found {
			t.Errorf("missing datasource dependency %q", id)
		}
	}
	container := w.View.Content.MutationCommand
	dialog := w.Dialogs[0].Actions[0].MutationCommand
	if len(container.Group) != 2 || container.Prepare != "Workspace.prepare" || container.Group[0].When["dataSourceRef"] != "ready" ||
		container.Group[0].Command.ReceiptIdentity.SubmittedValues != "body.ids" ||
		container.Group[1].Command.ReceiptIdentity.SubmittedField != "recordId" ||
		container.Refresh[0].DataSourceRef != "current" || !container.Refresh[0].BypassCache ||
		len(dialog.Group) != 2 || !dialog.Group[1].Command.ReceiptIdentity.Generated || dialog.Refresh[0].DataSourceRef != "saved" {
		t.Fatalf("compiled commands changed, container = %#v, dialog = %#v", container, dialog)
	}
	for _, command := range []*types.MutationCommand{container, dialog} {
		encoded, err := json.Marshal(command)
		if err != nil {
			t.Fatal(err)
		}
		var decoded types.MutationCommand
		if err := json.Unmarshal(encoded, &decoded); err != nil {
			t.Fatal(err)
		}
		reencoded, err := json.Marshal(&decoded)
		if err != nil || !bytes.Equal(encoded, reencoded) {
			t.Fatalf("typed JSON round trip changed command: %s -> %s, %v", encoded, reencoded, err)
		}
	}
	main := "extension/forge/windows/records/main.yaml"
	manifest.Files[main] = strings.Replace(manifest.Files[main], "ready, applyOne, applyTwo, current", "ready, applyOne, current", 1)
	if _, err := CompileWindowSource(context.Background(), manifest); err == nil || !strings.Contains(err.Error(), "unknown datasource applyTwo") {
		t.Fatalf("a root-container writer must be explicitly attached, got %v", err)
	}
}
