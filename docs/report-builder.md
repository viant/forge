# Report Builder

`dashboard.reportBuilder` is a dedicated Forge block for cube-style report
composition. It is intentionally separate from the existing dashboard filters /
timeline / table grammar so current dashboards stay backward compatible.

## Layout

- top: measure shelf
- left: dimension shelf and optional group-by selector
- middle: chart or table result surface
- bottom: static icon filters and dynamic lookup-backed filter groups

## Why a dedicated block

The current dashboard primitives are already heavily used. This block avoids
changing `dashboard.filters` semantics while still reusing:

- existing datasource fetch flow
- existing chart renderer
- existing window/dialog lookup infrastructure
- existing window snapshot / `windowForm` state persistence

## Config shape

```yaml
kind: dashboard.reportBuilder
id: reportBuilder
title: Report Builder
dataSourceRef: report_source
reportBuilder:
  unifiedFamilyRows: true

  measures:
    - id: metricA
      key: metricA
      label: Metric A
      format: currency
      default: true
      paramPath: measures.metricA
    - id: metricB
      key: metricB
      label: Metric B
      format: compactNumber
      paramPath: measures.metricB

  dimensions:
    - id: time
      key: time
      label: Time
      chartAxis: true
      default: true
      paramPath: dimensions.time
    - id: category
      key: category
      label: Category
      default: true
      paramPath: dimensions.category

  groupBy:
    default: category
    options:
      - value: category
        label: Category
        dimensionId: category

  staticFilters:
    - id: segments
      label: Segments
      multiple: true
      paramPath: filters.segments
      options:
        - value: alpha
          label: Alpha
          icon: media
          default: true
        - value: beta
          label: Beta
          icon: video
    - id: optionSet
      label: Option Set
      multiple: true
      paramPath: filters.optionSet
      optionsDataSourceRef: option_catalog
      optionValueSelector: id
      optionLabelSelector: name
      optionIconSelector: icon
      optionChildKeys: [children, childNodes]
    - id: dateRange
      label: Date Range
      type: dateRange
      startParamPath: filters.From
      endParamPath: filters.To
      default:
        start: "2026-04-01"
        end: "2026-04-30"

  dynamicFilterGroups:
    - id: include
      label: Include
      filters:
        - id: entityId
          label: Entity
          dialogId: entityPicker
          paramPath: filters.entityId
          multiple: false
          valueSelector: entityId
          labelSelector: entityName
        - id: groupIds
          label: Group
          dialogId: groupPicker
          paramPath: filters.groupIds
          multiple: true
          valueSelector: groupId
          labelSelector: groupName
    - id: exclude
      label: Exclude
      filters:
        - id: excludeEntityId
          label: Entity
          dialogId: entityPicker
          paramPath: filters.excludeEntityIds
          multiple: true
          valueSelector: entityId
          labelSelector: entityName
        - id: excludeGroupIds
          label: Group
          dialogId: groupPicker
          paramPath: filters.excludeGroupIds
          multiple: true
          valueSelector: groupId
          labelSelector: groupName

  dynamicFilterFamilies:
    - id: entities
      label: Entities
      includeFilterIds: [entityId, groupIds]
      excludeFilterIds: [excludeEntityId, excludeGroupIds]

  result:
    chartCreationMode: explicit
    defaultMode: table
    viewModes: [table, chart]
    chartType: line
    chartWizard:
      supportedTypes: [line, bar, area]
    defaultChartSpecs:
      - title: Metric A by Time
        type: line
        xField: time
        yFields: [metricA]
      - title: Metric A by Time and Category
        type: line
        xField: time
        yFields: [metricA]
        seriesField: category
    pageSize: 50
    pageSizeOptions: [25, 50, 100, 250]
    orderFields:
      - value: time
        label: Time
        field: time
        default: true
        defaultDirection: asc
      - value: metricA
        label: Metric A
        field: metricA
        defaultDirection: desc
      - value: metricB
        label: Metric B
        field: metricB
        defaultDirection: desc

  request:
    autoFetch: true
    timeoutMs: 300000
    baseParameters:
      scope: {}
```

## Behavior

- measure pills are configurable and backward-compatible with current chart
  rendering
- static filters render as generic icon buttons
- static filters can come from inline config or a datasource-backed option list
- datasource-backed option lists support both flat and tree-shaped collections
  through `optionChildKeys`
- dynamic filters are grouped by category and added one line at a time
- `unifiedFamilyRows: true` renders configured `dynamicFilterFamilies` as one
  family card with per-row include/exclude direction, instead of split group
  sections
- each dynamic line can open an existing Forge dialog chosen by the host app
- dynamic and static filter option sources can be flat or tree-backed
- dynamic lines can use `dialogId` directly or a nested `lookup.dialogId`
- dialogs can opt into a styled mobile header with `style.headerBackgroundColor`
  and `style.headerTextColor` hex values
- ordering is limited to predefined config entries rather than arbitrary
  user-entered column names
- pagination is explicit through `limit` / `offset` request values
- builder selections are persisted under `windowForm`, so the state remains
  visible to the existing UI snapshot tooling
- explicit chart mode keeps table as the default result surface until the user
  selects or creates a valid chart spec
- titled default chart specs can be provided in metadata so users can apply a
  curated chart without opening the manual chart dialog
- datasource fetches are driven by explicit nested request parameters, not by
  inferred transcript state
