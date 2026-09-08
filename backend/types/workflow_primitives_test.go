package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestWorkflowPrimitivesRoundTrip(t *testing.T) {
	data := []byte(`
id: workflow
kind: editableCollection
mutationCommand:
  commandId: save-records
  dataSourceRef: records_patch
  label: Save records
  icon: floppy-disk
  hideLabel: true
  intent: primary
  invalidMessage: Complete required fields.
  timeoutMs: 45000
  invocationParameter: RequestId
  indeterminateState: {saveOutcome: unknown}
  reconcile: {mode: merge, dataSourceRef: records, identityField: id, resultPath: data}
  refresh: [{dataSourceRef: records, bypassCache: true, clearSelection: true}]
editableCollection:
  dataSourceRef: records
  identityFields: [id]
  selection: {mode: multi, min: 1, max: 20}
  selectionStatus: true
  selectionPrompt: Select one row to continue.
  operations:
    - id: edit
      label: Edit
      dialogId: recordDraft
      handler: Host.openRecord
      requiresSelection: true
      selection: {mode: single, min: 1, max: 1, every: {source: row, field: editable, equals: true}}
      mutation: {dataSourceRef: records_patch}
assignmentPicker:
  availableDataSourceRef: available
  assignedDataSourceRef: assigned
  identityFields: [id]
  allowMultiple: true
  assign: {dataSourceRef: assignment_patch}
  unassign: {dataSourceRef: assignment_patch}
statusWorkflow:
  stateField: status
  transitions:
    - {id: activate, from: [inactive], to: active, label: Activate, command: {dataSourceRef: status_patch}}
treeEditor:
  dataSourceRef: targeting
  childrenField: children
  identityField: id
  labelField: name
  selectionMode: includeExclude
  selectedField: targeting.include
  excludedField: targeting.exclude
  searchable: true
  collapsible: true
  defaultExpandedDepth: 2
  cascade: descendants
wizard:
  stateKey: create-record
  steps:
    - {id: details, label: Details, containerId: detailsStep, validWhen: {source: form, field: name, notEmpty: true}}
  submit: {dataSourceRef: records_patch}
uploadCollection:
  accept: [text/csv]
  multiple: true
  maxFiles: 5
  maxBytes: 1048576
  transport: mcpBlob
  blobField: File
  metadataField: Data
  upload: {dataSourceRef: upload_patch}
derivedDataSource:
  version: v1
  maxRows: 5000
  sources: [records, metrics]
  optionalSources: [metrics]
  pipeline:
    - operation: join
      source: metrics
      on: [id]
      joinType: left
      joinCardinality: one
      projections: [{target: total, source: total}]
    - operation: group
      groupBy: [status]
      measures: [{target: count, operation: count}]
permissionBoundary:
  mode: selection
  dataSourceRef: resource_authorization
  identityField: id
  capability: write
responsiveDataGrid:
  identityColumns: [id, name]
  breakpoints:
    phone: {columns: [id, name, status], stickyColumns: [id], density: compact, rowLayout: cards, readOnlyCards: true}
historyDiff:
  dataSourceRef: history
  identityField: id
  beforeField: before
  afterField: after
  ignoreFields: [updated]
  fieldLabels: {name: Name}
  redactFields: [credentials.token]
  arrayStrategy: set
  recordLabelField: eventName
scheduleEditor:
  dataSourceRef: schedule
  startField: start
  endField: end
  timeZoneField: timeZone
  allowOverlap: false
  minDuration: 1h
  allowAdd: true
  allowRemove: false
  ambiguousTimePolicy: later
  mutation: {dataSourceRef: schedule_patch}
`)
	var container Container
	if err := yaml.Unmarshal(data, &container); err != nil {
		t.Fatal(err)
	}
	if container.EditableCollection == nil || len(container.EditableCollection.Operations) != 1 {
		t.Fatalf("editable collection missing: %#v", container.EditableCollection)
	}
	if container.EditableCollection.Operations[0].Handler != "Host.openRecord" {
		t.Fatalf("editable collection operation handler missing: %#v", container.EditableCollection.Operations[0])
	}
	if container.EditableCollection.Operations[0].Selection == nil || container.EditableCollection.Operations[0].Selection.Max != 1 {
		t.Fatalf("per-operation selection override missing: %#v", container.EditableCollection.Operations[0])
	}
	if container.EditableCollection.Operations[0].Selection.Every["field"] != "editable" {
		t.Fatal("selected-row predicate was truncated")
	}
	if container.MutationCommand == nil {
		t.Fatal("mutation command missing")
	}
	if container.MutationCommand.Label != "Save records" || container.MutationCommand.Intent != "primary" {
		t.Fatalf("mutation presentation missing: %#v", container.MutationCommand)
	}
	if container.MutationCommand.Icon != "floppy-disk" || !container.MutationCommand.HideLabel || container.MutationCommand.IndeterminateState["saveOutcome"] != "unknown" {
		t.Fatal("command presentation/indeterminate state missing")
	}
	if container.MutationCommand.InvalidMessage == "" || container.MutationCommand.TimeoutMs != 45000 {
		t.Fatal("mutation validation/timeout contract missing")
	}
	if container.MutationCommand.CommandID != "save-records" || container.MutationCommand.InvocationParameter != "RequestId" {
		t.Fatal("command identity/correlation contract missing")
	}
	if container.AssignmentPicker == nil || container.StatusWorkflow == nil || container.TreeEditor == nil || container.Wizard == nil {
		t.Fatal("assignment/status/tree/wizard primitives were truncated")
	}
	if container.TreeEditor.SelectedField != "targeting.include" || container.TreeEditor.ExcludedField != "targeting.exclude" {
		t.Fatal("tree hydration selectors missing")
	}
	if container.TreeEditor.Searchable == nil || !*container.TreeEditor.Searchable || container.TreeEditor.DefaultExpandedDepth != 2 {
		t.Fatal("tree scale metadata missing")
	}
	if container.UploadCollection == nil || container.UploadCollection.Transport != "mcpBlob" || container.UploadCollection.Multiple == nil || !*container.UploadCollection.Multiple {
		t.Fatalf("upload contract missing: %#v", container.UploadCollection)
	}
	if container.DerivedDataSource == nil || len(container.DerivedDataSource.Pipeline) != 2 || container.PermissionBoundary == nil {
		t.Fatal("derived datasource or permission boundary missing")
	}
	if container.DerivedDataSource.Pipeline[0].Projections[0].Target != "total" || container.DerivedDataSource.Pipeline[1].Measures[0].Operation != "count" {
		t.Fatal("typed derived projection/group measures were truncated")
	}
	if container.DerivedDataSource.Version != "v1" || container.DerivedDataSource.MaxRows != 5000 || container.DerivedDataSource.Pipeline[0].JoinCardinality != "one" {
		t.Fatal("derived pipeline governance metadata missing")
	}
	if len(container.DerivedDataSource.OptionalSources) != 1 || container.DerivedDataSource.OptionalSources[0] != "metrics" {
		t.Fatal("derived optional sources were truncated")
	}
	if container.ResponsiveDataGrid == nil || container.HistoryDiff == nil || container.ScheduleEditor == nil {
		t.Fatal("grid/history/schedule primitive missing")
	}
	if !container.ResponsiveDataGrid.Breakpoints["phone"].ReadOnlyCards || container.ScheduleEditor.AmbiguousTimePolicy != "later" {
		t.Fatal("responsive card safety or DST ambiguity policy missing")
	}
	if container.HistoryDiff.FieldLabels["name"] != "Name" || container.ScheduleEditor.AllowRemove == nil || *container.ScheduleEditor.AllowRemove {
		t.Fatal("history labels or explicit schedule removal policy was truncated")
	}
	if container.HistoryDiff.ArrayStrategy != "set" || container.HistoryDiff.RecordLabelField != "eventName" || len(container.HistoryDiff.RedactFields) != 1 {
		t.Fatal("history canonical/redaction metadata missing")
	}
	encoded, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var output map[string]interface{}
	if err := json.Unmarshal(encoded, &output); err != nil {
		t.Fatal(err)
	}
	if output["editableCollection"] == nil || output["scheduleEditor"] == nil {
		t.Fatalf("workflow primitives were not serialized: %s", encoded)
	}
	editable := output["editableCollection"].(map[string]interface{})
	if editable["selectionStatus"] != true || editable["selectionPrompt"] != "Select one row to continue." {
		t.Fatalf("editableCollection selection status metadata was not retained: %#v", editable)
	}
}
