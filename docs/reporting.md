# Forge Reporting

This is the canonical guide for Forge reports, report-builder authoring, inline
reports, and legacy dashboard compatibility. It replaces the former report
builder, report primitive, dashboard, and Forecasting implementation-plan
documents.

Forge has one reporting runtime:

1. workspace metadata or inline content declares data sources and presentation
2. dashboard metadata, when used, is adapted to canonical report primitives
3. `ReportDocument` is lowered to `ReportSpec`
4. resolved datasets produce `ReportFill`
5. web, mobile, and PDF render from the same resolved content contract

This document covers:

- architecture and ownership boundaries
- report-builder configuration
- canonical report primitives
- inline and progressively assembled reports
- legacy dashboard conversion
- persistence, execution, export, and UI events
- cross-surface verification expectations

## Architecture And Ownership

Forge owns generic reporting behavior:

- report contracts and validation
- dataset-to-block resolution
- report-builder layout and interaction
- dashboard-to-report conversion
- web, iOS, Android, and PDF rendering
- generic host contracts for execution, persistence, export, and events

The host application owns runtime concerns:

- authentication and effective user identity
- data-source execution and authorization propagation
- database or file-backed report persistence
- artifact storage and downloadable URLs
- browser, mobile, and embedded-shell integration

The workspace owns domain metadata:

- registered data sources and human-readable labels
- presets and preset descriptions
- report families, windows, and workflow semantics
- field types, formats, icons, colors, and lookup behavior
- domain-specific filters, actions, copy, and policy

Forge and its hosts must not infer business meaning from field names or carry
workspace-specific branches. Invalid metadata produces diagnostics rather than
silent fallback behavior.

## Reporting Surfaces

### Report builder

`dashboard.reportBuilder` is the metadata-driven authoring surface. It uses the
same data-source fetch, dialog lookup, window form, chart, table, and report
runtime contracts as the rest of Forge.

Typical layout:

- measure and dimension selection
- chart/table result surface
- unified filter groups
- authored report blocks on a shared 12-column grid

Minimal configuration:

```yaml
kind: dashboard.reportBuilder
id: reportBuilder
title: Report Builder
dataSourceRef: delivery
reportBuilder:
  unifiedFamilyRows: true
  measures:
    - id: spend
      key: spend
      label: Spend
      format: currency
      default: true
      paramPath: measures.spend
  dimensions:
    - id: date
      key: date
      label: Date
      chartAxis: true
      default: true
      paramPath: dimensions.date
  result:
    chartCreationMode: explicit
    defaultMode: table
    viewModes: [table, chart]
    pageSize: 50
  request:
    autoFetch: true
    timeoutMs: 300000
```

Builder selections persist under `windowForm`. Requests are shaped from
explicit metadata paths; transcript text and field-name heuristics are not
request inputs.

### Unified predicates

Use `predicates` with optional `predicateGroups` to declare filters once.
Forge lowers them to the static and dynamic filter structures used by request
mapping, lookup hydration, persistence, and the live filter UI.

```yaml
reportBuilder:
  predicateGroups:
    - id: inventory
      label: Inventory

  predicates:
    - id: dateRange
      label: Date Range
      kind: dateRange
      required: true
      startParamPath: filters.from
      endParamPath: filters.to
      prefill:
        start: from
        end: to

    - id: publisher
      label: Publisher
      group: inventory
      dialogId: publisherPicker
      valueSelector: publisherId
      labelSelector: publisherName
      include:
        paramPath: filters.includePublisherId
      exclude:
        paramPath: filters.excludePublisherId
```

Lowering rules:

- `pinned: true` and date ranges become static filters
- include/exclude predicates become directional dynamic filters
- neutral predicates use the `scope` bucket unless another bucket is declared
- group membership produces unified filter families
- lookup, dialog, selector, manual-entry, and prefill metadata pass through
- explicit declarations with the same ids take precedence during migration

### Saved reports and presets

Presets are workspace-owned, read-only starters. Saved reports are user-owned
records persisted by the host and gated by effective authenticated user id.
Opening a preset materializes an editable report document; saving creates a
user report rather than mutating the preset.

All sources normalize to the same execution contract:

- `preset`
- saved `report`
- `inline`

Execution and export should accept a source kind plus source identity and
runtime filters instead of exposing separate preset-specific operations.

### Inline reports

Inline reports are one-off, progressively assembled reports. The compiler
supports two grammars:

- `report-document-v1`: canonical report primitives
- `dashboard-v1`: legacy dashboard blocks converted to report primitives

Inline datasets accept rows, JSON payloads, or CSV payloads. Materialized data
is already resolved, so its report does not require a Run action. A
`workspaceRef` declaration is resolved through the host `fetchDataset`
boundary and receives the current authorization context.

Canonical example:

```json
{
  "scope": "order-2680567",
  "id": "delivery-brief",
  "grammar": "report-document-v1",
  "status": "committed",
  "source": {
    "title": "Delivery Brief",
    "datasets": [
      {
        "id": "delivery",
        "kind": "workspaceRef",
        "dataSourceRef": "metrics_delivery",
        "request": { "orderId": 2680567 }
      }
    ],
    "blocks": [
      {
        "id": "deliveryTable",
        "kind": "tableBlock",
        "title": "Delivery",
        "datasetRef": "delivery",
        "columns": [
          { "key": "channel", "label": "Channel" },
          { "key": "spend", "label": "Spend", "format": "currency" }
        ]
      }
    ]
  }
}
```

Progressive assembly may add data sources and blocks over several fenced
fragments as long as they share a scope and report id. Only `committed` or
`ready` definitions open in the builder. Static dataset ids use canonical
lowercase letters, numbers, and underscores.

Inline reports with only registered workspace references can be promoted to
saved reports. Reports containing materialized datasets must first map those
datasets to registered workspace data sources; persistence must not silently
turn ephemeral data into a reusable report definition.

## Core Model

The report builder uses a structured model first.

Authors select:

- a dataset
- fields from that dataset
- optional filters or refinement controls
- optional text templates layered on top of resolved data

This keeps:

- field validation
- dataset compatibility checks
- semantic/model-aware authoring
- export/runtime consistency

Text templates are a presentation layer over already-resolved content, not the
source of truth for data selection.

## Dashboard conversion

Dashboard conversion lowers dashboard metadata to the primitives in this
document before runtime rendering. No dashboard-only visual block is embedded
inside a ReportDocument. This guarantees that adapted reports use the same
resolved content model on web, iOS, Android, and PDF.

The adapter also returns conversion metadata alongside the authored blocks:

- `dataSourceRefs`: live workspace sources required by the report
- `datasetFieldHints`: inferred dimension and measure roles for static imports
- `filterDefinitions`: dashboard-authored filter control definitions
- `interactionBindings`: filter, selection, visibility, and action provenance
- `diagnostics`: structured conversion errors for unknown or rejected content

Each adapted block also carries a normalized `runtime` contract. Forge applies
its `filterBindings`, `selectionBindings`, and `visibleWhen` generically on web,
iOS, Android, and while resolving export content. A `dashboardSelect` action
becomes a generic `select` action; any other workspace-authored handler becomes
a `host` action dispatched through the host runtime. These contracts preserve
the source dashboard behavior without making Forge own workspace datasource
configuration, handler implementations, or persistence.

## Report Persistence Boundary

Forge does not own database or workspace bootstrapping.

Forge's responsibility is:

- authored report contracts
- runtime rendering
- export artifacts
- host service contracts for save, list, lifecycle, and export actions

Host/runtime responsibility is:

- choosing whether persistence is file-backed, SQL-backed, or another store
- resolving environment variables, secrets, and workspace defaults
- instantiating report storage only at the host runtime boundary

In the current Agently integration, that persistence wiring belongs in
`agently-core`, not in Forge. Forge should only consume the already-resolved
host services or backend contracts it is given.

## Layout Model

Report document layout uses a shared internal `12`-column grid.

That grid is the source of truth for:

- web authoring layout
- runtime report layout
- PDF print layout
- responsive/mobile reflow decisions

Current friendly width presets:

- `Full` = `12/12`
- `Two-thirds` = `8/12`
- `Half` = `6/12`
- `Third` = `4/12`
- `Quarter` = `3/12`

Older authored payloads that still use legacy `size: "half"` remain valid and
are normalized onto the same span model.

## Theme Tokens

The report builder now supports a constrained document theme model rather than
raw CSS.

Current supported document theme fields:

- `theme.accentTone`
- `theme.badgePalette`

Supported `accentTone` values:

- `blue`
- `green`
- `amber`
- `rose`
- `slate`

Supported `badgePalette` values:

- `soft`
- `bold`

Current usage:

- runtime KPI accent bars
- default/info callout + info-panel accents
- runtime status/badge pill styling
- print/export tone pill styling

Theme tokens are intentionally small and opinionated:

- they are metadata, not arbitrary CSS
- they preserve safe defaults when omitted
- they can influence runtime and PDF together from the same report contract

## Primitive Kinds

Current authored report block kinds:

- `markdownBlock`
- `filterBarBlock`
- `refinementBarBlock`
- `kpiBlock`
- `badgesBlock`
- `chartBlock`
- `tableBlock`
- `geoMapBlock`
- `sectionBlock`
- `tabGroupBlock`
- `compositeBlock`
- `stepperBlock`
- `infoPanelBlock`
- `calloutBlock`
- `kanbanBlock`
- `timelineBlock`
- `collectionBlock`

## `markdownBlock`

Purpose:

- reader-facing narrative
- summary, context, caveats, next steps

Authoring fields:

- `title`
- `markdown`
- optional `datasetRef`

Runtime behavior:

- markdown is resolved into `content.markdown`
- macros can reference runtime data
- runtime and PDF print consume the resolved markdown, not the raw template

Supported macro style:

- absolute dataset macros like `${primary.avails}`
- dataset-source macros like `${forecasting_cube_report.avails}`
- relative row macros like `${row.channelV2}` when a dataset is bound
- formatter helpers like `${fmt.compact(primary.avails)}`

## `filterBarBlock`

Purpose:

- place and curate the report filter surface inside the authored report

Authoring fields:

- `title`
- `paramIds`
- optional `datasetRef`
- optional `mode`
- optional `placement`
- optional `groupOrder`
- optional `visibleGroups`
- optional `collapsedGroups`

Supported `mode` values:

- `baseline`
- `unified`

Supported `placement` values:

- `inherit`
- `inline`
- `rail-left`
- `hidden`

### Filter Bar Ownership

`filterBarBlock` is no longer the source of truth for which filters exist in the
workspace.

Instead:

- workspace metadata defines available static filters and unified filter families
- `filterBarBlock` controls how that surface is presented in the authored report

That means the block acts as a placement/presentation primitive, not a legacy
filter inventory picker.

### Filter Group Semantics

`visibleGroups`

- controls which groups are shown
- can include both baseline scope params like `dateRange` and unified family ids
  like `inventory`, `location`, or `data`

`groupOrder`

- controls display order in the live surface
- also controls emitted ordering in `reportFill` / `reportPrint`

`collapsedGroups`

- controls which groups start collapsed in the interactive runtime surface
- does not remove them from export; it only affects initial interactive state

`paramIds`

- retained for backward compatibility
- derived from visible baseline/static groups where possible
- older authored documents that only carry `paramIds` still remain valid

Runtime behavior:

- `content.params` contains bound scope/static filter values
- `content.criteria` contains active unified targeting/include/exclude rows when
  unified filter mode is enabled by workspace metadata

Export behavior:

- PDF prints both `params` and unified `criteria`

## `refinementBarBlock`

Purpose:

- show live keep/exclude/drill refinements layered over baseline filters

Authoring fields:

- `title`
- `actionKinds`
- `emptyLabel`

Runtime behavior:

- `content.refinements` is resolved from current runtime refinement state

## `kpiBlock`

Purpose:

- show one resolved row as a card, a markdown body, or both

Authoring fields:

- `title`
- `datasetRef`
- `valueField`
- `valueLabel`
- optional `valueFormat`
- optional `secondaryField`
- optional `secondaryLabel`
- optional `secondaryFormat`
- optional `secondaryDisplayKey`
- optional `secondaryDisplayValueMap`
- optional `description`
- optional `tone`
- optional `emptyLabel`
- optional `rowSelector`
- optional `presentationMode`
- optional `bodyFormat`
- optional `bodyTemplate`

Supported KPI and collection value formats:

- `number`: locale-aware full value with standard digit grouping and up to five fractional digits
- `number5`: locale-aware full value with standard digit grouping and exactly five fractional digits
- `compact` or `compactNumber`: abbreviated magnitude such as `126.3B`
- `currency`
- `percent`
- `percentFraction`

### KPI Resolution

KPI data is resolved structurally first:

1. pick the assigned dataset
2. choose the row using `rowSelector`
3. resolve `valueField` and `secondaryField`
4. build resolved content
5. optionally render a markdown body from that resolved content

Supported `rowSelector` values:

- `firstrow`
- `maxbyvalue`
- `minbyvalue`

Supported `presentationMode` values:

- `card`
- `body`
- `both`

Supported `bodyFormat` values:

- `markdown`

### KPI Macro Context

Relative macros:

- `${value}`
- `${valueLabel}`
- `${secondaryValue}`
- `${secondaryLabel}`
- `${row.fieldName}`
- `${dataset.id}`
- `${dataset.label}`
- `${dataset.dataSourceRef}`

Absolute dataset macros:

- `${primary.avails}`
- `${ForecastingSnapshot.avails}`
- `${forecasting_cube_report.avails}`
- `${primary.row.channelV2}`

Dataset alias matching is case-tolerant for common authored forms and also
accepts friendly aliases derived from dataset ids / datasource refs such as
`ForecastingCubeReport`.

Formatter helpers:

- `${fmt.compact(row.avails)}`
- `${fmt.compactNumber(primary.avails)}`
- `${fmt.currency(row.ecpm)}`
- `${fmt.percent(row.winRate)}`
- `${fmt.percentFraction(row.winRate)}`
- `${fmt.number(row.impressions)}`

Legacy formatter helper retained:

- `${format(row.avails,compactNumber)}`

### KPI Rendering Modes

`card`

- big value
- optional secondary label/value row
- no markdown body

`body`

- markdown body only
- if no body content resolves, runtime/print fall back to a simple value line

`both`

- card first
- markdown body below it

## `badgesBlock`

Purpose:

- compact pill-style status/readout group

Authoring fields:

- `title`
- `datasetRef`
- `items[]`

Each item can bind:

- `label`
- `valueField`
- optional `displayKey`
- optional `displayValueMap`
- optional `format`
- optional `tone`

## `sectionBlock`

Purpose:

- start a named authored report section
- establish a visible navigation anchor for a later tab group

Authoring fields:

- `title`
- optional `subtitle`
- optional `description`
- `navigationLabel`

Runtime behavior:

- sections split the authored runtime into named views
- if no explicit tab group exists, multiple sections still produce section tabs

## `tabGroupBlock`

Purpose:

- explicitly control section-tab navigation order and default section

Authoring fields:

- `title`
- `sectionIds[]`
- optional `defaultSectionId`

Runtime behavior:

- tabs are metadata-driven over existing `sectionBlock`s
- the block is presentation/navigation only; it does not own child content
- print/export flattens sections in authored order and does not render a tab UI

## `compositeBlock`

Purpose:

- group existing authored blocks into one titled panel

Authoring fields:

- `title`
- optional `description`
- `childBlockIds[]`

Runtime behavior:

- child blocks render inside the grouped panel once
- grouped child blocks are suppressed from the top-level document flow
- print/export lowers the grouped children inside the composite panel in order

## `collectionBlock`

Purpose:

- repeated card/list presentation from dataset rows

Authoring fields:

- `title`
- `datasetRef`
- `itemTitleField`
- optional `itemTitleLabel`
- optional `valueField`
- optional `valueLabel`
- optional `valueFormat`
- optional `secondaryField`
- optional `secondaryLabel`
- optional `secondaryFormat`
- optional `description`
- optional `emptyLabel`
- `layout`
- `columns`
- `rowLimit`
- optional `bodyTemplate`

Runtime behavior:

- resolves rows in order from the assigned dataset
- supports markdown body templates per repeated item
- export preserves item order and resolved text

## `chartBlock`

Purpose:

- resolved visualization from a selected dataset

Authoring fields:

- `title`
- `datasetRef`
- `chartSpec`
- `chartModel`

Current chart authoring coverage includes:

- grouped and direct cartesian series
- category pie/donut series
- per-series render type overrides
- per-series axis assignment
- per-series stack groups
- per-series data label rules via `dataLabels`
- per-series conditional point/bar colors via `pointColorMode`
- canonical chart annotations

Supported per-series options in `chartSpec.seriesOptions`:

- `type`
- `axis`
- `stackId`
- `dataLabels`
- `pointColorMode`

Supported `dataLabels` values:

- `auto`
- `always`
- `none`

Supported `pointColorMode` values:

- `series`
- `bySign`

Runtime behavior:

- `content.resolvedChart` is deterministic chart payload for runtime/print/export

## `tableBlock`

Purpose:

- resolved grid/table from a selected dataset

Authoring fields:

- `title`
- `datasetRef`
- `columns[]`

Runtime behavior:

- `content.resolvedRows` contains resolved cells
- optional cell visuals include:
  - badges
  - tone
  - data bars
  - progress bars
  - stacked share bars
  - delta chips
  - rank chips
  - spark bars

### Table Visual Kinds

Current authored `cellVisual.kind` values:

- `dataBar`
- `progressBar`
- `shareBar`
- `delta`
- `rank`
- `badge`
- `tone`

`dataBar`

- full-width in-cell quantitative bar
- uses `valueField`
- supports `range`
- supports `palette`

`progressBar`

- compact horizontal progress treatment
- uses `valueField`
- supports `range`
- supports `palette`

`shareBar`

- stacked share treatment across multiple measure fields
- uses `segments[]`
- each segment supports `valueField`, optional `label`, optional `color`

`delta`

- signed change chip for a single measure
- uses `valueField`
- optional `positiveIsGood: false`

`rank`

- dense-rank chip for a single numeric measure
- uses `valueField`

`badge` / `tone`

- rule-driven pill styles for categorical values
- support optional authored `label`
- support optional authored `tone`
- support optional authored `color` / `background`

### Table Visual State

Resolved runtime/export state uses one canonical `visualState` model:

- bar-family visuals resolve numeric `value`, `percent`, and `palette`
- share bars resolve `segments[]`
- pill-family visuals resolve `tone`, `label`, and optional explicit colors

That same resolved state is used by:

- hosted runtime
- authored runtime preview
- PDF print lowering

## `geoMapBlock`

Purpose:

- resolved geographic summary from a selected dataset

Authoring fields:

- `title`
- `datasetRef`
- `geo`

Runtime behavior:

- `content.resolvedGeo` drives runtime and export rendering

## `stepperBlock`

Purpose:

- ordered process, journey, or explainer steps

Authoring fields:

- `title`
- optional `description`
- `steps[]`

Each step supports:

- `title`
- `body`
- optional `tone`

## `infoPanelBlock`

Purpose:

- framed explainer panel with optional eyebrow and tone

Authoring fields:

- `title`
- optional `eyebrow`
- optional `description`
- optional `tone`
- `body`

## `calloutBlock`

Purpose:

- business callout / alert / launch update with a stronger visual frame

Authoring fields:

- `title`
- optional `icon`
- optional `description`
- optional `tone`
- optional `badges[]`
- `body`

## `kanbanBlock`

Purpose:

- pipeline / stage board for authored business workflow summaries

Authoring fields:

- `title`
- optional `description`
- `columns[]`

Each column supports:

- `title`
- optional `tone`
- `cards[]`

Each card supports:

- `title`
- optional `body`
- optional `badge`
- optional `tone`

## `timelineBlock`

Purpose:

- milestone / event timeline

Authoring fields:

- `title`
- optional `description`
- `events[]`

Each event supports:

- `date`
- `title`
- optional `body`
- optional `badge`
- optional `tone`

## Unified Filters

Workspace metadata can enable a unified report-surface filter mode via:

- `reportSurfaceFilterMode: unified`

When enabled:

- web runtime shows active metadata-defined targeting/filter rows on the report
  surface
- `reportFill.filterBarBlock.content.criteria` carries those same resolved rows
- `reportPrint` includes them in PDF output

This keeps the same visible criteria model across:

- authored runtime preview
- hosted report runtime
- exported PDF

## Request Mapping

The request compiler follows authored param paths directly.

Current behavior:

- static filters write to the configured `startParamPath`, `endParamPath`, or
  `paramPath`
- dynamic filter groups write to each filter's configured `paramPath`
- measure and dimension selections write to their configured `paramPath`
  values when present, otherwise to canonical `measures.*` / `dimensions.*`
  locations

Important constraint:

- the builder does **not** synthesize extra snake_case, camelCase, or lowercase
  alias keys just because a related path exists elsewhere

That means request shape should be treated as metadata-driven:

- if a workspace needs `filters.order_id`, configure that exact `paramPath`
- if a workspace needs `filters.orderIds`, configure that exact `paramPath`
- if both are genuinely required, author both explicitly in workspace metadata

This avoids fallback alias behavior leaking into the canonical report-builder
request contract.

## Dataset Scope And Relative Windows

Published datasets can reuse one datasource with independent local scope. The
supported modes are `inherit`, `append`, `override`, and `exclude`. An
`override` still carries inherited entity and categorical values, then replaces
the configured local request paths.

Use `relativeDateRange` for reusable calendar windows:

```yaml
scope:
  mode: override
  relativeDateRange:
    preset: yesterday
    startParamPath: filters.From
    endParamPath: filters.To
```

Supported presets are `today`, `yesterday`, `last3Days`, `last7Days`, and
`last30Days` (plus `3d`, `7d`, and `30d` aliases). Dates are resolved when the
report request is compiled, so saved presets do not contain stale calendar
dates. The explicit paths keep request casing and backend contracts entirely
metadata-driven.

For broader semantic time expressions, use `startExpression` and
`endExpression` instead of `preset`:

```yaml
relativeDateRange:
  startExpression: 6 days ago in UTC
  endExpression: today in UTC
  startParamPath: filters.From
  endParamPath: filters.To
```

Narrative and KPI markdown also support dynamic time macros:

- `${time.today}`
- `${time.yesterday}`
- `${time.last7Days.start}` / `${time.last7Days.end}`
- `${timeAt("2 days ago in UTC")}`
- `${timeAt("50 hours ahead", "dateTime")}`

## Markdown Rendering

Runtime markdown rendering is intentionally lightweight.

Supported behavior:

- headings
- paragraphs
- simple list handling
- block quotes
- inline emphasis for common authoring patterns

PDF export lowers markdown to plain text for deterministic print output.

## Macro Resolution Notes

Macros are a presentation layer, not a query-definition layer.

Current behavior:

- unresolved macros collapse to an empty string
- missing values render as `—` when they flow through value formatting helpers
- body-only KPI blocks without resolved body content fall back to a simple
  value line in runtime and print/export

Authoring guidance:

- prefer formatter helpers for user-visible numeric output
- prefer dataset-qualified macros in narrative blocks when multiple datasets
  are in play

## PDF Text Safety

The PDF renderer uses core PDF fonts such as Helvetica. Those fonts do not
reliably support all Unicode punctuation.

Before export, unsupported punctuation is normalized to ASCII-safe text, for
example:

- `·` -> ` - `
- smart quotes -> plain quotes
- en/em dashes -> `-`

This avoids mojibake such as `Â·` in exported PDFs.

## Recommended Authoring Guidance

Prefer:

- structured field binding for data selection
- markdown templates for reader-facing presentation
- formatter helpers for user-visible numeric output

Avoid:

- making raw macros the primary data-selection mechanism
- embedding HTML as the primary body format

The intended hybrid model is:

1. resolve dataset + row + fields structurally
2. produce a resolved content object
3. render card, body, or both from that resolved content

## Legacy Dashboard Compatibility

The dashboard grammar remains supported for existing metadata and inline
content, but it is not a second report runtime. Use
`adaptDashboardToReportDocument()` to convert dashboard metadata into the
canonical primitives above.

The adapter accepts:

- `dashboard.summary`
- `dashboard.kpiTable`
- `dashboard.compare`
- `dashboard.timeline`
- `dashboard.composition`
- `dashboard.dimensions`
- `dashboard.geoMap`
- `dashboard.status`
- `dashboard.filters`
- `dashboard.feed`
- `dashboard.table`
- `dashboard.report`
- `dashboard.detail`, including recursive children
- `dashboard.messages`
- `dashboard.badges`

Conversion preserves source order, 12-column layout, data-source references,
field-role hints, filter definitions, interactions, visibility conditions, and
nested groups. Unknown kinds produce structured diagnostics and are never
silently discarded.

Legacy dashboard UI commands remain available for compatibility:

- discovery: `ui.dashboard.capabilities`, `ui.dashboard.listDemos`,
  `ui.dashboard.getDemo`
- opening and export: `ui.dashboard.openDemo`, `ui.dashboard.exportHtml`,
  `ui.dashboard.exportFromContainer`, `ui.dashboard.exportWindow`
- state: `ui.dashboard.filter.set`, `ui.dashboard.filter.clear`,
  `ui.dashboard.selection.set`, `ui.dashboard.selection.clear`,
  `ui.dashboard.state.get`, `ui.dashboard.state.reset`
- demo artifacts: `ui.dashboard.listDemoArtifacts`,
  `ui.dashboard.generateDemoArtifacts`

New work should prefer `report-document-v1`. Use `dashboard-v1` when importing
or progressively replacing existing dashboard metadata.

## Execution, Export, And Events

Execution resolves registered workspace data sources with explicit runtime
filters and produces `ReportFill`. Materialized inline data skips execution
because its fill is already present.

PDF export uses `ReportSpec`, `ReportFill`, and `ReportPrint` together. The
backend request kind is `reportExportRequest`; the source contract identifies
the originating preset, saved payload, saved view, published snapshot, or
inline artifact. A successful export returns an artifact identity and a
downloadable target whose filename and content type match the exported format.

Interactive controls are runtime-only unless their state affects report
content. PDF renders tab contents as report sections rather than printing the
tab selector itself. Charts, table visuals, themes, severity colors, number
formats, and resolved filter values must be derived from the same report
content model on screen and in export.

Forge emits report lifecycle events through
`builderContext.handlers.reportEvents.emit`:

- `report.run_start` when an executable report run begins
- `report.run` after the current run succeeds
- `report.export_start` before the export request is submitted
- `report.export_complete` after export succeeds with an artifact id

The event envelope includes `windowId`, `windowKey`, and `conversationId`.
Event detail includes the report name/id, normalized source kind
(`preset`, `report`, or `inline`), effective filters and refinements, and the
run/export identifiers available at that stage. Successful run events include
`runId`, status, and row count. Successful export events include `jobId`,
`artifactId`, format, and target URL when the host artifact service provides
one.

Materialized inline reports do not emit run events because no execution is
needed, but their exports use the same export lifecycle with
`sourceKind: "inline"`.

Event delivery is best-effort: a missing or failing event handler never blocks
report execution or export. The host owns event timestamps, storage, querying,
and authorization. Forge owns the generic event shape and emission points;
workspace metadata may add domain context without introducing domain-specific
Forge logic.

## Verification

Changes to reporting should be verified at the narrowest relevant layers:

- model and validation tests for authored blocks, filters, and request mapping
- runtime tests for dataset resolution, macros, tables, charts, and actions
- adapter tests covering every accepted dashboard kind
- inline compiler tests for JSON, CSV, workspace references, and promotion
- PDF tests for every primitive, formatting, page layout, and visual parity
- browser checks for authoring, drag/drop, execution, import/export, and file
  download
- iOS and Android checks for primitive support, responsive reflow, and native
  tab behavior
- host integration checks for authenticated data access, user-scoped saved
  reports, artifact download, and event propagation

For workspace-specific report families, run the same critical scenarios in the
development UI and the embedded host. A development-only render is not
sufficient evidence of integration parity.
