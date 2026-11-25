package types_test

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/viant/forge/backend/types"
	window "github.com/viant/forge/backend/window/source"
	"gopkg.in/yaml.v3"
)

func TestOrderedMutationSourceCompilation(t *testing.T) {
	const dialogPath = "extension/forge/dialogs/edit.yaml"
	manifest := window.WindowSourceManifest{Version: 1, Binding: window.ResourceBinding{WindowKey: "editor", URI: "window://example/editor"}, Files: map[string]string{
		"extension/forge/windows/editor/main.yaml": "windowKey: editor\nresources: {dialogs: [edit]}\nview: {content: {id: editors}}\n",
		dialogPath: `id: edit
dataSourceRef: draft
content: {id: fields}
actions:
  - id: save
    mutationCommand:
      dataSourceRef: publish
      clearFormFields: [attachment, caption]
      payload: {modelRef: document, source: {scope: extras, selector: steps.stage.rows.0}}
      before:
        - when: {source: form, field: attachment, exists: true}
          command:
            commandId: stage
            dataSourceRef: upload
            prepare: editor.prepare
            invocationParameter: requestId
            timeoutMs: 177
          cleanup:
            commandId: undo
            dataSourceRef: remove
            payload: {modelRef: undoModel, source: {scope: extras, selector: steps.stage.rows.0}}
            receiptWhen:
              all:
                - {source: collection, field: '0.removed', equals: true}
                - not: {source: collection, key: '0.error', exists: true}
        - command: {commandId: reserve, dataSourceRef: reserveId}
      cleanupState: {cleaned: true}
      resultState: {savedId: [id]}
`,
		"extension/forge/models/document.yaml": `schemas:
  record: {type: object, properties: {id: {type: integer}}}
resourceModels:
  document: {schemaRef: record, write: {dataSourceRef: publish, inputPath: input, mode: full}}
  undoModel: {schemaRef: record, write: {dataSourceRef: remove, inputPath: deletion, mode: full}}
`,
	}}
	for _, id := range []string{"draft", "upload", "remove", "reserveId", "publish", "unused"} {
		manifest.Files["extension/forge/datasources/"+id+".yaml"] = fmt.Sprintf("id: %s\nbackend: {kind: inline}\n", id)
	}
	raw, err := window.CompileWindowSource(context.Background(), manifest)
	if err != nil {
		t.Fatal(err)
	}
	selected, err := types.SelectWindowResource(raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	w := selected.Window
	for _, id := range []string{"draft", "upload", "remove", "reserveId", "publish"} {
		if _, found := w.DataSource[id]; !found {
			t.Errorf("compiler omitted referenced datasource %q", id)
		}
	}
	if _, found := w.DataSource["unused"]; found || len(w.ResourceModels) != 2 || len(w.Schemas) != 1 {
		t.Fatal("compiled resource dependencies do not match the referenced asset closure")
	}
	if len(w.Dialogs) != 1 || len(w.Dialogs[0].Actions) != 1 {
		t.Fatal("compiler lost dialog footer")
	}
	command := w.Dialogs[0].Actions[0].MutationCommand
	if command == nil || len(command.Before) != 2 || command.Before[1].Command.CommandID != "reserve" ||
		command.Payload.Source.Selector != "steps.stage.rows.0" || !reflect.DeepEqual(command.ClearFormFields, []string{"attachment", "caption"}) ||
		command.CleanupState["cleaned"] != true || !reflect.DeepEqual(command.ResultState["savedId"], []string{"id"}) {
		t.Fatal("ordered root or step order changed")
	}
	stage := command.Before[0]
	if stage.Command.InvocationParameter != "requestId" || stage.Command.Prepare != "editor.prepare" || stage.Command.TimeoutMs != 177 ||
		stage.When["exists"] != true || stage.Cleanup.Payload.ModelRef != "undoModel" {
		t.Fatal("stage or cleanup configuration changed")
	}
	receipt := map[string]any{"all": []any{
		map[string]any{"source": "collection", "field": "0.removed", "equals": true},
		map[string]any{"not": map[string]any{"source": "collection", "key": "0.error", "exists": true}},
	}}
	if !reflect.DeepEqual(stage.Cleanup.ReceiptWhen, receipt) {
		t.Fatalf("receiptWhen changed: %#v", stage.Cleanup.ReceiptWhen)
	}
	// The same production entry point must also reject malformed external dialog assets.
	manifest.Files[dialogPath] = strings.Replace(manifest.Files[dialogPath], "commandId: stage", "commandId: save", 1)
	if _, err := window.CompileWindowSource(context.Background(), manifest); err == nil || !strings.Contains(err.Error(), "distinct commandId") {
		t.Fatalf("expected collision with the effective root footer action id, got %v", err)
	}
}

func orderedFooter(root *types.MutationCommand) *types.Window {
	return &types.Window{
		DataSource:     map[string]types.DataSource{"publish": {}, "stage": {}, "undo": {}, "draft": {}},
		Schemas:        map[string]types.ResourceSchema{"record": {Type: "object"}},
		ResourceModels: map[string]types.ResourceModel{"document": {SchemaRef: "record", Write: &types.ResourceWriteBinding{DataSourceRef: "publish", InputPath: "item", Mode: "full"}}},
		Dialogs:        []types.Dialog{{Id: "edit", Actions: []types.Item{{ID: "save", MutationCommand: root}}}},
	}
}

func newOrderedCommand() *types.MutationCommand {
	return &types.MutationCommand{DataSourceRef: "publish", Before: []types.MutationPreparationStep{{
		Command: &types.MutationCommand{CommandID: "acquire", DataSourceRef: "stage"},
		Cleanup: &types.MutationCommand{CommandID: "release", DataSourceRef: "undo"},
	}}}
}

func TestOrderedMutationValidation(t *testing.T) {
	payload := func(model string) *types.ResourcePayloadPreparation {
		return &types.ResourcePayloadPreparation{ModelRef: model}
	}
	for _, tt := range []struct {
		name, want string
		edit       func(*types.MutationCommand)
	}{
		{"missing root writer", "requires a writer", func(c *types.MutationCommand) { c.DataSourceRef = "" }},
		{"missing root payload model", "unknown resource model missing", func(c *types.MutationCommand) { c.Payload = payload("missing") }},
		{"invalid root payload mode", "unsupported payload mode", func(c *types.MutationCommand) { c.Payload = payload("document"); c.Payload.Mode = "unknown" }},
		{"missing forward", "requires a command", func(c *types.MutationCommand) { c.Before[0].Command = nil }},
		{"absent forward writer", "requires a writer", func(c *types.MutationCommand) { c.Before[0].Command.DataSourceRef = "" }},
		{"wrong forward writer", "does not match resource model writer", func(c *types.MutationCommand) { c.Before[0].Command.Payload = payload("document") }},
		{"wrong cleanup writer", "does not match resource model writer", func(c *types.MutationCommand) { c.Before[0].Cleanup.Payload = payload("document") }},
		{"missing cleanup model", "unknown resource model missing", func(c *types.MutationCommand) { c.Before[0].Cleanup.Payload = payload("missing") }},
		{"duplicate", "distinct commandId", func(c *types.MutationCommand) { c.Before[0].Cleanup.CommandID = "acquire" }},
		{"implicit footer id", "distinct commandId", func(c *types.MutationCommand) { c.Before[0].Command.CommandID = "save" }},
		{"explicit root id", "distinct commandId", func(c *types.MutationCommand) { c.CommandID = "release" }},
		{"invalid selector", "distinct commandId", func(c *types.MutationCommand) { c.Before[0].Command.CommandID = "one.two" }},
		{"reserved id", "distinct commandId", func(c *types.MutationCommand) { c.Before[0].Command.CommandID = "constructor" }},
		{"nested sequence", "belong to the root", func(c *types.MutationCommand) { c.Before[0].Cleanup.Before = newOrderedCommand().Before }},
		{"child confirm", "belong to the root", func(c *types.MutationCommand) { c.Before[0].Command.Confirm = "Confirm" }},
		{"child result", "belong to the root", func(c *types.MutationCommand) { c.Before[0].Cleanup.ResultState = map[string][]string{"value": {"id"}} }},
		{"child clear", "belong to the root", func(c *types.MutationCommand) { c.Before[0].Command.ClearFormFields = []string{"one"} }},
		{"cleanup clear", "belong to the root", func(c *types.MutationCommand) { c.Before[0].Cleanup.ClearFormFields = []string{"one"} }},
		{"root receipt", "only be declared on a cleanup", func(c *types.MutationCommand) { c.ReceiptWhen = map[string]any{} }},
		{"root receipt without before", "only be declared on a cleanup", func(c *types.MutationCommand) { c.Before = nil; c.ReceiptWhen = map[string]any{} }},
		{"root receipt empty before", "only be declared on a cleanup", func(c *types.MutationCommand) {
			c.Before = []types.MutationPreparationStep{}
			c.ReceiptWhen = map[string]any{}
		}},
		{"forward receipt", "only be declared on a cleanup", func(c *types.MutationCommand) { c.Before[0].Command.ReceiptWhen = map[string]any{} }},
	} {
		t.Run(tt.name, func(t *testing.T) {
			c := newOrderedCommand()
			tt.edit(c)
			err := types.ValidateResourceModelStructure(orderedFooter(c))
			if err == nil || !strings.Contains(err.Error(), "dialog edit action save") || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("wanted %q, got %v", tt.want, err)
			}
		})
	}
}

func TestOrderedMutationBindsEffectiveDataSources(t *testing.T) {
	for _, name := range []string{"publish", "stage", "undo", "draft"} {
		t.Run(name, func(t *testing.T) {
			c := newOrderedCommand()
			c.Payload = &types.ResourcePayloadPreparation{ModelRef: "document", Source: types.ResourceValueSource{Scope: "form", DataSourceRef: "draft"}}
			w := orderedFooter(c)
			delete(w.DataSource, name)
			if err := types.ValidateResourceModelStructure(w); err != nil {
				t.Fatal(err)
			}
			if err := types.ValidateResourceModels(w); err == nil || !strings.Contains(err.Error(), "unknown datasource "+name) {
				t.Fatalf("missing effective binding %s: %v", name, err)
			}
		})
	}
}

func TestMutationReceiptConditionScope(t *testing.T) {
	for _, tt := range []struct {
		name, condition string
		valid           bool
	}{
		{"bounded", "{source: collection, selector: '0.count', gte: 0, lt: 2}", true},
		{"zero", "{source: collection, key: '0', equals: 0}", true},
		{"nested groups", "{any: [{source: collection, field: '0.status', in: [false, 0, '']}, {not: {all: [{source: collection, field: '1.code', matches: '^OK'}, {source: collection, field: '1.words', contains: ok}]}}]}", true},
		{"empty operand", "{source: collection, field: '0.name', notEquals: ''}", true},
		{"empty receipt", "{source: collection, field: '0', exists: false}", true},
		{"nonempty value", "{source: collection, field: '0.values', notEmpty: true}", true},
		{"empty group", "{all: []}", false},
		{"empty predicate", "{}", false},
		{"mixed group", "{all: [], source: collection}", false},
		{"null group member", "{any: [null]}", false},
		{"malformed negation", "{not: 'true'}", false},
		{"implicit source", "{field: '0.id', exists: true}", false},
		{"ambient source", "{source: form, field: '0.id', exists: true}", false},
		{"foreign datasource", "{source: collection, dataSourceRef: draft, field: '0.id', exists: true}", false},
		{"ambient selector", "{source: collection, field: 'form.name', exists: true}", false},
		{"empty selector", "{source: collection, selector: '', exists: true}", false},
		{"unsafe selector", "{source: collection, selector: '0.constructor', exists: true}", false},
		{"noncanonical row", "{source: collection, selector: '00.id', exists: true}", false},
		{"two selectors", "{source: collection, field: '0.id', selector: '0.id', exists: true}", false},
		{"unknown operator", "{source: collection, field: '0.count', gteField: field}", false},
		{"unsupported operand", "{source: collection, field: '0.flag', exists: 0}", false},
		{"infinite bound", "{source: collection, field: '0.count', gt: .inf}", false},
		{"mixed operators", "{source: collection, field: '0.count', gt: 0, exists: true}", false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			c := newOrderedCommand()
			if err := yaml.Unmarshal([]byte(tt.condition), &c.Before[0].Cleanup.ReceiptWhen); err != nil {
				t.Fatal(err)
			}
			err := types.ValidateResourceModels(orderedFooter(c))
			if (err == nil) != tt.valid || (err != nil && !strings.Contains(err.Error(), "before[0].cleanup.receiptWhen")) {
				t.Fatalf("valid=%t error=%v", tt.valid, err)
			}
		})
	}
}

func TestMutationOptionsOptOut(t *testing.T) {
	for _, fields := range []string{"", "before: []\nclearFormFields: []\n", "before: null\nclearFormFields: null\n"} {
		var root types.MutationCommand
		if err := yaml.Unmarshal([]byte("dataSourceRef: publish\n"+fields), &root); err != nil {
			t.Fatal(err)
		}
		if err := types.ValidateResourceModels(orderedFooter(&root)); err != nil {
			t.Fatal(err)
		}
		raw, err := json.Marshal(&root)
		if err != nil {
			t.Fatal(err)
		}
		if string(raw) != `{"dataSourceRef":"publish"}` {
			t.Fatalf("optional command fields changed legacy wire: %s", raw)
		}
	}
	root := &types.MutationCommand{DataSourceRef: "publish", ClearFormFields: []string{"file", "description"}}
	if err := types.ValidateResourceModels(orderedFooter(root)); err != nil {
		t.Fatal(err)
	}
	for _, fields := range [][]string{{""}, {"path.part"}, {"__proto__"}, {"constructor"}, {"prototype"}, {" x"}, {"a/b"}, {"a:b"}, {"a[0]"}, {"file", "file"}} {
		root.ClearFormFields = fields
		if err := types.ValidateResourceModels(orderedFooter(root)); err == nil {
			t.Fatalf("accepted invalid clearFormFields %q", fields)
		}
	}
	ordinaryContainer := &types.Window{View: types.View{Content: &types.Container{ID: "save", MutationCommand: &types.MutationCommand{ReceiptWhen: map[string]any{"source": "form"}}}}}
	if err := types.ValidateResourceModelStructure(ordinaryContainer); err == nil || !strings.Contains(err.Error(), "container save.receiptWhen") {
		t.Fatalf("container root receipt predicate accepted: %v", err)
	}
}
