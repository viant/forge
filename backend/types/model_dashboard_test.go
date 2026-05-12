package types

import (
	"encoding/json"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestDashboardCompactShapePreservesOptionalFields(t *testing.T) {
	const source = `
view:
  content:
    id: perfDashboard
    kind: dashboard
    title: Performance Dashboard
    subtitle: State and DMA reporting
    defaultMode: dashboard
    toolbar:
      modes: [dashboard, report]
      items: []
    report:
      enabled: true
      mode: document
      generatedAt: "2026-04-28T10:00:00Z"
      include: [summary, charts, tables]
      export: [html, pdf]
      includeState:
        filters: true
        selection: true
    containers:
      - id: stateGeo
        kind: dashboard.geoMap
        title: US State Performance
        subtitle: State tile map
        dataSourceRef: byState
        filterBindings:
          region: region
        selectionBindings:
          entityKey: stateCode
        visibleWhen:
          source: filters
          field: region
          notEmpty: true
        metric:
          key: spend
          label: Spend
          format: currency
        geo:
          shape: us-states
          key: stateCode
          labelKey: stateName
          dimension: stateCode
          aggregate: sum
          color:
            field: status
            rules:
              - value: healthy
                label: Healthy
                color: "#1f8f63"
              - value: critical
                label: Critical
                color: "#c23030"
        limit: 5
      - id: dmaTable
        kind: dashboard.table
        dataSourceRef: byDma
        selectionBindings:
          entityKey: stateCode
        columns:
          - key: stateCode
            label: State
          - key: dma
            label: DMA
          - key: city
            label: City
            type: link
            link:
              href: cityDashboardUrl
        quickFilter: true
        density: compact
        formattingRules:
          - field: status
            value: critical
            style:
              color: "#c23030"
`

	var window Window
	if err := yaml.Unmarshal([]byte(source), &window); err != nil {
		t.Fatalf("unmarshal dashboard metadata: %v", err)
	}

	root := window.View.Content
	if root == nil {
		t.Fatalf("expected root content")
	}
	if root.Subtitle != "State and DMA reporting" {
		t.Fatalf("subtitle was not preserved: %q", root.Subtitle)
	}
	if root.Dashboard == nil || root.Dashboard.ReportOptions == nil || !root.Dashboard.ReportOptions.Enabled || !root.Dashboard.ReportOptions.IncludeState["selection"] {
		t.Fatalf("report options were not normalized under dashboard: %#v", root.Dashboard)
	}
	if len(root.Containers) != 2 {
		t.Fatalf("expected dashboard blocks, got %d", len(root.Containers))
	}

	geoBlock := root.Containers[0]
	if geoBlock.Kind != "dashboard.geoMap" {
		t.Fatalf("unexpected block kind: %q", geoBlock.Kind)
	}
	if geoBlock.SelectionBindings["entityKey"] != "stateCode" {
		t.Fatalf("selection bindings were not preserved: %#v", geoBlock.SelectionBindings)
	}
	if geoBlock.Dashboard == nil || geoBlock.Dashboard.VisibleWhen == nil || geoBlock.Dashboard.VisibleWhen.Source != "filters" {
		t.Fatalf("compact visibleWhen was not normalized under dashboard: %#v", geoBlock.Dashboard)
	}
	if geoBlock.Dashboard == nil || geoBlock.Dashboard.Geo == nil {
		t.Fatalf("compact geo config was not normalized under dashboard: %#v", geoBlock.Dashboard)
	}
	if geoBlock.Dashboard.Geo.Metric == nil || geoBlock.Dashboard.Geo.Metric.Key != "spend" || geoBlock.Dashboard.Geo.Metric.Format != "currency" {
		t.Fatalf("metric was not normalized under dashboard.geo: %#v", geoBlock.Dashboard.Geo.Metric)
	}
	if geoBlock.Dashboard.Geo.Color == nil || len(geoBlock.Dashboard.Geo.Color.Rules) != 2 {
		t.Fatalf("geo color rules were not normalized under dashboard.geo: %#v", geoBlock.Dashboard.Geo)
	}
	if geoBlock.Dashboard.Geo.Color.Rules[1].Value != "critical" {
		t.Fatalf("unexpected geo rule value: %#v", geoBlock.Dashboard.Geo.Color.Rules[1].Value)
	}

	tableBlock := root.Containers[1]
	if tableBlock.Dashboard == nil || tableBlock.Dashboard.Table == nil {
		t.Fatalf("compact table config was not normalized under dashboard: %#v", tableBlock.Dashboard)
	}
	if tableBlock.Dashboard.Table.QuickFilter != true || tableBlock.Dashboard.Table.Density != "compact" {
		t.Fatalf("table options were not normalized under dashboard.table: %#v", tableBlock.Dashboard.Table)
	}
	if len(tableBlock.Dashboard.Table.Columns) != 3 || len(tableBlock.Dashboard.Table.FormattingRules) != 1 {
		t.Fatalf("table columns/formatting were not normalized under dashboard.table: %#v", tableBlock.Dashboard.Table)
	}
	if tableBlock.Dashboard.Table.Columns[2].Type != "link" || tableBlock.Dashboard.Table.Columns[2].Link == nil || tableBlock.Dashboard.Table.Columns[2].Link.Href != "cityDashboardUrl" {
		t.Fatalf("table link column was not preserved under dashboard.table: %#v", tableBlock.Dashboard.Table.Columns[2])
	}

	encoded, err := json.Marshal(root)
	if err != nil {
		t.Fatalf("marshal dashboard metadata: %v", err)
	}
	var asMap map[string]interface{}
	if err := json.Unmarshal(encoded, &asMap); err != nil {
		t.Fatalf("unmarshal marshaled dashboard metadata: %v", err)
	}
	blocks, _ := asMap["containers"].([]interface{})
	firstBlock, _ := blocks[0].(map[string]interface{})
	if _, ok := firstBlock["selectionBindings"]; !ok {
		t.Fatalf("marshaled dashboard block dropped selectionBindings: %s", encoded)
	}
	if _, ok := firstBlock["geo"]; ok {
		t.Fatalf("marshaled compact input should emit normalized dashboard.geo, not direct geo: %s", encoded)
	}
	if _, ok := firstBlock["visibleWhen"]; ok {
		t.Fatalf("marshaled compact input should emit normalized dashboard.visibleWhen, not direct visibleWhen: %s", encoded)
	}
	dashboard, _ := firstBlock["dashboard"].(map[string]interface{})
	if _, ok := dashboard["geo"]; !ok {
		t.Fatalf("marshaled dashboard block dropped normalized dashboard.geo: %s", encoded)
	}
	if _, ok := dashboard["visibleWhen"]; !ok {
		t.Fatalf("marshaled dashboard block dropped normalized dashboard.visibleWhen: %s", encoded)
	}
}

func TestDashboardGroupedShapePreservesOptionalFields(t *testing.T) {
	const source = `
view:
  content:
    id: perfDashboard
    kind: dashboard
    title: Performance Dashboard
    dashboard:
      reportOptions:
        enabled: true
        mode: document
    containers:
      - id: stateGeo
        kind: dashboard.geoMap
        dataSourceRef: byState
        selectionBindings:
          entityKey: stateCode
        dashboard:
          visibleWhen:
            source: selection
            field: entityKey
            equals: CA
          geo:
            shape: us-states
            key: stateCode
            labelKey: stateName
            dimension: stateCode
            metric:
              key: spend
              label: Spend
              format: currency
            aggregate: sum
            color:
              field: status
              rules:
                - value: healthy
                  label: Healthy
                  color: "#1f8f63"
      - id: dmaTable
        kind: dashboard.table
        dataSourceRef: byDma
        selectionBindings:
          entityKey: stateCode
        dashboard:
          table:
            columns:
              - key: stateCode
                label: State
              - key: dma
                label: DMA
              - key: city
                label: City
                type: link
                link:
                  href: cityDashboardUrl
            limit: 50
            quickFilter: true
            density: compact
            formattingRules:
              - field: status
                value: critical
                style:
                  color: "#c23030"
`

	var window Window
	if err := yaml.Unmarshal([]byte(source), &window); err != nil {
		t.Fatalf("unmarshal dashboard metadata: %v", err)
	}
	root := window.View.Content
	if root == nil || len(root.Containers) != 2 {
		t.Fatalf("expected grouped dashboard blocks, got %#v", root)
	}
	if root.Dashboard == nil || root.Dashboard.ReportOptions == nil || !root.Dashboard.ReportOptions.Enabled {
		t.Fatalf("grouped report options were not preserved: %#v", root.Dashboard)
	}

	geoBlock := root.Containers[0]
	if geoBlock.Dashboard == nil || geoBlock.Dashboard.Geo == nil {
		t.Fatalf("grouped geo config was not preserved: %#v", geoBlock.Dashboard)
	}
	if geoBlock.Dashboard.VisibleWhen == nil || geoBlock.Dashboard.VisibleWhen.Equals != "CA" {
		t.Fatalf("grouped visibleWhen was not preserved: %#v", geoBlock.Dashboard)
	}
	if geoBlock.Dashboard.Geo.Metric == nil || geoBlock.Dashboard.Geo.Metric.Key != "spend" {
		t.Fatalf("grouped geo metric was not preserved: %#v", geoBlock.Dashboard.Geo)
	}
	if len(geoBlock.Dashboard.Geo.Color.Rules) != 1 {
		t.Fatalf("grouped geo color rules were not preserved: %#v", geoBlock.Dashboard.Geo.Color)
	}

	tableBlock := root.Containers[1]
	if tableBlock.Dashboard == nil || tableBlock.Dashboard.Table == nil {
		t.Fatalf("grouped table config was not preserved: %#v", tableBlock.Dashboard)
	}
	if tableBlock.Dashboard.Table.Limit != 50 || !tableBlock.Dashboard.Table.QuickFilter {
		t.Fatalf("grouped table options were not preserved: %#v", tableBlock.Dashboard.Table)
	}
	if len(tableBlock.Dashboard.Table.Columns) != 3 || len(tableBlock.Dashboard.Table.FormattingRules) != 1 {
		t.Fatalf("grouped table columns/formatting were not preserved: %#v", tableBlock.Dashboard.Table)
	}
	if tableBlock.Dashboard.Table.Columns[2].Type != "link" || tableBlock.Dashboard.Table.Columns[2].Link == nil || tableBlock.Dashboard.Table.Columns[2].Link.Href != "cityDashboardUrl" {
		t.Fatalf("grouped table link column was not preserved: %#v", tableBlock.Dashboard.Table.Columns[2])
	}

	encoded, err := json.Marshal(root)
	if err != nil {
		t.Fatalf("marshal grouped dashboard metadata: %v", err)
	}
	if !json.Valid(encoded) {
		t.Fatalf("invalid grouped dashboard JSON: %s", encoded)
	}
	var asMap map[string]interface{}
	if err := json.Unmarshal(encoded, &asMap); err != nil {
		t.Fatalf("unmarshal grouped dashboard metadata: %v", err)
	}
	blocks, _ := asMap["containers"].([]interface{})
	firstBlock, _ := blocks[0].(map[string]interface{})
	dashboard, _ := firstBlock["dashboard"].(map[string]interface{})
	if _, ok := dashboard["geo"]; !ok {
		t.Fatalf("marshaled grouped dashboard block dropped dashboard.geo: %s", encoded)
	}
	if _, ok := dashboard["visibleWhen"]; !ok {
		t.Fatalf("marshaled grouped dashboard block dropped dashboard.visibleWhen: %s", encoded)
	}
}
