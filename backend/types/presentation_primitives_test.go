package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestPresentationPrimitivesRoundTrip(t *testing.T) {
	data := []byte(`
id: presentation
draftForm:
  dataSourceRef: draft
  saveLabel: Apply
  validWhen: {source: form, field: name, notEmpty: true}
  submit: {dataSourceRef: patch}
queryToolbar:
  dataSourceRef: records
  density: compact
  layout: responsive
  items: [{id: filter, type: filter, label: Filter}]
stableTabs:
  defaultSelectedTabId: details
  renderActiveTabPanelOnly: true
resourceHeader:
  dataSourceRef: record
  titleField: name
  fields: [{label: ID, field: id, format: id}]
  actions: [{id: watch, label: Watch, icon: star, hideLabel: true, handler: Host.watch}]
dataStateBoundary:
  dataSourceRefs: [records, summary]
  allowPartial: true
  renderEmptyContent: true
relationDrill:
  dataSourceRef: record
  countField: childCount
  singularLabel: child
  pluralLabel: children
  link: {windowKey: childList}
notificationRules:
  rules: [{id: missing, intent: warning, message: Missing input, visibleWhen: {source: form, field: input, empty: true}}]
metricSummary:
  dataSourceRef: summary
  columns: 4
  metrics: [{id: total, label: Total, field: total, format: currency2, comparisonField: delta}]
detailView:
  dataSourceRef: record
  columns: 2
  responsiveColumns: {phone: 1}
  sections:
    - id: general
      label: General
      fields: [{id: id, label: ID, field: id, format: id, copyable: true}]
masterDetail:
  stateKey: selectedRecord
  identityFields: [id]
  master: {containerId: recordList}
  detail:
    containerId: recordDetail
    parameters: {RecordId: {source: row, selector: id, wrap: array}}
    allowedWhen: {source: authorization, field: resource.capabilities.read, equals: true}
  emptyDetail: {message: Select a record}
  selectionInvalidation: clear
  responsive: {wide: split, narrow: drill}
`)
	var container Container
	if err := yaml.Unmarshal(data, &container); err != nil {
		t.Fatal(err)
	}
	if container.DraftForm == nil || container.DraftForm.Submit == nil || container.DraftForm.SaveLabel != "Apply" {
		t.Fatal("draftForm truncated")
	}
	if container.QueryToolbar == nil || len(container.QueryToolbar.Items) != 1 || container.StableTabs == nil {
		t.Fatal("queryToolbar/stableTabs truncated")
	}
	if container.ResourceHeader == nil || len(container.ResourceHeader.Actions) != 1 || container.ResourceHeader.Actions[0].Handler != "Host.watch" {
		t.Fatal("resourceHeader truncated")
	}
	if container.DataStateBoundary == nil || !container.DataStateBoundary.AllowPartial || !container.DataStateBoundary.RenderEmptyContent || container.RelationDrill == nil {
		t.Fatal("data state/relation truncated")
	}
	if container.NotificationRules == nil || len(container.NotificationRules.Rules) != 1 || container.MetricSummary == nil || len(container.MetricSummary.Metrics) != 1 {
		t.Fatal("notification/metric truncated")
	}
	if container.DetailView == nil || len(container.DetailView.Sections) != 1 || !container.DetailView.Sections[0].Fields[0].Copyable {
		t.Fatal("detailView truncated")
	}
	if container.MasterDetail == nil || len(container.MasterDetail.IdentityFields) != 1 || container.MasterDetail.Detail.Parameters["RecordId"] == nil {
		t.Fatal("masterDetail truncated")
	}
	if container.MasterDetail.Detail.AllowedWhen["field"] != "resource.capabilities.read" {
		t.Fatal("masterDetail pre-fetch predicate was truncated")
	}
	encoded, err := json.Marshal(container)
	if err != nil {
		t.Fatal(err)
	}
	var output map[string]interface{}
	if err := json.Unmarshal(encoded, &output); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"draftForm", "queryToolbar", "stableTabs", "resourceHeader", "dataStateBoundary", "relationDrill", "notificationRules", "metricSummary", "detailView", "masterDetail"} {
		if output[key] == nil {
			t.Fatalf("%s was not serialized", key)
		}
	}
}
