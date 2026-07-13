# Report Builder Primitives

This document describes the authoring and runtime primitives used by
`dashboard.reportBuilder`.

It focuses on:

- the authored block kinds available in report documents
- how those blocks resolve against datasets at runtime
- the current macro/template surface
- how web runtime and exported PDF stay aligned

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

## `chartBlock`

Purpose:

- resolved visualization from a selected dataset

Authoring fields:

- `title`
- `datasetRef`
- `chartSpec`
- `chartModel`

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

## `geoMapBlock`

Purpose:

- resolved geographic summary from a selected dataset

Authoring fields:

- `title`
- `datasetRef`
- `geo`

Runtime behavior:

- `content.resolvedGeo` drives runtime and export rendering

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
