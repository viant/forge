package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestResourceModelRoundTrip(t *testing.T) {
	data := []byte(`
schemas:
  record:
    type: object
    identity: [id]
    required: [id, name]
    additionalProperties: false
    properties:
      id: {type: integer, readOnly: true}
      name: {type: string, minLength: 1, maxLength: 255}
      cap: {type: integer, nullable: true, minimum: 1}
      children:
        type: array
        items: {$ref: childRecord}
  childRecord:
    type: object
    identity: [id]
    properties:
      id: {type: integer}
resourceModels:
  record:
    schemaRef: record
    read: {dataSourceRef: record_read}
    write: {dataSourceRef: record_patch, inputPath: Records, mode: overlayBaseline, collection: true}
    hooks: {beforeUnmarshal: Model.beforeRead, afterUnmarshal: Model.afterRead, beforeMarshal: Model.beforeWrite, afterMarshal: Model.afterWrite}
    fields:
      id: {read: id, write: Id, codec: integer, alwaysWrite: true}
      name: {read: name, write: Name, codec: string}
      cap: {read: threshold, write: Threshold, codec: integer, empty: null}
      children: {read: children, write: Children, collection: {modelRef: childRecord, identity: [id], mode: merge, preserveOrder: true}}
  childRecord:
    schemaRef: childRecord
    fields:
      id: {read: id, write: Id, codec: integer}
dataSource:
  record_read: {resourceModelRef: record, cardinality: collection}
  record_patch: {cardinality: object}
view:
  content:
    id: root
    mutationCommand:
      dataSourceRef: record_patch
      payload:
        modelRef: record
        source: {scope: extras, selector: data}
        baseline: {scope: collection, dataSourceRef: record_read, selector: "0"}
        mode: overlayBaseline
        target: Records
`)
	var window Window
	if err := yaml.Unmarshal(data, &window); err != nil {
		t.Fatal(err)
	}
	if window.Schemas["record"].Properties["children"].Items.Ref != "childRecord" {
		t.Fatal("nested schema reference was truncated")
	}
	model := window.ResourceModels["record"]
	if model.Write == nil || model.Write.Mode != "overlayBaseline" || !model.Write.Collection || model.Fields["cap"].Empty != "null" || !model.Fields["id"].AlwaysWrite {
		t.Fatalf("resource model write contract was truncated: %#v", model)
	}
	if model.Hooks == nil || model.Hooks.AfterMarshal != "Model.afterWrite" {
		t.Fatalf("resource model hooks were truncated: %#v", model.Hooks)
	}
	if window.DataSource["record_read"].ResourceModelRef != "record" {
		t.Fatal("datasource resourceModelRef was truncated")
	}
	payload := window.View.Content.MutationCommand.Payload
	if payload == nil || payload.ModelRef != "record" || payload.Baseline == nil || payload.Baseline.Selector != "0" {
		t.Fatalf("mutation payload preparation was truncated: %#v", payload)
	}
	encoded, err := json.Marshal(window)
	if err != nil {
		t.Fatal(err)
	}
	var output map[string]interface{}
	if err := json.Unmarshal(encoded, &output); err != nil {
		t.Fatal(err)
	}
	if output["schemas"] == nil || output["resourceModels"] == nil {
		t.Fatalf("resource contracts were not serialized: %s", encoded)
	}
	if err := ValidateResourceModels(&window); err != nil {
		t.Fatalf("valid resource model rejected: %v", err)
	}
}

func TestValidateResourceModelsFailsClosed(t *testing.T) {
	window := &Window{
		Schemas:        map[string]ResourceSchema{"record": {Type: "object", Properties: map[string]ResourceFieldSchema{"id": {Type: "integer"}}}},
		ResourceModels: map[string]ResourceModel{"record": {SchemaRef: "missing"}},
	}
	if err := ValidateResourceModels(window); err == nil {
		t.Fatal("unknown schema must fail validation")
	}
	window.ResourceModels["record"] = ResourceModel{SchemaRef: "record", Fields: map[string]ResourceFieldBinding{"name": {Write: "Name"}}}
	if err := ValidateResourceModels(window); err == nil {
		t.Fatal("binding an undeclared field must fail validation")
	}
}

func TestValidateResourceModelsAllowsExplicitModelsToShareReadDatasource(t *testing.T) {
	window := &Window{
		Schemas: map[string]ResourceSchema{
			"properties": {Type: "object", Properties: map[string]ResourceFieldSchema{"id": {Type: "integer"}, "name": {Type: "string"}}},
			"matrix":     {Type: "object", Properties: map[string]ResourceFieldSchema{"id": {Type: "integer"}, "rows": {Type: "array"}}},
		},
		ResourceModels: map[string]ResourceModel{
			"properties": {SchemaRef: "properties", Read: &ResourceReadBinding{DataSourceRef: "detail"}},
			"matrixPatch": {SchemaRef: "matrix", Read: &ResourceReadBinding{DataSourceRef: "detail"},
				Write: &ResourceWriteBinding{DataSourceRef: "patch", InputPath: "Data"}},
		},
		DataSource: map[string]DataSource{"detail": {}, "patch": {}},
		View: View{Content: &Container{ID: "matrix", MutationCommand: &MutationCommand{
			DataSourceRef: "patch", Payload: &ResourcePayloadPreparation{ModelRef: "matrixPatch"},
		}}},
	}
	if err := ValidateResourceModels(window); err != nil {
		t.Fatalf("explicit resource models may share an authoritative read datasource: %v", err)
	}
}

func TestValidateResourceModelsRejectsInvalidTypedContracts(t *testing.T) {
	base := func() *Window {
		return &Window{
			Schemas: map[string]ResourceSchema{
				"row": {Type: "object", Identity: []string{"id"}, Properties: map[string]ResourceFieldSchema{"id": {Type: "integer"}}},
				"record": {Type: "object", Identity: []string{"id"}, Properties: map[string]ResourceFieldSchema{
					"id": {Type: "integer"}, "name": {Type: "string"}, "rows": {Type: "array", Items: &ResourceFieldSchema{Ref: "row"}},
				}},
			},
			ResourceModels: map[string]ResourceModel{
				"row": {SchemaRef: "row", Fields: map[string]ResourceFieldBinding{"id": {Write: "Id"}}},
				"record": {SchemaRef: "record", Read: &ResourceReadBinding{DataSourceRef: "read"}, Write: &ResourceWriteBinding{DataSourceRef: "patch", InputPath: "Records", Mode: "overlayBaseline", Collection: true}, Fields: map[string]ResourceFieldBinding{
					"id": {Write: "Id"}, "name": {Write: "Name"}, "rows": {Write: "Rows", Collection: &ResourceCollectionBinding{ModelRef: "row", Identity: []string{"id"}}},
				}},
			},
			DataSource: map[string]DataSource{"read": {ResourceModelRef: "record"}, "patch": {}, "other": {}},
			View:       View{Content: &Container{ID: "root", MutationCommand: &MutationCommand{DataSourceRef: "patch", Payload: &ResourcePayloadPreparation{ModelRef: "record", Source: ResourceValueSource{Scope: "form", DataSourceRef: "read"}}}}},
		}
	}
	tests := map[string]func(*Window){
		"unsupported codec": func(window *Window) {
			model := window.ResourceModels["record"]
			binding := model.Fields["name"]
			binding.Codec = "javascript"
			model.Fields["name"] = binding
			window.ResourceModels["record"] = model
		},
		"unsupported mode": func(window *Window) {
			model := window.ResourceModels["record"]
			model.Write.Mode = "magic"
			window.ResourceModels["record"] = model
		},
		"invalid source scope": func(window *Window) { window.View.Content.MutationCommand.Payload.Source.Scope = "service" },
		"writer mismatch":      func(window *Window) { window.View.Content.MutationCommand.DataSourceRef = "other" },
		"changed override omits full model identity": func(window *Window) {
			model := window.ResourceModels["record"]
			model.Write.Mode = "full"
			binding := model.Fields["id"]
			binding.Write = "-"
			model.Fields["id"] = binding
			window.ResourceModels["record"] = model
			window.View.Content.MutationCommand.Payload.Mode = "changed"
		},
		"reader mismatch": func(window *Window) {
			dataSource := window.DataSource["other"]
			dataSource.ResourceModelRef = "record"
			window.DataSource["other"] = dataSource
		},
		"invalid collection identity": func(window *Window) {
			model := window.ResourceModels["record"]
			binding := model.Fields["rows"]
			binding.Collection.Identity = []string{"missing"}
			model.Fields["rows"] = binding
			window.ResourceModels["record"] = model
		},
		"conflicting nested bindings": func(window *Window) {
			model := window.ResourceModels["record"]
			binding := model.Fields["rows"]
			binding.ModelRef = "row"
			model.Fields["rows"] = binding
			window.ResourceModels["record"] = model
		},
	}
	for name, mutate := range tests {
		t.Run(name, func(t *testing.T) {
			window := base()
			mutate(window)
			if err := ValidateResourceModels(window); err == nil {
				t.Fatalf("invalid %s contract was accepted", name)
			}
		})
	}

	minimum, maximum := 2.0, 1.0
	window := base()
	schema := window.Schemas["record"]
	nameField := schema.Properties["name"]
	nameField.Type, nameField.Minimum, nameField.Maximum = "number", &minimum, &maximum
	schema.Properties["name"] = nameField
	window.Schemas["record"] = schema
	if err := ValidateResourceModels(window); err == nil {
		t.Fatal("inconsistent numeric constraints were accepted")
	}
}

func TestValidateResourceModelsCoversEveryMutationHost(t *testing.T) {
	invalid := func() *MutationCommand {
		return &MutationCommand{DataSourceRef: "patch", Payload: &ResourcePayloadPreparation{ModelRef: "missing"}}
	}
	base := func(content *Container) *Window {
		return &Window{
			Schemas:        map[string]ResourceSchema{"record": {Type: "object", Properties: map[string]ResourceFieldSchema{"id": {Type: "integer"}}}},
			ResourceModels: map[string]ResourceModel{"record": {SchemaRef: "record"}},
			View:           View{Content: content},
		}
	}
	tests := map[string]*Container{
		"status workflow":    {ID: "status", StatusWorkflow: &StatusWorkflow{Transitions: []StatusWorkflowTransition{{ID: "go", Command: invalid()}}}},
		"resource header":    {ID: "header", ResourceHeader: &ResourceHeaderSpec{Actions: []ResourceHeaderAction{{ID: "save", Mutation: invalid()}}}},
		"notification rules": {ID: "notice", NotificationRules: &NotificationRulesSpec{Rules: []NotificationRule{{ID: "save", Action: &ResourceHeaderAction{Mutation: invalid()}}}}},
	}
	for name, content := range tests {
		t.Run(name, func(t *testing.T) {
			if err := ValidateResourceModelStructure(base(content)); err == nil {
				t.Fatalf("%s payload model reference was not validated", name)
			}
		})
	}
}

func TestValidateResourceModelsRejectsOptInReferencesWithoutRegistries(t *testing.T) {
	withDatasource := &Window{DataSource: map[string]DataSource{"read": {ResourceModelRef: "missing"}}}
	if err := ValidateResourceModels(withDatasource); err == nil {
		t.Fatal("datasource resourceModelRef without registries was accepted")
	}
	withCommand := &Window{View: View{Content: &Container{ID: "root", MutationCommand: &MutationCommand{DataSourceRef: "patch", Payload: &ResourcePayloadPreparation{ModelRef: "missing"}}}}}
	if err := ValidateResourceModelStructure(withCommand); err == nil {
		t.Fatal("command payload modelRef without registries was accepted")
	}
}

func TestResourcePayloadFieldsRoundTrip(t *testing.T) {
	data := []byte(`
schemas:
  mutation:
    type: object
    properties:
      operation: {type: string}
      recordId: {type: integer}
      tenantId: {type: integer}
      revision: {type: integer}
      relatedItemIds: {type: array, items: {type: integer}}
resourceModels:
  mutation:
    schemaRef: mutation
    write: {dataSourceRef: patch, inputPath: Mutation, mode: full}
view:
  content:
    id: root
    mutationCommand:
      dataSourceRef: patch
      payload:
        modelRef: mutation
        fields:
          operation: {scope: constant, value: assign}
          recordId: {scope: windowForm, selector: RecordId.0, codec: integer}
          tenantId: {scope: metrics, dataSourceRef: record_read, selector: tenantId, codec: integer}
          revision: {scope: input, selector: parameters.Revision, codec: integer}
          relatedItemIds:
            scope: extras
            selector: selectedRows
            where: {field: relationKind, equals: primary}
            mapSelector: id
            codec: integer
`)
	var window Window
	if err := yaml.Unmarshal(data, &window); err != nil {
		t.Fatal(err)
	}
	payload := window.View.Content.MutationCommand.Payload
	if payload == nil || len(payload.Fields) != 5 || payload.Fields["operation"].Value != "assign" {
		t.Fatalf("composed payload fields were truncated: %#v", payload)
	}
	if source := payload.Fields["tenantId"]; source.Scope != "metrics" || source.DataSourceRef != "record_read" || source.Selector != "tenantId" || source.Codec != "integer" {
		t.Fatalf("metrics source was truncated: %#v", source)
	}
	if source := payload.Fields["revision"]; source.Scope != "input" || source.Selector != "parameters.Revision" || source.Codec != "integer" {
		t.Fatalf("input source was truncated: %#v", source)
	}
	ids := payload.Fields["relatedItemIds"]
	if ids.Where == nil || ids.Where.Field != "relationKind" || ids.MapSelector != "id" || ids.Codec != "integer" {
		t.Fatalf("projection contract was truncated: %#v", ids)
	}
	if err := ValidateResourceModelStructure(&window); err != nil {
		t.Fatalf("valid composed payload rejected: %v", err)
	}
	payload.Source = ResourceValueSource{Scope: "extras", Selector: "data"}
	if err := ValidateResourceModelStructure(&window); err == nil {
		t.Fatal("source and fields must be mutually exclusive")
	}
}

func TestValidateResourceCollectionClientKey(t *testing.T) {
	window := &Window{
		Schemas: map[string]ResourceSchema{
			"row":  {Type: "object", Identity: []string{"id"}, Properties: map[string]ResourceFieldSchema{"id": {Type: "integer"}, "clientKey": {Type: "string"}}},
			"root": {Type: "object", Properties: map[string]ResourceFieldSchema{"rows": {Type: "array", Items: &ResourceFieldSchema{Ref: "row"}}}},
		},
		ResourceModels: map[string]ResourceModel{
			"row":  {SchemaRef: "row", Fields: map[string]ResourceFieldBinding{"id": {Write: "Id"}, "clientKey": {Write: "-"}}},
			"root": {SchemaRef: "root", Fields: map[string]ResourceFieldBinding{"rows": {Write: "Rows", Collection: &ResourceCollectionBinding{ModelRef: "row", Identity: []string{"id"}, ClientKey: "clientKey"}}}},
		},
	}
	if err := ValidateResourceModelStructure(window); err != nil {
		t.Fatalf("valid clientKey rejected: %v", err)
	}
	model := window.ResourceModels["root"]
	binding := model.Fields["rows"]
	binding.Collection.ClientKey = "missing"
	model.Fields["rows"] = binding
	window.ResourceModels["root"] = model
	if err := ValidateResourceModelStructure(window); err == nil {
		t.Fatal("undeclared clientKey must fail validation")
	}
}
