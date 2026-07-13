# Report Builder

`dashboard.reportBuilder` is a dedicated Forge block for cube-style report
composition. It is intentionally separate from the existing dashboard filters /
timeline / table grammar so current dashboards stay backward compatible.

Detailed primitive/reference documentation lives in
[report-builder-primitives.md](/Users/awitas/go/src/github.com/viant/forge/docs/report-builder-primitives.md).

Notable current direction:

- `filterBarBlock` is treated as a placement/presentation primitive for report
  filters rather than the canonical inventory of available filters.

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

## Unified predicates

`predicates` (with optional `predicateGroups`) is the unified way to declare
scope/filtering intent once, instead of hand-writing the legacy split of
`staticFilters`, `dynamicFilterGroups` and `dynamicFilterFamilies`. Predicates
are lowered onto those runtime structures automatically (implemented in
`src/components/dashboard/reportBuilderPredicates.js`), so request shaping,
lookup hydration, persistence and the filter UI stay unchanged. Explicit legacy
declarations with the same ids win over generated ones, which supports
incremental migration.

```yaml
reportBuilder:
  predicateGroups:
    - id: inventory
      label: Inventory
      icon: box

  predicates:
    # pinned/static scope predicate
    - id: channels
      label: Channels
      pinned: true
      multiple: true
      paramPath: filters.includeChannelV2
      options:
        - value: 1
          label: Display
          default: true
      prefill:
        path: includeChannelV2         # resolved against windowForm.prefill

    # pinned date range (dateRange implies pinned)
    - id: dateRange
      label: Date Range
      kind: dateRange
      required: true
      startParamPath: filters.from
      endParamPath: filters.to
      prefill:
        start: from
        end: to

    # include/exclude capable targeting predicate, lookup-backed
    - id: publisher
      label: Publisher
      group: inventory                 # grouped into a predicate family
      dialogId: publisherPicker
      manualEntry: true
      manualValueType: int
      valueSelector: publisherId
      labelSelector: publisherName
      include:
        filterId: includePublisherId
        paramPath: filters.includePublisherId
      exclude:
        filterId: excludePublisherId
        paramPath: filters.excludePublisherId
      prefill:
        include: includePublisherId
        exclude: excludePublisherId

    # targeting predicate resolved through a lookup hook (targetingFeatureKey)
    - id: siteType
      label: Site Type
      group: inventory
      targetingFeatureKey: ad.site.type
      include: true                    # defaults: filterId includeSiteType, paramPath filters.includeSiteType
      exclude: true

    # neutral (non-directional) predicate; lands in the `scope` bucket by default
    - id: audienceIds
      label: Audience
      dialogId: audiencePicker
      valueSelector: audienceId
      labelSelector: audienceName
      paramPath: filters.audienceIds
      prefill:                         # ordered fallback paths; first non-empty wins
        - scope.audienceIds
        - audienceIds
```

Lowering rules:

- `pinned: true` (or `kind: dateRange`) lowers to a `staticFilters` entry
- `include:` / `exclude:` lower to filters in the `include` / `exclude`
  dynamic groups; direction filter ids default to `include<PredicateId>` /
  `exclude<PredicateId>` and param paths to `filters.<filterId>`
- predicates with neither direction lower into the dynamic group named by
  `bucket` (default `scope`)
- `group:` membership plus `predicateGroups` produce `dynamicFilterFamilies`
- `lookup`, `dialogId`, `targetingFeatureKey`, selectors and manual-entry
  fields pass through to the lowered filters, so declarative lookups and
  `hooks.resolveLookup` both keep working
- row predicates default to `multiple: true` + `emitArray: true`

Prefill: each predicate can declare where its initial value comes from in the
`windowForm.prefill` payload (dotted paths supported). A string is shorthand
for `{ path: ... }`, and every prefill key (`path`, `start`, `end`, `include`,
`exclude`) accepts either a single path or an ordered list of fallback paths —
the first path resolving a non-empty value wins (empty arrays fall through), so
one declaration can serve payload variants such as nested `scope.audienceIds`
vs top-level `audienceIds`. Declarative prefill is applied before the optional
`hooks.initializeState` handler, which receives the prefilled state and can
refine it. Prefill values may be scalars, arrays, or record objects (projected
through `valueSelector` / `labelSelector`), and replace any previous rows for
the same lowered filter.

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
