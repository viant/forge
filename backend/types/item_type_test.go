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
