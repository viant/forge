package types_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/viant/forge/backend/types"
	window "github.com/viant/forge/backend/window/source"
)

func TestPrepareSelectionCompilesAssignedDialogReaderAndMappingDependencies(t *testing.T) {
	manifest := window.WindowSourceManifest{Version: 1, Binding: window.ResourceBinding{WindowKey: "selection", URI: "window://example/selection"}, Files: map[string]string{
		"extension/forge/windows/selection/main.yaml": `windowKey: selection
resources: {dialogs: [editor], dataSources: [details]}
resourceMappings: $import(../../models/selection.yaml:resourceMappings)
view:
  content:
    id: rows
    editableCollection:
      operations:
        - id: edit
          dialogId: editor
          parameters: [{name: Scope, in: const, location: A}]
          prepareSelection: {dataSourceRef: details, idsParameter: IDs, identityField: identity.id, scopeFields: {scope.id: Scope, dialogId: Scope, dataSourceRef: Scope}, mappingRef: variants, prepare: 'Editor.prepare', pendingField: reading, errorField: lastError}
        - id: create
          dialogId: editor
          parameters: [{name: ID, in: windowForm, location: parentID}]
          prepareSelection: {dataSourceRef: details, parentParameter: ID, identityField: id, prepare: 'Editor.prepare'}
`,
		"extension/forge/dialogs/Scope.yaml":  "id: Scope\ncontent: {id: unused}\n",
		"extension/forge/dialogs/editor.yaml": "id: editor\ndataSourceRef: draft\ncontent: {id: fields, dataSourceRef: draft, fetchData: false}\n",
		"extension/forge/models/selection.yaml": `resourceMappings:
  variants: {selectors: [kind], cases: {short: {modelRef: selected}}}
`,
		"extension/forge/models/records.yaml": `schemas: {record: {type: object, properties: {kind: {type: string}}}}
resourceModels: {selected: {schemaRef: record}}
`,
	}}
	for _, name := range []string{"details", "draft", "unused", "Scope"} {
		manifest.Files["extension/forge/datasources/"+name+".yaml"] = "id: " + name + "\nbackend: {kind: inline}\n"
	}
	raw, err := window.CompileWindowSource(context.Background(), manifest)
	if err != nil {
		t.Fatal(err)
	}
	result, err := types.SelectWindowResource(raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	w := result.Window
	if len(w.Dialogs) != 1 || w.Dialogs[0].DataSourceRef != "draft" || len(w.DataSource) != 2 || len(w.ResourceModels) != 1 || len(w.Schemas) != 1 {
		t.Fatal("incorrect transitive dialog, datasource or resource-model closure")
	}
	for _, name := range []string{"details", "draft"} {
		if _, ok := w.DataSource[name]; !ok {
			t.Fatalf("missing bound %s", name)
		}
	}
	parent := w.View.Content.EditableCollection.Operations[1].PrepareSelection
	if parent == nil || parent.ParentParameter != "ID" || parent.IDsParameter != "" {
		t.Fatal("parent reader parameter not preserved")
	}
	spec := w.View.Content.EditableCollection.Operations[0].PrepareSelection
	if spec == nil || spec.DataSourceRef != "details" || spec.IDsParameter != "IDs" || spec.ScopeFields["scope.id"] != "Scope" || spec.IdentityField != "identity.id" || spec.Prepare != "Editor.prepare" || spec.PendingField != "reading" || spec.ErrorField != "lastError" {
		t.Fatalf("compiled selection differs: %+v", spec)
	}
	if w.ResourceMappings[spec.MappingRef].Cases["short"].ModelRef != "selected" || w.ResourceModels["selected"].SchemaRef != "record" {
		t.Fatal("mapping was not linked to its model and schema")
	}
}

func TestPrepareSelectionValidation(t *testing.T) {
	type edit = func(*types.EditableCollectionOperation, *types.Window)
	for _, tt := range []struct {
		name, text string
		boundOnly  bool
		modify     edit
	}{
		{"ambiguous identity source", "without idsParameter", false, func(o *types.EditableCollectionOperation, _ *types.Window) {
			o.PrepareSelection.ParentParameter = "Scope"
		}},
		{"unbound parent", "must name a declared operation parameter", false, func(o *types.EditableCollectionOperation, _ *types.Window) {
			o.PrepareSelection.ParentParameter, o.PrepareSelection.IDsParameter = "Other", ""
		}},
		{"dialog required", "requires a dialogId", false, func(o *types.EditableCollectionOperation, _ *types.Window) { o.DialogID = "" }},
		{"handler conflicts", "cannot also declare", false, func(o *types.EditableCollectionOperation, _ *types.Window) { o.Handler = "run" }},
		{"mutation conflicts", "cannot also declare", false, func(o *types.EditableCollectionOperation, _ *types.Window) { o.Mutation = &types.MutationCommand{} }},
		{"reader required", "reader dataSourceRef", false, func(o *types.EditableCollectionOperation, _ *types.Window) { o.PrepareSelection.DataSourceRef = "" }},
		{"hook required", "prepare handler", false, func(o *types.EditableCollectionOperation, _ *types.Window) { o.PrepareSelection.Prepare = " " }},
		{"unsafe identity", "safe identityField", false, func(o *types.EditableCollectionOperation, _ *types.Window) {
			o.PrepareSelection.IdentityField = "a.__proto__"
		}},
		{"nested IDs", "idsParameter", false, func(o *types.EditableCollectionOperation, _ *types.Window) { o.PrepareSelection.IDsParameter = "q.ids" }},
		{"IDs overwritten", "collides", false, func(o *types.EditableCollectionOperation, _ *types.Window) { o.PrepareSelection.IDsParameter = "Scope" }},
		{"unsafe scope", "scopeFields", false, func(o *types.EditableCollectionOperation, _ *types.Window) {
			o.PrepareSelection.ScopeFields = map[string]string{"a:b": "Scope"}
		}},
		{"undeclared parameter", "scopeFields", false, func(o *types.EditableCollectionOperation, _ *types.Window) {
			o.PrepareSelection.ScopeFields["group.id"] = "undeclared"
		}},
		{"colliding state", "must be distinct", false, func(o *types.EditableCollectionOperation, _ *types.Window) { o.PrepareSelection.PendingField = "error" }},
		{"unsafe state", "top-level", false, func(o *types.EditableCollectionOperation, _ *types.Window) {
			o.PrepareSelection.ErrorField = "constructor"
		}},
		{"draft read on open", "must retain the prepared draft", true, func(_ *types.EditableCollectionOperation, w *types.Window) {
			yes := true
			w.Dialogs[0].FetchOnOpen = &yes
		}},
		{"content overwrites draft", "must retain the prepared draft", true, func(_ *types.EditableCollectionOperation, w *types.Window) {
			yes := true
			w.Dialogs[0].Content.FetchData = &yes
		}},
		{"reader missing", "unknown reader datasource", true, func(_ *types.EditableCollectionOperation, w *types.Window) { delete(w.DataSource, "reader") }},
		{"dialog missing", "unknown dialog", true, func(_ *types.EditableCollectionOperation, w *types.Window) { w.Dialogs = nil }},
		{"draft missing", "unknown draft datasource", true, func(_ *types.EditableCollectionOperation, w *types.Window) { delete(w.DataSource, "draft") }},
		{"implicit draft", "requires a draft datasource", true, func(_ *types.EditableCollectionOperation, w *types.Window) { w.Dialogs[0].DataSourceRef = "" }},
		{"mismatched form subject", "conflicting draft datasources", true, func(_ *types.EditableCollectionOperation, w *types.Window) {
			w.Dialogs[0].Content.DataSourceRef = "reader"
		}},
		{"missing named mapping", "unknown resource mapping", true, func(o *types.EditableCollectionOperation, _ *types.Window) { o.PrepareSelection.MappingRef = "missing" }},
	} {
		t.Run(tt.name, func(t *testing.T) {
			w := &types.Window{DataSource: map[string]types.DataSource{"reader": {}, "draft": {}}, Dialogs: []types.Dialog{{Id: "edit", DataSourceRef: "draft", Content: &types.Container{}}}, View: types.View{Content: &types.Container{ID: "grid", EditableCollection: &types.EditableCollection{Operations: []types.EditableCollectionOperation{{
				ID: "edit", DialogID: "edit", Parameters: []*types.Parameter{{Name: "Scope"}}, PrepareSelection: &types.SelectionPreparation{DataSourceRef: "reader", IDsParameter: "IDs", IdentityField: "id", Prepare: "Editor.prepare", ScopeFields: map[string]string{"group.id": "Scope"}, ErrorField: "error"},
			}}}}}}
			w.Dialogs[0].Content.DataSourceRef = "draft"
			no := false
			w.Dialogs[0].Content.FetchData = &no
			if err := types.ValidateResourceModels(w); err != nil {
				t.Fatalf("valid source: %v", err)
			}
			tt.modify(&w.View.Content.EditableCollection.Operations[0], w)
			structure := types.ValidateResourceModelStructure(w)
			if (structure == nil) != tt.boundOnly {
				t.Fatalf("structure-only result %v", structure)
			}
			err := types.ValidateResourceModels(w)
			if err == nil || !strings.Contains(err.Error(), tt.text) || !strings.Contains(err.Error(), "container grid operation edit") {
				t.Fatalf("expected %q, got %v", tt.text, err)
			}
		})
	}
}

func TestPrepareSelectionOmissionPreservesOrdinaryOperation(t *testing.T) {
	w := &types.Window{View: types.View{Content: &types.Container{EditableCollection: &types.EditableCollection{Operations: []types.EditableCollectionOperation{{ID: "open", Handler: "legacy.open", DialogID: "legacy"}}}}}}
	if err := types.ValidateResourceModels(w); err != nil {
		t.Fatal(err)
	}
	out, err := json.Marshal(w.View.Content.EditableCollection.Operations[0])
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(out), "prepareSelection") {
		t.Fatal("omitted preparation changed an ordinary operation")
	}
}
