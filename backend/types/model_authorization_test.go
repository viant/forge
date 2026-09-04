package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestWindowAuthorizationYAML(t *testing.T) {
	source := []byte(`
authorization:
  dataSourceRef: resource_authorization
  scope: resource
  resource:
    type: document
    id: {source: windowForm, selector: DocumentId.0}
  requestedCapabilities: [read, write, managePermissions]
  behavior:
    failClosed: true
    authorizeBeforeDatasourceInit: true
view:
  content:
    id: root
    visibleWhen: {source: authorization, field: resource.capabilities.read, equals: true}
    items:
      - id: edit
        label: Edit
        type: button
        disabledWhen: {source: authorization, field: resource.capabilities.write, equals: false}
`)
	window := &Window{}
	if err := yaml.Unmarshal(source, window); err != nil {
		t.Fatal(err)
	}
	if window.Authorization == nil || window.Authorization.Resource == nil {
		t.Fatalf("authorization declaration was not retained: %#v", window.Authorization)
	}
	if got := window.Authorization.Resource.ID.Selector; got != "DocumentId.0" {
		t.Fatalf("unexpected resource selector %q", got)
	}
	if window.View.Content == nil || window.View.Content.Items[0].DisabledWhen == nil {
		t.Fatalf("authorization condition fields were not retained: %#v", window.View.Content)
	}
}

func TestColumnPresentationYAMLRetainsExplicitHiddenAndFormat(t *testing.T) {
	source := []byte(`
id: root
table:
  columns:
    - {id: startDate, name: Start, format: date, visible: false}
`)
	container := &Container{}
	if err := yaml.Unmarshal(source, container); err != nil {
		t.Fatal(err)
	}
	if len(container.Table.Columns) != 1 {
		t.Fatalf("expected one column, got %#v", container.Table.Columns)
	}
	column := container.Table.Columns[0]
	if column.Format != "date" {
		t.Fatalf("format was not retained: %#v", column)
	}
	if column.Visible == nil || *column.Visible {
		t.Fatalf("explicit visible:false was not retained: %#v", column)
	}
	payload, err := json.Marshal(column)
	if err != nil {
		t.Fatal(err)
	}
	if string(payload) != `{"id":"startDate","name":"Start","format":"date","visible":false,"tooltip":""}` {
		t.Fatalf("unexpected column JSON: %s", payload)
	}
}

func TestContainerSectionYAMLRetainsCollapsibleAndCompactProperties(t *testing.T) {
	source := []byte(`
id: properties
section:
  collapsible: true
  persistState: true
  stateKey: advertiserProperties
  properties:
    compact: true
    collapseProps:
      defaultIsOpen: true
      keepChildrenMounted: true
`)
	container := &Container{}
	if err := yaml.Unmarshal(source, container); err != nil {
		t.Fatal(err)
	}
	if container.Section == nil || !container.Section.Collapsible {
		t.Fatalf("collapsible section was not retained: %#v", container.Section)
	}
	if !container.Section.PersistState || container.Section.StateKey != "advertiserProperties" {
		t.Fatalf("persistent section state was not retained: %#v", container.Section)
	}
	if compact, ok := container.Section.Properties["compact"].(bool); !ok || !compact {
		t.Fatalf("compact section property was not retained: %#v", container.Section.Properties)
	}
	collapseProps, ok := container.Section.Properties["collapseProps"].(map[string]interface{})
	if !ok || collapseProps["defaultIsOpen"] != true || collapseProps["keepChildrenMounted"] != true {
		t.Fatalf("collapse properties were not retained: %#v", container.Section.Properties)
	}
}

func TestContainerTabsYAMLRetainsCompactSectionAppearance(t *testing.T) {
	source := []byte(`
id: advertiserNavigation
tabs:
  appearance: section
  renderActiveTabPanelOnly: true
  dataSourceFetchMode: once
  keepVisitedTabPanelsMounted: true
  compact: true
  defaultSelectedTabId: campaigns
`)
	container := &Container{}
	if err := yaml.Unmarshal(source, container); err != nil {
		t.Fatal(err)
	}
	if container.Tabs == nil || container.Tabs.Appearance != "section" || !container.Tabs.RenderActiveTabPanelOnly || container.Tabs.DataSourceFetchMode != "once" || !container.Tabs.KeepVisitedTabPanelsMounted || !container.Tabs.Compact {
		t.Fatalf("compact section tabs were not retained: %#v", container.Tabs)
	}
}

func TestContainerRetainsRootScrollMode(t *testing.T) {
	source := []byte(`
id: campaign
scrollMode: self
`)
	container := &Container{}
	if err := yaml.Unmarshal(source, container); err != nil {
		t.Fatal(err)
	}
	if container.ScrollMode != "self" {
		t.Fatalf("root scroll mode was not retained: %#v", container)
	}
}

func TestDialogActionsRetainDisabledAndClose(t *testing.T) {
	source := []byte(`
id: draft
title: Draft
content: {id: body}
actions:
  - {id: cancel, label: Cancel, close: true}
  - {id: create, label: Create, disabled: true}
`)
	dialog := &Dialog{}
	if err := yaml.Unmarshal(source, dialog); err != nil {
		t.Fatal(err)
	}
	if len(dialog.Actions) != 2 || !dialog.Actions[0].Close || !dialog.Actions[1].Disabled {
		t.Fatalf("dialog action state was not retained: %#v", dialog.Actions)
	}
}

func TestToolbarItemRetainsSelectionGate(t *testing.T) {
	source := []byte(`
items:
  - id: actions
    label: Actions
    enableWhenSelection: true
`)
	toolbar := &Toolbar{}
	if err := yaml.Unmarshal(source, toolbar); err != nil {
		t.Fatal(err)
	}
	if len(toolbar.Items) != 1 || !toolbar.Items[0].EnableWhenSelection {
		t.Fatalf("selection gate was not retained: %#v", toolbar.Items)
	}
}

func TestToolbarMenuItemsRetainDisabledState(t *testing.T) {
	source := []byte(`
id: pixels
toolbar:
  items:
    - id: actions
      label: Actions
      type: menu
      menuItems:
        - {id: generate, label: Generate tags, disabled: true}
        - {id: archive, label: Archive, disabled: true}
`)
	container := &Container{}
	if err := yaml.Unmarshal(source, container); err != nil {
		t.Fatal(err)
	}
	items := container.Toolbar.Items
	if len(items) != 1 || len(items[0].MenuItems) != 2 || !items[0].MenuItems[0].Disabled || !items[0].MenuItems[1].Disabled {
		t.Fatalf("toolbar menu items were not retained: %#v", items)
	}
}

func TestTableColumnRetainsStatusBadgeAndTimezone(t *testing.T) {
	source := []byte(`
id: orders
table:
  columns:
    - id: status
      name: Status
      timeZoneSelector: advertiserTimeZone.ianaTimezoneStr
      badge:
        field: status
        valueMap: {"0": Inactive, "4": Completed}
        toneMap: {"0": neutral, "4": info}
        replaceValue: true
`)
	container := &Container{}
	if err := yaml.Unmarshal(source, container); err != nil {
		t.Fatal(err)
	}
	column := container.Table.Columns[0]
	if column.TimeZoneSelector != "advertiserTimeZone.ianaTimezoneStr" || column.Badge == nil || !column.Badge.ReplaceValue || column.Badge.ValueMap["4"] != "Completed" || column.Badge.ToneMap["4"] != "info" {
		t.Fatalf("status badge/timezone metadata was not retained: %#v", column)
	}
}

func TestDataSourceFilterTemplateRetainsOptions(t *testing.T) {
	source := []byte(`
filterSet:
  - name: quick
    default: true
    template:
      - id: ActiveStatus
        label: Status
        operator: in
        type: int[]
        options:
          - {value: "0", label: Inactive}
          - {value: "4", label: Completed}
`)
	dataSource := &DataSource{}
	if err := yaml.Unmarshal(source, dataSource); err != nil {
		t.Fatal(err)
	}
	options := dataSource.FilterSet[0].Template[0].Options
	if len(options) != 2 || options[1].Value != "4" || options[1].Label != "Completed" {
		t.Fatalf("filter template options were not retained: %#v", options)
	}
}
