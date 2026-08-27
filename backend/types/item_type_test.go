package types

import (
	"testing"

	"gopkg.in/yaml.v3"
)

func TestContainerUnmarshal_PreservesPlainLabelItemType(t *testing.T) {
	input := []byte(`
id: pacingSummary
visibleWhen:
  source: windowForm
  field: periodView
  equals: today
items:
  - id: pacingIndexLabel
    widget: label
    dataSourceRefSelector: periodView
    dataSourceRefSource: windowForm
    dataSourceRefs:
      today: order_performance_period_today
    scope: noop
    hideLabel: true
    aggregate: sum
    format: currency2
    visibleWhen:
      source: windowForm
      field: periodView
      equals: today
    properties:
      value: Pacing Index
`)

	var c Container
	if err := yaml.Unmarshal(input, &c); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}
	if len(c.Items) != 1 {
		t.Fatalf("expected one item, got %#v", c.Items)
	}
	if got := c.Items[0].Widget; got != "label" {
		t.Fatalf("expected item widget label, got %q (item=%#v)", got, c.Items[0])
	}
	if !c.Items[0].HideLabel {
		t.Fatalf("expected hideLabel to be preserved, got %#v", c.Items[0])
	}
	if c.VisibleWhen["source"] != "windowForm" {
		t.Fatalf("expected container visibleWhen to survive, got %#v", c.VisibleWhen)
	}
	if c.Items[0].VisibleWhen["field"] != "periodView" {
		t.Fatalf("expected item visibleWhen to survive, got %#v", c.Items[0].VisibleWhen)
	}
	if c.Items[0].DataSourceRefSelector != "periodView" {
		t.Fatalf("expected item dataSourceRefSelector to survive, got %#v", c.Items[0])
	}
	if c.Items[0].DataSourceRefs["today"] != "order_performance_period_today" {
		t.Fatalf("expected item dataSourceRefs to survive, got %#v", c.Items[0].DataSourceRefs)
	}
	if got := c.Items[0].Aggregate; got != "sum" {
		t.Fatalf("expected item aggregate to survive, got %#v", got)
	}
	if got := c.Items[0].Format; got != "currency2" {
		t.Fatalf("expected item format to survive, got %q (item=%#v)", got, c.Items[0])
	}
}

func TestGenericWindowMetadataPreservesPresentationAndCallbacks(t *testing.T) {
	input := []byte(`
id: genericWorkspace
visibleWhen:
  all:
    - source: collection
      notEmpty: true
    - source: form
      field: editing
      equals: true
table:
  emptyState:
    title: Create the first record
    action:
      id: addNew
      on:
        - event: onClick
          handler: domain.add
  toolbar:
    className: compact-toolbar
    density: compact
    layout: balanced
    items:
      - id: run
        icon: play
        className: run-action
        intent: success
        tooltip: Run selected record
        ariaLabel: Run selected record
        on:
          - event: onReadonly
            handler: domain.noSelection
          - event: onClick
            handler: domain.edit
            state:
              mode: editor
`)

	var c Container
	if err := yaml.Unmarshal(input, &c); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}
	if c.Dashboard != nil {
		t.Fatalf("generic window visibility must not create dashboard metadata: %#v", c.Dashboard)
	}
	if _, ok := c.VisibleWhen["all"]; !ok {
		t.Fatalf("compound generic visibleWhen was not preserved: %#v", c.VisibleWhen)
	}
	if c.Table == nil || c.Table.EmptyState["title"] != "Create the first record" {
		t.Fatalf("generic table empty state was not preserved: %#v", c.Table)
	}
	if c.Table.Toolbar == nil || c.Table.Toolbar.Density != "compact" || c.Table.Toolbar.Layout != "balanced" || c.Table.Toolbar.ClassName != "compact-toolbar" {
		t.Fatalf("generic toolbar presentation was not preserved: %#v", c.Table.Toolbar)
	}
	item := c.Table.Toolbar.Items[0]
	if item.ClassName != "run-action" || item.Intent != "success" || item.Tooltip != "Run selected record" || item.AriaLabel != "Run selected record" {
		t.Fatalf("generic toolbar item presentation was not preserved: %#v", item)
	}
	if len(item.On) != 2 || item.On[0].Handler != "domain.noSelection" || item.On[1].Handler != "domain.edit" || item.On[1].State["mode"] != "editor" {
		t.Fatalf("named callbacks and state patch were not preserved: %#v", item.On)
	}
}

func TestGenericQuickFilterFieldSelectorMetadata(t *testing.T) {
	input := []byte(`
filterSet:
  - name: quick
    mode: fieldSelector
    defaultField: status
    template:
      - id: status
        optionLabel: Status
        placeholder: Filter by status...
        width: 200
        operator: contains
quickFilterSet: quick
`)

	var dataSource DataSource
	if err := yaml.Unmarshal(input, &dataSource); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}
	filter := dataSource.FilterSet[0]
	if filter.Mode != "fieldSelector" || filter.DefaultField != "status" {
		t.Fatalf("field-selector filter metadata was not preserved: %#v", filter)
	}
	item := filter.Template[0]
	if item.OptionLabel != "Status" || item.Placeholder != "Filter by status..." || item.Width != 200 {
		t.Fatalf("quick-filter presentation was not preserved: %#v", item)
	}
}

func TestContainerUnmarshal_PreservesExtendedChartFields(t *testing.T) {
	input := []byte(`
id: performanceTab
chart:
  dataSourceRefSelector: periodView
  dataSourceRefSource: windowForm
  dataSourceRefs:
    today: order_performance_period_today
    yesterday: order_performance_period_yesterday
  type: composed
  xAxis:
    dataKey: advertiserTime
    tickFormat: ha
    tickFormatSelector: granularity
    tickFormats:
      hour: MM/dd h a
      day: MM/dd
  yAxis:
    label: Spend
    format: currency
  axes:
    right:
      label: Delivery
      format: compactNumber
  series:
    values:
      - label: Spend
        name: Spend
        value: spend
        type: area
        axis: left
        format: currency
        color: "#2f6de1"
`)

	var c Container
	if err := yaml.Unmarshal(input, &c); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}
	if c.Chart == nil {
		t.Fatalf("expected chart to be present")
	}
	if c.Chart.DataSourceRefSelector != "periodView" {
		t.Fatalf("expected dataSourceRefSelector to survive, got %#v", c.Chart)
	}
	if c.Chart.DataSourceRefSource != "windowForm" {
		t.Fatalf("expected dataSourceRefSource to survive, got %#v", c.Chart)
	}
	if c.Chart.DataSourceRefs["today"] != "order_performance_period_today" {
		t.Fatalf("expected dataSourceRefs to survive, got %#v", c.Chart.DataSourceRefs)
	}
	if c.Chart.YAxis.Format != "currency" {
		t.Fatalf("expected yAxis.format to survive, got %#v", c.Chart.YAxis)
	}
	if c.Chart.XAxis.TickFormatSelector != "granularity" || c.Chart.XAxis.TickFormats["hour"] != "MM/dd h a" {
		t.Fatalf("expected mapped xAxis tick formats to survive, got %#v", c.Chart.XAxis)
	}
	if c.Chart.Axes == nil || c.Chart.Axes.Right == nil || c.Chart.Axes.Right.Format != "compactNumber" {
		t.Fatalf("expected axes.right.format to survive, got %#v", c.Chart.Axes)
	}
	if len(c.Chart.Series.Values) != 1 {
		t.Fatalf("expected chart series values, got %#v", c.Chart.Series.Values)
	}
	if c.Chart.Series.Values[0].Type != "area" || c.Chart.Series.Values[0].Color != "#2f6de1" {
		t.Fatalf("expected extended series fields to survive, got %#v", c.Chart.Series.Values[0])
	}
}

func TestContainerUnmarshal_PreservesChartTableViewModes(t *testing.T) {
	input := []byte(`
id: deliveryTrend
viewModes: [chart, table]
chart:
  type: line
  xAxis:
    dataKey: day
  yAxis:
    label: Spend
  series:
    values:
      - label: Spend
        value: spend
`)

	var c Container
	if err := yaml.Unmarshal(input, &c); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}
	if len(c.ViewModes) != 2 || c.ViewModes[0] != "chart" || c.ViewModes[1] != "table" {
		t.Fatalf("expected chart/table view modes to survive, got %#v", c.ViewModes)
	}
}
