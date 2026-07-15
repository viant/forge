# Forge Dashboard Components

## Goal

Add a **simple, data-driven dashboard vocabulary** to Forge that:

- reuses the current `Container` model instead of introducing a separate page system
- fits the existing layout engine already implemented in Forge
- keeps charts simple, chart-first, and optionally switchable to table view
- supports common analytical blocks such as timeline, dimensions, messages, status, and summary
- can be rendered as a normal Forge screen and also exported as a **downloadable standalone HTML**

This document uses a performance-analytics dashboard as an example use case, but the proposed design is generic and should not encode any dataset-specific logic into the component model.

## Current Status

The core dashboard implementation now exists in Forge.

Implemented:

- backend model support in [model.go](/Users/awitas/go/src/github.com/viant/forge/backend/types/model.go)
- dashboard block rendering in [DashboardBlocks.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/DashboardBlocks.jsx)
- container/grid integration in [Container.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/Container.jsx) and [GridLayoutRenderer.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/GridLayoutRenderer.jsx)
- dashboard-scoped signals in [signals.js](/Users/awitas/go/src/github.com/viant/forge/src/core/store/signals.js)
- standalone HTML export in [dashboardExport.js](/Users/awitas/go/src/github.com/viant/forge/src/core/ui/dashboardExport.js)
- dashboard command support in [commands.js](/Users/awitas/go/src/github.com/viant/forge/src/core/ui/commands.js)
- window handlers in [window.js](/Users/awitas/go/src/github.com/viant/forge/src/hooks/window.js)
- seeded demo variants in [dashboardDemo.js](/Users/awitas/go/src/github.com/viant/forge/src/core/ui/dashboardDemo.js)

Implemented block kinds:

- `dashboard.summary`
- `dashboard.compare`
- `dashboard.kpiTable`
- `dashboard.filters`
- `dashboard.timeline`
- `dashboard.dimensions`
- `dashboard.messages`
- `dashboard.status`
- `dashboard.feed`
- `dashboard.report`
- `dashboard.detail`

What remains future-facing in this document:

- richer block types beyond the current set
- browser-level UI-flow tests
- deeper export parity for every runtime nuance
- optional server-driven filter/refetch behavior beyond the current client-side filtering model


## Implemented Command Surface

Forge now exposes a small dashboard-specific command layer so automation, metadata handlers, and toolbar actions can drive dashboard state without depending on a particular rendered block.

Implemented `runUICommand(...)` methods in [commands.js](/Users/awitas/go/src/github.com/viant/forge/src/core/ui/commands.js):

- `ui.dashboard.listDemos`
- `ui.dashboard.getDemo`
- `ui.dashboard.capabilities`
- `ui.dashboard.listDemoArtifacts`
- `ui.dashboard.generateDemoArtifacts`
- `ui.dashboard.exportHtml`
- `ui.dashboard.exportFromContainer`
- `ui.dashboard.exportWindow`
- `ui.dashboard.openDemo`
- `ui.dashboard.filter.set`
- `ui.dashboard.filter.clear`
- `ui.dashboard.selection.set`
- `ui.dashboard.selection.clear`
- `ui.dashboard.state.get`
- `ui.dashboard.state.reset`

Example:

```js
await runUICommand({
  method: 'ui.dashboard.openDemo',
  params: {
    variant: 'operations', // or omit for the default 'performance' demo
  },
});

await runUICommand({
  method: 'ui.dashboard.filter.set',
  params: {
    windowId: 'W1',
    dashboardId: 'demoDashboard',
    patch: { dateRange: '30d', region: ['EMEA'] },
  },
});

await runUICommand({
  method: 'ui.dashboard.selection.set',
  params: {
    windowId: 'W1',
    dashboardId: 'demoDashboard',
    dimension: 'country',
    entityKey: 'GB',
    selected: { country: 'GB', region: 'EMEA' },
    sourceBlockId: 'byCountry',
  },
});
```

Current demo variants:

- `performance` — marketing/performance dashboard with country drilldown
- `operations` — service health and incident dashboard
- `quality` — data quality dashboard with checks, issue distributions, and remediation notes

You can discover the available variants programmatically with `ui.dashboard.listDemos`.
You can fetch a variant's metadata and seed bundle without opening a window via `ui.dashboard.getDemo`.
You can inspect the currently supported block kinds, chart types, dashboard commands, and demo variants via `ui.dashboard.capabilities`.
You can list the downloadable built-in artifact set via `ui.dashboard.listDemoArtifacts`.
You can generate self-contained HTML strings for one or more demo variants via `ui.dashboard.generateDemoArtifacts`.
You can generate standalone downloadable HTML files for all demo variants with `npm run generate:dashboard-demos`.
Generated files are written to [docs/dashboard-demos](/Users/awitas/go/src/github.com/viant/forge/docs/dashboard-demos), with a simple gallery at [docs/dashboard-demos/index.html](/Users/awitas/go/src/github.com/viant/forge/docs/dashboard-demos/index.html).
You can run an optional browser smoke pass with `npm run smoke:dashboard-demos`. That serves the generated demo exports locally and writes screenshots plus a manifest to [output/playwright/dashboard-demos](/Users/awitas/go/src/github.com/viant/forge/output/playwright/dashboard-demos).
If a dashboard context or container provides `locale`, number and currency formatting will use it, and standalone exports will emit that locale in the root HTML `lang` attribute.

Matching window handlers exist in [window.js](/Users/awitas/go/src/github.com/viant/forge/src/hooks/window.js):

- `window.exportDashboard`
- `window.setDashboardFilter`
- `window.clearDashboardFilters`
- `window.setDashboardSelection`
- `window.clearDashboardSelection`
- `window.resetDashboardState`
- `window.getDashboardState`

These handlers make it possible to declare toolbar actions in metadata without writing custom action code.

`ui.dashboard.state.get` returns the current dashboard key, active filters, current selection, title, and top-level block IDs. This is useful for automation and diagnostics.

`window.getDashboardState` returns the same shape for metadata-driven handler flows that operate inside the window runtime rather than through `runUICommand(...)`.

`ui.dashboard.state.reset` restores default filter values declared by `dashboard.filters` blocks and clears dashboard selection in one operation. The demo toolbar uses the matching `window.resetDashboardState` handler.


## Existing Constraints & Implementation Gaps

### 1. Forge is already data-driven

The implementation must stay inside the current Forge model:

- metadata declares containers, items, charts, tables, forms, and handlers
- `Container` decides what to render based on metadata
- layout is already defined by `container.layout`
- data flow already goes through `dataSourceRef`, handlers, signals, and window/context state

The dashboard work should therefore add **dashboard block semantics**, not a new rendering framework.


### 2. Layout already exists and should be reused

Forge already supports:

- legacy item grid through `layout.columns`
- auto-placement grid with `layout.kind: "grid"`
- nested containers
- split containers with `layout.kind: "split"`

Relevant implementation:

- [Container.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/Container.jsx)
- [GridLayoutRenderer.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/GridLayoutRenderer.jsx)
- [docs/grid-layout.md](/Users/awitas/go/src/github.com/viant/forge/docs/grid-layout.md)

This means dashboards should be modeled as:

- a top-level container with `layout.kind: "grid"`
- nested containers representing dashboard blocks
- each block using `columnSpan` and `rowSpan`
- optional internal nested layout inside each block

Do not introduce separate dashboard coordinates or a second layout grammar.


### 3. Chart interaction should stay simple

The target UX should follow the simpler pattern already visible in:

- [RichContent.jsx](/Users/awitas/go/src/github.com/viant/agently/ui/src/components/chat/RichContent.jsx)
- [chartSpec.ts](/Users/awitas/go/src/github.com/viant/agently-core/sdk/ts/src/richContent/chartSpec.ts)

That pattern is:

- chart first
- small `Chart` / `Table` toggle
- one simple normalized chart model
- limited chart types
- no heavy dashboard builder UX

Forge already has a similar pattern in:

- [Chart.jsx](/Users/awitas/go/src/github.com/viant/forge/src/components/Chart.jsx)

The dashboard design should keep that simplicity.

Note: agently's `ChartSpecPanel` already renders line, area, bar, stacked_bar, scatter, and pie using Recharts. Forge's `Chart.jsx` currently only supports `LineChart`. See Option C in the Rendering Approach section for how to extract the additional Recharts chart-type rendering from agently without adopting its `ChartSpec` schema.


### 4. Original implementation gaps

The following gaps were identified before implementation. They are now addressed in the current codebase:

- `Container.kind` and `Container.role` now exist and are used by the dashboard dispatch path.

- `GridLayoutRenderer` now supports child containers in addition to items.

- `Container.columnSpan` and `Container.rowSpan` now exist in the Go model and are consumed by the grid renderer.

- `Layout.gap`, `Layout.rowGap`, and `Layout.columnGap` now exist in the Go model.

- `Chart.jsx` now supports `line`, `bar`, and `area`.


### 5. Go backend model

The Go model is defined in [backend/types/model.go](/Users/awitas/go/src/github.com/viant/forge/backend/types/model.go).

Current relevant structs:

```go
// Container (lines 325-353) - no Kind or Role field currently
type Container struct {
    ID, Title, DataSourceRef, Layout, Style, Toolbar, Table,
    Chart, Chat, Section, Card, Items, Containers,
    SchemaBasedForm, Tabs, Dialogs, Repeat, ...
}

// Layout (lines 164-172) - no Gap fields currently
type Layout struct {
    Kind, Orientation, Rows, Columns, LabelPosition, Labels, Divider
}

// Chart (lines 65-74) - already matches proposed chart config shape
type Chart struct {
    Type, XAxis, YAxis, CartesianGrid, Width, Height, Series, On
}

// Item (lines 551-575) - has ColumnSpan/RowSpan
type Item struct {
    ID, Type, ColumnSpan, RowSpan, Label, Value, Style, ...
}
```

Implemented Go model additions for dashboard support:

```go
// Add to Container struct
Kind        string `json:"kind,omitempty"`
Role        string `json:"role,omitempty"`
ColumnSpan  int    `json:"columnSpan,omitempty"`
RowSpan     int    `json:"rowSpan,omitempty"`

// Add to Layout struct
Gap       string `json:"gap,omitempty"`
RowGap    string `json:"rowGap,omitempty"`
ColumnGap string `json:"columnGap,omitempty"`

// New dashboard-specific types
type DashboardSummary struct {
    Metrics []DashboardMetric `json:"metrics,omitempty"`
}

type DashboardCompare struct {
    Items []DashboardCompareItem `json:"items,omitempty"`
}

type DashboardCompareItem struct {
    ID           string `json:"id,omitempty"`
    Label        string `json:"label,omitempty"`
    Current      string `json:"current,omitempty"`
    Previous     string `json:"previous,omitempty"`
    Format       string `json:"format,omitempty"`
    DeltaFormat  string `json:"deltaFormat,omitempty"`
    PositiveIsUp *bool  `json:"positiveIsUp,omitempty"`
    DeltaLabel   string `json:"deltaLabel,omitempty"`
}

type DashboardKPITable struct {
    Rows []DashboardKPIRow `json:"rows,omitempty"`
}

type DashboardKPIRow struct {
    ID          string `json:"id,omitempty"`
    Label       string `json:"label,omitempty"`
    Value       string `json:"value,omitempty"`
    Format      string `json:"format,omitempty"`
    Context     string `json:"context,omitempty"`
    ContextTone string `json:"contextTone,omitempty"`
}

type DashboardFilters struct {
    Items []DashboardFilterItem `json:"items,omitempty"`
}

type DashboardFilterItem struct {
    ID       string                  `json:"id,omitempty"`
    Label    string                  `json:"label,omitempty"`
    Field    string                  `json:"field,omitempty"`
    Multiple bool                    `json:"multiple,omitempty"`
    Options  []DashboardFilterOption `json:"options,omitempty"`
}

type DashboardFilterOption struct {
    Label   string `json:"label,omitempty"`
    Value   string `json:"value,omitempty"`
    Default bool   `json:"default,omitempty"`
}

type DashboardMetric struct {
    ID       string `json:"id,omitempty"`
    Label    string `json:"label,omitempty"`
    Selector string `json:"selector,omitempty"`
    Format   string `json:"format,omitempty"`
}

type DashboardMessage struct {
    Severity    string              `json:"severity,omitempty"`
    Title       string              `json:"title,omitempty"`
    Body        string              `json:"body,omitempty"`
    VisibleWhen *DashboardCondition `json:"visibleWhen,omitempty"`
}

type DashboardStatusCheck struct {
    ID       string              `json:"id,omitempty"`
    Label    string              `json:"label,omitempty"`
    Selector string              `json:"selector,omitempty"`
    Format   string              `json:"format,omitempty"`
    Tone     *StatusTone         `json:"tone,omitempty"`
}

type StatusTone struct {
    WarningAbove float64 `json:"warningAbove,omitempty"`
    DangerAbove  float64 `json:"dangerAbove,omitempty"`
}

// DashboardCondition extends the existing SelectorCondition (model.go:456)
// with numeric comparison and emptiness operators needed by dashboard blocks.
//
// Existing SelectorCondition has: DataSourceRef, Selector, When (equality/list match).
// DashboardCondition adds:
//   - Gt/Gte/Lt/Lte for numeric thresholds (e.g. "show warning when zero_spend_rate > 40")
//   - NotEmpty for presence checks (e.g. "show detail block when selection exists")
//
// At runtime, the evaluator resolves `Selector` against the current data context,
// then applies the first non-nil operator. If multiple operators are set, all must pass (AND).
type DashboardCondition struct {
    DataSourceRef string  `json:"dataSourceRef,omitempty"` // optional: read from different data source
    Selector      string  `json:"selector,omitempty"`      // dot-path into data (e.g. "quality.zero_spend_rate")
    When          any     `json:"when,omitempty"`           // equality match (inherited from SelectorCondition)
    Gt            *float64 `json:"gt,omitempty"`            // value > threshold
    Gte           *float64 `json:"gte,omitempty"`           // value >= threshold
    Lt            *float64 `json:"lt,omitempty"`            // value < threshold
    Lte           *float64 `json:"lte,omitempty"`           // value <= threshold
    NotEmpty      *bool    `json:"notEmpty,omitempty"`      // true if value is non-nil and non-zero-value
}
```


## Design Principles

### 1. Dashboard is a container role, not a separate app type

The dashboard should be represented as a normal Forge container, for example:

```yaml
id: perfDashboard
role: dashboard
layout:
  kind: grid
  columns: 12
  gap: 16
containers: [...]
```

`role: dashboard` is semantic only. Rendering still goes through the existing `Container` system.

Note: `role` is a new field that must be added to both the Go `Container` struct and the frontend container model. See section 4 (Implementation gaps) and section 5 (Go backend model) above.


### 2. Blocks are nested containers

Each dashboard section is a nested container with a specialized block kind:

- `dashboard.summary`
- `dashboard.timeline`
- `dashboard.dimensions`
- `dashboard.messages`
- `dashboard.status`
- `dashboard.feed`
- `dashboard.detail`

Each block:

- participates in the parent grid through `columnSpan` and `rowSpan`
- may have its own nested `layout`
- may reuse existing Forge chart/table/item rendering under the hood

The implemented dashboard block vocabulary currently includes:

- `dashboard.summary`
- `dashboard.compare`
- `dashboard.kpiTable`
- `dashboard.filters`
- `dashboard.timeline`
- `dashboard.dimensions`
- `dashboard.messages`
- `dashboard.status`
- `dashboard.feed`
- `dashboard.report`
- `dashboard.detail`


### 3. Layout and state remain separate

Layout answers:

- where does the block go
- how wide/tall is it
- how are children arranged inside it

Dashboard state answers:

- which time range is selected
- which dimension item is selected
- what filters are active
- which message or feed entry is focused

Do not encode filter logic into layout metadata.


### 4. Prefer a small generic vocabulary

The first version should solve 80% of dashboard needs with a few simple blocks.

Do not start with:

- pivot designer
- arbitrary drag-and-drop dashboard builder
- complex chart composition
- explicit row/column coordinates
- dozens of chart types


## Proposed Dashboard Model

### Top-Level Dashboard Container

Example:

```yaml
id: performanceDashboard
role: dashboard
dataSourceRef: perf
layout:
  kind: grid
  columns: 12
  gap: 16
containers:
  - id: headline
    kind: dashboard.summary
    columnSpan: 12

  - id: trend
    kind: dashboard.timeline
    columnSpan: 8
    rowSpan: 2

  - id: notices
    kind: dashboard.messages
    columnSpan: 4
    rowSpan: 2

  - id: byCountry
    kind: dashboard.dimensions
    columnSpan: 6

  - id: byChannel
    kind: dashboard.dimensions
    columnSpan: 6

  - id: health
    kind: dashboard.status
    columnSpan: 4

  - id: detail
    kind: dashboard.detail
    columnSpan: 8

  - id: audit
    kind: dashboard.feed
    columnSpan: 12
```


### Dashboard State Model

Dashboard state must be implemented using Forge's existing primitives, not a new state store. There are two viable mechanisms:

**Why `container.state` does not work for dashboards:**

`Container.jsx` (line 29) treats `container.state` as a local `useState()` tuple. However, when Container recursively renders child containers (lines 317-324, 346-362), it passes only `context` and `container` -- the parent `state` tuple is never forwarded. That means nested dashboard blocks have no access to the parent dashboard's state through this mechanism. Adding state propagation to the recursive container path would be a significant change to the core rendering loop and is out of scope for v1.

**Dedicated dashboard signals (recommended)**

Add a small set of dashboard-scoped signals following the existing pattern in `signals.js`:

```js
// src/core/store/signals.js -- new additions
export const dashboardFilterSignals = signal({});    // keyed by composite key
export const dashboardSelectionSignals = signal({}); // keyed by composite key
```

#### Signal key format and uniqueness

Dashboard signals are keyed by `{windowId}:{containerId}`, not by `containerId` alone. This avoids collisions when the same dashboard definition is opened in multiple windows:

```js
// Key construction
const dashboardKey = `${windowId}:${container.id}`;
```

#### Registration (mount)

The dashboard container's root component registers signals in a `useEffect` at mount. Registration creates new signal entries only if none exist for this key:

```js
// In the dashboard container root (e.g. DashboardBlock or the Container.jsx dispatch)
useEffect(() => {
  const key = `${windowId}:${container.id}`;

  if (!dashboardFilterSignals.value[key]) {
    dashboardFilterSignals.value = {
      ...dashboardFilterSignals.peek(),
      [key]: signal({ dateRange: '90d', country: [], channel: [] }),
    };
  }
  if (!dashboardSelectionSignals.value[key]) {
    dashboardSelectionSignals.value = {
      ...dashboardSelectionSignals.peek(),
      [key]: signal({ dimension: null, entityKey: null }),
    };
  }

  // Cleanup on unmount
  return () => {
    const next = { ...dashboardFilterSignals.peek() };
    delete next[key];
    dashboardFilterSignals.value = next;

    const nextSel = { ...dashboardSelectionSignals.peek() };
    delete nextSel[key];
    dashboardSelectionSignals.value = nextSel;
  };
}, [windowId, container.id]);
```

#### Cleanup (window close)

Extend the existing `removeSignalsForKey(windowId)` in `signals.js` (line 239) to also remove dashboard signals whose key starts with the closed window's ID:

```js
// Add to removeSignalsForKey(windowId) in signals.js
const newDashFilters = { ...dashboardFilterSignals.peek() };
const newDashSelections = { ...dashboardSelectionSignals.peek() };
for (const key in newDashFilters) {
  if (key.startsWith(windowId + ':')) delete newDashFilters[key];
}
for (const key in newDashSelections) {
  if (key.startsWith(windowId + ':')) delete newDashSelections[key];
}
dashboardFilterSignals.value = newDashFilters;
dashboardSelectionSignals.value = newDashSelections;
```

This gives two cleanup paths: component unmount (handles tab switches and navigation) and window close (handles window manager teardown). Both follow the existing Forge cleanup pattern.

#### How `dashboardKey` enters the context

Forge's context is built by the `Context()` factory in `Context.jsx` (line 46). Each context carries an `identity` object with `windowId`, `dataSourceRef`, `dataSourceId`, etc. Child contexts created via `context.Context(dsRef)` spread the parent identity and override data-source-specific fields (line 169-174).

The dashboard container root adds `dashboardKey` to `identity` before rendering child blocks. This happens in the dashboard dispatch path in `Container.jsx`:

```js
// In the dashboard block dispatch (Container.jsx, new code path)
if (container.kind?.startsWith('dashboard.')) {
  const dashboardKey = `${context.identity.windowId}:${container.id}`;

  // Create a child context that carries dashboardKey in identity
  const dashboardContext = {
    ...context,
    identity: { ...context.identity, dashboardKey },
    // dashboardKey is also available as a convenience alias
    dashboardKey,
  };

  // Evaluate container-level visibleWhen (see dashboard.detail notes)
  if (container.visibleWhen) {
    const visible = evaluateDashboardCondition(
      container.visibleWhen,
      { context: dashboardContext, dashboardKey }
    );
    if (!visible) return null;
  }

  return <DashboardBlock
    container={container}
    kind={container.kind}
    context={dashboardContext}
    isActive={isActive}
  />;
}
```

When a dashboard block renders its own child containers (e.g. `dashboard.detail` with nested `dashboard.timeline`), it passes `dashboardContext` down. Since `.Context(dsRef)` spreads `...this` (including `identity`), the `dashboardKey` propagates automatically to all nested data-source-scoped contexts without any changes to `Context.jsx` itself.

This means:
- `context.identity.dashboardKey` and `context.dashboardKey` are available in every dashboard block and its children
- Non-dashboard containers are unaffected -- `dashboardKey` is `undefined` for them
- No changes to the `Context()` factory or `Context.jsx` are required

#### Reading and writing from child blocks

Blocks access `dashboardKey` from context and use it to read/write dashboard signals:

```js
// In any dashboard block component
const { dashboardKey } = context;

// Reading filter state
const filters = dashboardFilterSignals.value[dashboardKey]?.value;

// Publishing selection from a dimension block
dashboardSelectionSignals.value[dashboardKey].value = {
  dimension: "country",
  entityKey: "US"
};
```

The current implementation uses helpers in [dashboardUtils.js](/Users/awitas/go/src/github.com/viant/forge/src/components/dashboard/dashboardUtils.js) and signals from [signals.js](/Users/awitas/go/src/github.com/viant/forge/src/core/store/signals.js), rather than duplicating signal access logic in each block.

#### Bus events for loose coupling

Use the existing `busSignals` (window-scoped message bus in `signals.js`) for dashboard events. Because bus signals are window-scoped, every dashboard event **must** include a `dashboardKey` field so that blocks can filter for their own dashboard when multiple dashboards share a window:

```js
// Event envelope for all dashboard bus events
{
  type: 'dashboard.selection.changed',  // event type
  dashboardKey: 'win_1:perfDashboard',  // composite key for scoping
  sourceBlockId: 'byCountry',           // which block emitted the event
  payload: {                            // event-specific data
    dimension: 'country',
    entityKey: 'US'
  }
}
```

Supported event types:

- `dashboard.filter.changed` -- a filter control updated filter state
- `dashboard.selection.changed` -- a dimension block changed selection
- `dashboard.block.view.changed` -- a block toggled between chart/table view

Blocks subscribe by watching `getBusSignal(windowId)` and filtering on `dashboardKey`:

```js
// In a dependent block's useEffect
const bus = getBusSignal(windowId);
const relevant = bus.value.filter(
  msg => msg.dashboardKey === dashboardKey
        && msg.type === 'dashboard.selection.changed'
);
```

Note: for most cross-block state sharing, the dedicated dashboard signals (above) are preferred over bus events because they are reactive and do not require polling. Bus events are useful for one-shot notifications where the receiver needs to trigger an action (e.g. refetch) rather than read ongoing state.


## Selector Resolution for Single-Value Blocks

Several block types (`dashboard.summary`, `dashboard.messages`, `dashboard.status`) use dot-path selectors like `summary.total_spend` or `quality.zero_spend_rate` to read aggregate values. These selectors need a defined source scope.

**Rule: single-value selectors resolve against the `metrics` signal.**

For HTTP datasource fetch responses, Forge should prefer the explicit envelope fields:

- `rows`
- `dataInfo`
- `metrics`

before attempting selector-based traversal on the raw payload. Selectors still
matter for server-side projection and non-envelope contexts, but once the
client receives the canonical datasource envelope, those explicit fields are
the source of truth.

Forge's `DataSource.jsx` (line 138-141) already extracts a separate `metrics` object from the API response using `selectors.metrics` on the data source definition, and stores it in `signals.metrics`. This is distinct from `collection` (the row array) and `form` (the selected row). Dashboard blocks that read aggregate values use this scope:

```js
// Inside any block that reads selectors (summary, status, messages visibleWhen)
const metricsData = context.signals.metrics.value;
// metricsData = { summary: { total_spend: 123000, total_impressions: 5400000, overall_ctr_pct: 2.3 },
//                 quality: { zero_spend_rate: 47.2, null_country_rate: 1.1 } }

// Selector "summary.total_spend" resolves via dot-path traversal:
const value = resolveKey(metricsData, "summary.total_spend"); // → 123000
```

The data source definition wires this:

```yaml
dataSources:
  - id: perf
    selectors:
      data: rows               # → collection signal (array of rows)
      metrics: aggregates      # → metrics signal (object with summary/quality sub-keys)
```

This means:
- Block selectors always resolve against `metrics`, never against collection rows or form data
- The data source is responsible for shaping the API response so that `selectors.metrics` extracts the right object
- `resolveKey()` (already used in `DataSource.jsx`) handles dot-path traversal
- Blocks that also need row data (timeline, dimensions, feed) use `collection` via `useDataSourceState()` as documented in their respective sections


## Proposed Block Types

### 1. `dashboard.summary`

Purpose:

- KPI cards
- metric strips
- high-level totals and deltas

Metadata:

```yaml
kind: dashboard.summary
title: Performance Overview
dataSourceRef: perf          # must have selectors.metrics configured
metrics:
  - id: spend
    label: Total spend
    selector: summary.total_spend      # dot-path into metrics signal
    format: currency
  - id: impressions
    label: Impressions
    selector: summary.total_impressions
    format: compactNumber
  - id: ctr
    label: CTR
    selector: summary.overall_ctr_pct
    format: percent
```

Data contract:

Each `metrics[].selector` is resolved against `context.signals.metrics.value` using dot-path traversal. The block reads all selectors on mount and re-reads reactively when the metrics signal changes. See "Selector Resolution for Single-Value Blocks" above.

Rendering:

- simple card row
- responsive wrap
- optional delta/badge tone

Implementation:

- new renderer that maps `metrics[]` into simple Blueprint-like cards
- reads `context.signals.metrics` via `useSignalEffect`, not `useDataSourceState` (which returns `collection`)
- no new chart logic required


### 2. `dashboard.timeline`

Purpose:

- time series metrics
- campaign pacing
- weekly/monthly movement

Metadata:

Current Forge `Chart.jsx` expects **long-form rows**: each row carries `[xAxis.dataKey]` (the timestamp), `[series.nameKey]` (the series identifier), and one or more value columns. The `series.values` array lists which value columns the user can switch between via RadioGroup, and `series.valueKey` sets the default.

Example row shape for this config:

```json
{ "week": "2026-03-01", "metric": "US", "spend": 12000, "impressions": 540000 }
```

Here `metric` is the series discriminator (e.g. country), and `spend`/`impressions` are switchable value columns.

```yaml
kind: dashboard.timeline
title: Weekly Performance
dataSourceRef: weeklyTrend
viewModes: [chart, table]
chart:
  type: line
  xAxis:
    dataKey: week
    label: Week
    tickFormat: MM/dd
  yAxis:
    label: Spend
  cartesianGrid:
    strokeDasharray: 3 3
  series:
    nameKey: metric        # column that identifies each series (e.g. country)
    valueKey: spend        # default value column for the y-axis
    values:                # switchable value columns (RadioGroup)
      - label: Spend
        value: spend
      - label: Impressions
        value: impressions
    palette: ["#137cbd", "#0f9960", "#d9822b"]
```

Important:

- the data must be long-form: one row per (timestamp, series). `transformData()` in `Chart.jsx` pivots these into wide-form for Recharts.
- do not mix wide-form row shapes (where each metric is a column and there is no `nameKey` discriminator) with this config. If wide-form data is needed, a separate adapter or the agently `ChartSpec` model (which supports both) should be used.
- preserve chart/table toggle behavior similar to `agently` and current `Chart.jsx`
- the current implementation supports `line`, `bar`, and `area`

#### Client-side dashboard filter bindings

Timeline blocks may declare `filterBindings` on the container to apply dashboard filter state to the underlying collection before chart rendering:

```yaml
kind: dashboard.timeline
dataSourceRef: weeklyTrend
filterBindings:
  region: region
```

Meaning:

- `region` on the left is the dashboard filter field
- `region` on the right is the row field in the timeline collection

Current behavior:

- filtering is applied client-side in the block renderer
- the same filtering logic is reused by standalone export
- no server refetch is triggered in v1

Implementation:

- internally call the current `Chart` path -- the dashboard timeline block passes its `container.chart` config through to `Chart.jsx`
- for bar/area chart types, extend `Chart.jsx` with the Recharts rendering extracted from agently per Option C

Current status:

- generic report-builder chart annotations are now supported through the canonical chart model:
  - `annotations.verticalMarkers`
  - `annotations.referenceLines`
  - `annotations.bands`
  - `annotations.notes`
- the same authored annotation model lowers through both the runtime chart surface and ReportPrint SVG export

Still deferred to post-v1: **timeline-sourced annotations** where markers are backed by a separate annotation dataset or a timeline-specific annotation contract. That richer variant still needs an annotation record schema, source binding, and block-level authoring UX beyond the generic chart annotation model.


### 3. `dashboard.dimensions`

Purpose:

- breakdown by country, channel, campaign, advertiser
- ranked distributions
- top-N tables with optional share visualization

Metadata:

```yaml
kind: dashboard.dimensions
title: Spend by Country
dataSourceRef: byCountry
dimension:
  key: country
metric:
  key: spend
  label: Spend
  format: currency
viewModes: [chart, table]
limit: 15
orderBy: spend desc
on:
  - event: onSelect
    handler: dashboardSelect
    arguments:
      dimension: country
```

Views:

- simple horizontal ranking bars
- table view

#### Selection interaction contract

When a user clicks a ranking bar or table row in a dimension block, the block must:

1. **Resolve the clicked item.** The dimension block maintains its own data source collection. A click on a row resolves to the collection item at that index, the same way `toggleSelection` works in `dataSource.js` (line 507-538).

2. **Update local selection.** Call `setSelected({ selected: item, rowIndex })` on the block's own data source handlers. This gives the block visual selection feedback using the existing `selectionSignals` mechanism.

3. **Publish to the dashboard selection signal.** The `on.onSelect` handler (`dashboardSelect`) writes to the dashboard-scoped selection signal introduced in the Dashboard State Model section:

```js
// dashboardSelect handler implementation
function dashboardSelect({ args, context }) {
  const { dimension } = args;             // from on.arguments: "country"
  const selected = context.handlers.dataSource.getSelection().selected;
  const dashboardKey = context.dashboardKey;  // "{windowId}:{containerId}" from context

  // Write to dashboard selection signal (see Dashboard State Model, Option 2)
  const selSignal = dashboardSelectionSignals.value[dashboardKey];
  selSignal.value = {
    dimension,                              // "country"
    entityKey: selected?.[dimension] ?? null // "US"
  };
}
```

4. **Dependent blocks react via signal subscription.** Blocks like `dashboard.detail` read `dashboardSelectionSignals.value[dashboardKey]` reactively (where `dashboardKey` is `{windowId}:{containerId}`, see Dashboard State Model). When the signal changes, they re-fetch or re-filter their data source. The `visibleWhen` condition on the detail block evaluates against the same signal to show/hide (see `dashboard.detail` implementation notes for the container-level `visibleWhen` runtime path).

This uses Forge's existing primitives:
- `on` array with `event`/`handler`/`arguments` (same shape as `Execute` in Go model, line 619)
- `setSelected` / `getSelection` from `dataSource.js` handlers
- dashboard selection signal from the state model section above

No new event transport is needed.

Implementation:

- first version should not require Recharts for the ranking bar
- CSS bars are enough for v1
- table view should reuse existing table rendering where possible
- the `dashboardSelect` handler must be registered in the handler registry alongside existing handlers
- `filterBindings` may also be applied here, using the same client-side filter matching model as timeline/feed


### 3a. `dashboard.compare`

Purpose:

- current vs previous period
- delta cards
- trend-over-trend summaries

Metadata:

```yaml
kind: dashboard.compare
title: Period Compare
items:
  - id: spendChange
    label: Spend
    current: summary.total_spend
    previous: summary.previous_total_spend
    format: currency
    deltaFormat: currencyDelta
    deltaLabel: vs prior period
```

Implementation:

- reads values from the metrics signal
- computes `current - previous`
- renders a delta pill with success/danger tone depending on sign


### 3b. `dashboard.kpiTable`

Purpose:

- compact metric table
- supplemental metric inventory beside cards/charts

Metadata:

```yaml
kind: dashboard.kpiTable
title: Metric Table
rows:
  - id: impressions
    label: Impressions
    value: summary.total_impressions
    format: compactNumber
    context: Reach
    contextTone: success
```

Implementation:

- reads values from the metrics signal
- renders a compact table with formatted values and optional context pills


### 3c. `dashboard.filters`

Purpose:

- metadata-driven dashboard filter controls
- shared filter state for timeline/dimensions/feed/messages/report

Metadata:

```yaml
kind: dashboard.filters
title: Filters
items:
  - id: dateRange
    label: Date Range
    field: dateRange
    options:
      - label: 30D
        value: 30d
      - label: 90D
        value: 90d
        default: true
  - id: region
    label: Region
    field: region
    multiple: true
    options:
      - label: NA
        value: NA
        default: true
      - label: EMEA
        value: EMEA
```

Implementation:

- stores values in the dashboard filter signal
- supports single-select and multi-select chip groups
- defaults are applied on first render if no value exists yet
- `messages` and `report` interpolation can reference `filters.*`
- `timeline`, `dimensions`, and `feed` can consume filters through `filterBindings`


### 4. `dashboard.messages`

Purpose:

- alerts
- warnings
- interpretations
- recommendations
- quality notes

Metadata:

```yaml
kind: dashboard.messages
title: Messages
dataSourceRef: perf          # must have selectors.metrics configured
items:
  - severity: warning
    title: High zero-spend rate
    body: Nearly half of rows have zero spend.
    visibleWhen:                          # DashboardCondition
      selector: quality.zero_spend_rate   # dot-path into metrics signal
      gt: 40                              # show when value > 40
  - severity: info
    title: US concentration
    body: US dominates spend in the current 90-day window.
```

Data contract:

Message items are statically declared in metadata, not fetched from a collection. The `visibleWhen.selector` on each item resolves against `context.signals.metrics.value` (same rule as summary/status blocks -- see "Selector Resolution for Single-Value Blocks"). The `DashboardMessages` renderer evaluates each item's `visibleWhen` condition and filters the list before rendering.

Implementation:

- no new data model complexity
- just a structured list with tone mapping
- `visibleWhen` evaluated per-item by the block renderer against the metrics signal, not by the container dispatch
- should support inline actions later


### 5. `dashboard.status`

Purpose:

- freshness
- completeness
- null-rate checks
- SLO / data quality checks

Metadata:

```yaml
kind: dashboard.status
title: Data Health
dataSourceRef: perf          # must have selectors.metrics configured
checks:
  - id: zeroSpend
    label: Zero spend rows
    selector: quality.zero_spend_rate    # dot-path into metrics signal
    format: percent
    tone:
      warningAbove: 25
      dangerAbove: 40
  - id: nullCountry
    label: Null country rows
    selector: quality.null_country_rate  # dot-path into metrics signal
    format: percent
```

Data contract:

Each `checks[].selector` resolves against `context.signals.metrics.value` (same rule as summary/messages -- see "Selector Resolution for Single-Value Blocks"). The `tone` thresholds are evaluated against the resolved numeric value to determine visual severity.

Implementation:

- render as bullet bars or status rows
- reads `context.signals.metrics` via `useSignalEffect`
- should not need a dedicated chart library


### 6. `dashboard.feed`

Purpose:

- query trail
- audit trail
- pipeline/debug history
- timeline of events/messages

Metadata:

```yaml
kind: dashboard.feed
title: Analysis Trail
dataSourceRef: audit
fields:
  title: title
  body: body
  timestamp: ts
  severity: tone
```

Data contract:

Feed data comes from the block's own data source collection, accessed via `useDataSourceState(context).collection` (the same hook used by Chart.jsx and TablePanel). Each element in the collection array is one feed entry. The `fields` map tells the renderer which collection-row keys correspond to the feed's display fields:

```js
// Inside DashboardFeed.jsx
const { collection, loading } = useDataSourceState(context);
// collection = [{ title: "Query 1", body: "SELECT ...", ts: "2026-04-07T...", tone: "info" }, ...]
// fields mapping: entry[fields.title] → display title, entry[fields.timestamp] → display time, etc.
```

If the data source returns a wrapper object instead of a flat array (e.g. `{ entries: [...] }`), the data source's `selectors.data` field (already supported by `DataSource.jsx`) should be configured to extract the array:

```yaml
# In the data source definition, not in the feed block metadata
dataSources:
  - id: audit
    selectors:
      data: entries    # DataSource.jsx uses this to unwrap the response
```

This keeps the feed block simple: it always reads `collection` as a flat array and never resolves arbitrary selectors itself.

Implementation:

- simple ordered vertical feed
- should support compact and expanded modes
- uses `useDataSourceState(context).collection` for data, same as every other Forge data-bound component
- supports client-side `filterBindings` in the current implementation


### 7. `dashboard.detail`

Purpose:

- selected entity detail
- drilldown for clicked dimension item
- secondary chart plus detail table

Metadata:

```yaml
kind: dashboard.detail
title: Selected Segment
visibleWhen:                                # DashboardCondition
  selector: dashboard.selection.entityKey   # dot-path resolved via dashboard selection signal
  notEmpty: true                            # show when selection is non-empty
layout:
  kind: split
  orientation: vertical
containers:
  - id: detailTrend
    kind: dashboard.timeline
  - id: detailTable
    table: ...
```

Implementation:

- no special renderer needed beyond block coordination
- should be driven by selection state published from other blocks

**Container-level `visibleWhen` requires a new runtime path.** Forge's current visibility handling is item-centric: `WidgetRenderer.jsx` (line 175-207) evaluates `item.visibleWhen` using `onVisible` evaluators against form data, with operators `equals` and `in`. There is no equivalent for containers -- `Container.jsx` does not check any visibility condition before rendering.

For dashboard blocks, container-level `visibleWhen` is evaluated in the dashboard dispatch path before child rendering. See the full dispatch code in the "How `dashboardKey` enters the context" section of the Dashboard State Model. That code calls `evaluateDashboardCondition()` which:

1. Resolves the `selector` dot-path against dashboard signals (for dashboard-scoped selectors like `dashboard.selection.entityKey`) or the block's own data source context (for data-scoped selectors like `quality.zero_spend_rate`).
2. Applies the `DashboardCondition` operators (`gt`, `gte`, `lt`, `lte`, `notEmpty`, `when`) against the resolved value.
3. Returns `false` (block hidden) or `true` (block rendered).

Note: the `visibleWhen` on message *items* (inside `dashboard.messages`) is different -- those are evaluated by the `DashboardMessages` renderer itself when filtering the item list, not by the container dispatch. Only container-level `visibleWhen` needs this new code path.


## Rendering Approach

### Option A: Add explicit dashboard renderers

Add small components:

- `DashboardSummary.jsx`
- `DashboardTimeline.jsx`
- `DashboardDimensions.jsx`
- `DashboardMessages.jsx`
- `DashboardStatus.jsx`
- `DashboardFeed.jsx`

Then extend `Container.jsx` to recognize `container.kind` as a new dispatch field (this is a new code path -- Container.jsx currently dispatches via property presence like `chart`, `table`, etc., not via a `kind` field).

Example:

```js
// New dispatch path in Container.jsx (before existing property checks)
if (container.kind?.startsWith('dashboard.')) {
  return <DashboardBlock container={container} kind={container.kind} ... />
}
```

Pros:

- clear implementation
- simple to reason about
- aligns with current `Container` branching style

Cons:

- introduces another renderer dispatch path
- requires adding `kind` field to both Go and JS container models


### Option B: Add a dashboard block registry

Create:

- `src/dashboard/blockRegistry.js`

Then:

- register dashboard block renderers
- let `Container` resolve block type through registry

Pros:

- extensible
- keeps future block growth manageable

Cons:

- slightly more infrastructure


### Option C: Extract agently's Recharts rendering for additional chart types

Agently's `ChartSpecPanel` in [RichContent.jsx](/Users/awitas/go/src/github.com/viant/agently/ui/src/components/chat/RichContent.jsx) already renders bar, area, stacked_bar, scatter, and pie charts using the same Recharts library Forge already depends on. The rendering logic itself (which Recharts component to instantiate, how to map series to props) can be extracted and reused inside Forge's chart path.

Important: this does **not** mean adopting agently's `ChartSpec` schema (`{ chart, data }`) as a second chart model. Forge's chart model (`container.chart` + bound data source collection) remains the single source of truth. What gets reused is the rendering switch:

```js
// Extracted from agently's ChartSpecPanel — used inside Forge's Chart.jsx
// after transformData() produces chartData and keys from the existing model.
switch (chart.type) {
  case 'line': return <LineChart ... />    // already implemented
  case 'bar':  return <BarChart ... />     // new: extract from agently
  case 'area': return <AreaChart ... />    // new: extract from agently
  default:     return <LineChart ... />
}
```

This means:

- `container.chart.type` already exists in the Go `Chart` struct -- just set it to `"bar"` or `"area"`
- data still flows through `dataSourceRef` → collection signal → `transformData()`, not through an embedded `data[]` array
- no second chart schema is introduced
- the Go model needs no changes beyond what is already proposed

Agently source files to extract from:

- [RichContent.jsx](/Users/awitas/go/src/github.com/viant/agently/ui/src/components/chat/RichContent.jsx) -- `ChartSpecPanel` (lines ~60-180), specifically the Recharts component instantiation per chart type
- [chartSpec.ts](/Users/awitas/go/src/github.com/viant/agently-core/sdk/ts/src/richContent/chartSpec.ts) -- `buildChartSeries()` can be referenced for series pivot logic, but Forge's `transformData()` already does this

Pros:

- adds bar/area/stacked_bar support to Forge without writing Recharts integration from scratch
- no new schema, no new data flow -- just more chart types in the existing `Chart.jsx` switch
- proven rendering code

Cons:

- one-time extraction effort to adapt agently's component instantiation to Forge's data shape
- future agently chart improvements would need manual backport


### Recommendation

Use **Option A first**, then move to a registry (Option B) if the block set expands. Use **Option C to extract additional Recharts chart types** (bar, area) into Forge's existing `Chart.jsx` without adopting a second chart schema.

Reason:

- current Forge codebase is still simple enough that explicit branching is clearer
- one chart schema (Forge's `container.chart`) avoids confusion and competing models
- dashboard work needs momentum, not infrastructure first


## Layout Rules

### Rule 1: reuse existing `layout.kind: "grid"`

Dashboards should use the current auto-placement grid, not explicit coordinates.

Why:

- already implemented
- already documented
- already supports `columnSpan` and `rowSpan`
- easier authoring


### Rule 2: dashboard blocks are containers, not items

Do not model major dashboard panels as `items`.

Use nested `containers` because blocks often need:

- title
- toolbar/actions
- chart + table switch
- nested content
- empty/loading states


### Rule 3: internal block layout can be independent

The parent dashboard uses the top-level 12-column grid.

Inside a block:

- summary may use simple flex
- timeline may use stacked vertical layout
- detail may use split
- messages may use list layout


### Rule 4: no explicit dashboard row/col metadata

Do not add:

- `row`
- `col`
- `x`
- `y`

for dashboard blocks.

Use:

- item order
- `columnSpan`
- `rowSpan`

This matches current Forge behavior.


## Simple Chart Model

Forge's existing `container.chart` model is the single chart schema. Dashboard blocks use the same shape:

```yaml
# Go struct: Chart (backend/types/model.go:65)
# Fields: Type, XAxis, YAxis, CartesianGrid, Width, Height, Series, On
chart:
  type: line                  # line | bar | area (bar/area via Option C extraction)
  xAxis:
    dataKey: week             # column in data source collection
    label: Week
    tickFormat: MM/dd
  yAxis:
    label: Spend
  cartesianGrid:
    strokeDasharray: 3 3
  series:
    nameKey: metric           # column that identifies each series
    valueKey: spend           # default value column
    values:                   # switchable value columns (RadioGroup in Chart.jsx)
      - label: Spend
        value: spend
      - label: Impressions
        value: impressions
    palette: ["#137cbd", "#0f9960", "#d9822b"]
```

Data flows through `dataSourceRef` → collection signal → `transformData()` in `Chart.jsx`. Data is **not** embedded in the chart config.

Chart types for v1:

- line (already implemented in `Chart.jsx`)
- bar, area (extract Recharts rendering from agently's `ChartSpecPanel` per Option C)

Key rules:

- chart/table toggle on every chart block
- one chart block maps to one data source
- no second chart schema -- agently's `ChartSpec` is a reference for rendering extraction only, not a model to adopt
- the Go `Chart` struct already has the `Type` field to support `"bar"` and `"area"` with no schema changes


## Downloadable Requirement

### Requirement

A dashboard must be renderable in two ways:

1. normal interactive Forge UI
2. downloadable standalone HTML


### Proposed Implementation

Add a small export path:

- `dashboard.export.html`

Behavior:

- capture resolved dashboard metadata
- capture current data payloads for dashboard data sources
- render into a standalone HTML shell
- include chart/table blocks in static or lightweight interactive form

### Download package requirements

The downloaded dashboard file must be a **single self-contained HTML document**. Opening it in a browser must not require:

- the Forge app
- the Forge stylesheet bundle
- Blueprint CSS from the host app
- Recharts at runtime
- remote fonts, icons, or image assets hosted by the app

Everything required for correct rendering must be inside the exported `.html` file itself.

### Styling strategy for standalone HTML

The exported file must include all required styling directly in the file. The export path should:

1. **Inline a minimal dashboard stylesheet** into a `<style>` block in the HTML `<head>`.
   This stylesheet is part of the exported file and covers dashboard layout and presentation:
   - grid and split block layout
   - card frames
   - section headers
   - summary metrics
   - status bars
   - feed/timeline rows
   - tables
   - typography and spacing

2. **Use computed inline styles for dynamic values** that vary per rendered block instance.
   Examples:
   - grid spans
   - bar widths
   - status colors
   - chart dimensions
   - column widths

3. **Do not rely on class names alone.**
   Class names may remain in the markup for readability, but all visual behavior required for rendering must be satisfied by:
   - the inlined `<style>` block
   - inline `style=""` attributes

4. **Do not depend on the full Blueprint CSS bundle in the exported file.**
   Export should reproduce the needed look with a small dashboard-specific stylesheet rather than trying to ship all of Blueprint.

5. **Do not depend on external assets for core rendering.**
   If icons are needed, use:
   - inline SVG
   - simple text/badge styles
   - or omit non-essential decorative icons in export mode

6. **Tables use plain HTML `<table>`.**
   Do not export Blueprint Table markup that depends on app CSS or JS behavior.

7. **Charts export as inline SVG for v1.**
   The downloaded file should contain the final chart drawing as inline SVG markup captured from the rendered chart state. This avoids bundling Recharts JS into the standalone file.

### Export output contract

For v1, the exported HTML must contain:

- one `<style>` block with all required dashboard CSS
- the rendered dashboard markup
- inline SVG for charts
- plain HTML tables
- inline data needed for static labels/tooltips if applicable

For v1, the exported HTML must not require:

- external CSS files
- external JS bundles
- app-hosted images
- Blueprint runtime behavior
- Forge runtime services


### Practical Scope for v1

For v1 downloadable HTML:

- include summary cards
- include ranking/status bars
- include simple charts
- include tables
- include messages/feed

Not required in v1:

- full live handlers
- live cross-filtering after download
- full window manager integration


## Example Use Case: Performance Analytics

This use case should be implemented as a **dashboard instance**, not as the component definition.

Suggested block layout:

```yaml
id: factPerfDailyDashboard
role: dashboard
layout:
  kind: grid
  columns: 12
  gap: 16
containers:
  - id: summary
    kind: dashboard.summary
    columnSpan: 12

  - id: weeklyTrend
    kind: dashboard.timeline
    columnSpan: 8
    rowSpan: 2

  - id: insights
    kind: dashboard.messages
    columnSpan: 4
    rowSpan: 2

  - id: byCountry
    kind: dashboard.dimensions
    columnSpan: 6

  - id: byChannel
    kind: dashboard.dimensions
    columnSpan: 6

  - id: quality
    kind: dashboard.status
    columnSpan: 4

  - id: segmentDetail
    kind: dashboard.detail
    columnSpan: 8

  - id: auditTrail
    kind: dashboard.feed
    columnSpan: 12
```

Block mapping:

- `summary`: spend, impressions, clicks, conversions, CTR, CPM
- `weeklyTrend`: weekly spend/impressions/clicks
- `insights`: warnings like high zero-spend rate or extreme geographic concentration
- `byCountry`: ranked spend share by country
- `byChannel`: ranked spend by channel
- `quality`: nulls, zero-spend rows, video completion
- `segmentDetail`: drilldown after selecting country/channel
- `auditTrail`: SQL / MCP execution notes


## Implementation Plan

### Phase 0: model extension (prerequisite)

Extend the Container model in both Go and JS:

- Add `Kind`, `Role`, `ColumnSpan`, `RowSpan`, `VisibleWhen` to Go `Container` struct in `backend/types/model.go`
- Add `Gap`, `RowGap`, `ColumnGap` to Go `Layout` struct
- Add `kind` dispatch in `Container.jsx` for `dashboard.*` block types, including `dashboardContext` creation and container-level `visibleWhen` evaluation
- Implement `DashboardBlock.jsx` (switch on `kind` to renderer), `evaluateDashboardCondition()` (pure function, unit-testable), and `captureChartSvg()` (see Implementation Risks for code)
- Extract `placeItems()` and `buildContainerStyle()` from `GridLayoutRenderer.jsx` into `src/components/grid/gridPlacement.js` (safe refactor: move two pure functions, update one import)
- Build `DashboardGridRenderer.jsx` using the extracted placement functions to lay out child containers -- do **not** modify `GridLayoutRenderer.jsx` itself (see Risk 2 mitigation)


### Phase 1: block renderers

Add minimal renderers for:

- `dashboard.summary`
- `dashboard.timeline` (using extended `Chart.jsx` with bar/area from agently extraction)
- `dashboard.dimensions`
- `dashboard.messages`
- `dashboard.status`
- `dashboard.feed`

Keep them visually simple.


### Phase 2: dashboard-scoped state

Add:

- dashboard filter state
- dashboard selection state
- simple event publishing for block selection

Do not overbuild a new state framework.


### Phase 3: downloadable export

Add HTML export for dashboard screens per the export output contract in the Downloadable Requirement section.

Export must produce a single self-contained HTML file including:

- one `<style>` block with all dashboard CSS (no external stylesheets)
- dashboard title and grid layout markup with inline styles for spans
- summary cards with resolved metric values
- charts as inline SVG snapshots (no Recharts JS bundled)
- tables as plain HTML `<table>` (no Blueprint Table dependency)
- messages and feed entries
- no external CSS, JS, fonts, or image dependencies


### Phase 4: example dashboard

Implement a performance analytics dashboard as a proving use case.

This phase validates:

- metadata expressiveness
- layout clarity
- chart simplicity
- export completeness


## Validation Criteria

### Metadata validation

1. A dashboard can be declared using normal Forge container metadata.
2. A dashboard uses `layout.kind: "grid"` and existing spans, not custom positioning.
3. Nested dashboard blocks remain valid Forge containers.
4. `dashboard.timeline` accepts a chart config without inventing an incompatible schema.


### Rendering validation

1. A dashboard renders correctly in desktop and narrow widths.
2. Block titles, empty states, and loading states are visible and consistent.
3. Chart blocks open in chart mode by default and can switch to table mode.
4. Dimension and status blocks render without requiring Recharts when simple bars are enough.
5. Nested containers still work inside dashboard blocks.


### Interaction validation

1. Selecting a dimension item updates dashboard selection state.
2. Dependent blocks can react to selection through the existing context/signal path.
3. Filters can be shared across multiple blocks.
4. Dashboard blocks remain functional even when selection is empty.


### Download/export validation

1. The dashboard can be exported to a single standalone HTML file.
2. The exported HTML opens in a browser without Forge runtime services, external CSS, external JS, or remote assets.
3. All styling is self-contained: one `<style>` block plus inline `style=""` attributes -- no reliance on class names that depend on an external stylesheet.
4. Charts render as inline SVG captured from the rendered state -- no Recharts JS required at view time.
5. Tables render as plain HTML `<table>` elements -- no Blueprint Table dependency.
6. Exported content preserves block ordering, grid layout, and visual hierarchy.
7. Exported output is shareable and understandable without the original app context.


### Simplicity validation

1. The first implementation does not require a second layout engine.
2. The first implementation does not require a dashboard builder UI.
3. The first implementation adds only a small number of block kinds.
4. The first implementation keeps chart behavior close to current Forge and `agently`.


## Non-Goals for v1

- drag-and-drop dashboard designer
- arbitrary custom chart grammar
- advanced pivot builder
- fully live downloaded dashboards
- PDF-focused print layout engine
- explicit coordinate placement


## Implementation Risks and Mitigations

### 1. New abstractions need careful definition

`DashboardBlock`, `dashboardContext`, and `evaluateDashboardCondition()` are proposed abstractions in this document, not existing code.

**Mitigation: implement as thin, stateless functions in Phase 0.**

`DashboardBlock` should be a single switch statement, not a class or framework:

```js
// src/components/dashboard/DashboardBlock.jsx
export default function DashboardBlock({ container, kind, context, isActive }) {
  switch (kind) {
    case 'dashboard.summary':    return <DashboardSummary container={container} context={context} />;
    case 'dashboard.timeline':   return <DashboardTimeline container={container} context={context} isActive={isActive} />;
    case 'dashboard.dimensions': return <DashboardDimensions container={container} context={context} />;
    case 'dashboard.messages':   return <DashboardMessages container={container} context={context} />;
    case 'dashboard.status':     return <DashboardStatus container={container} context={context} />;
    case 'dashboard.feed':       return <DashboardFeed container={container} context={context} />;
    case 'dashboard.detail':     return <Container container={container} context={context} isActive={isActive} />;
    default:                     return <Container container={container} context={context} isActive={isActive} />;
  }
}
```

`dashboardContext` is a plain object spread, not a new class. The risk is that downstream code uses `===` identity checks on the context. Mitigation: `Context.jsx` already creates new context objects via spread in `.Context(dsRef)` (line 213: `result = { ...this, ... }`), so all existing code already handles non-identical context objects. The dashboard spread follows the same pattern.

`evaluateDashboardCondition()` is a pure function with two code paths:

```js
// src/components/dashboard/evaluateCondition.js
export function evaluateDashboardCondition(condition, { context, dashboardKey }) {
  // 1. Resolve the value from the right scope
  let value;
  if (condition.selector?.startsWith('dashboard.selection.')) {
    const field = condition.selector.replace('dashboard.selection.', '');
    value = dashboardSelectionSignals.value[dashboardKey]?.value?.[field];
  } else if (condition.selector?.startsWith('dashboard.filter.')) {
    const field = condition.selector.replace('dashboard.filter.', '');
    value = dashboardFilterSignals.value[dashboardKey]?.value?.[field];
  } else {
    // Data-scoped: resolve against metrics signal
    value = resolveKey(context.signals?.metrics?.value, condition.selector);
  }

  // 2. Apply operators (all must pass if multiple are set)
  if (condition.notEmpty === true && (value === null || value === undefined || value === '')) return false;
  if (condition.gt  != null && !(value > condition.gt))  return false;
  if (condition.gte != null && !(value >= condition.gte)) return false;
  if (condition.lt  != null && !(value < condition.lt))  return false;
  if (condition.lte != null && !(value <= condition.lte)) return false;
  if (condition.when !== undefined) {
    if (Array.isArray(condition.when)) { if (!condition.when.includes(value)) return false; }
    else { if (value !== condition.when) return false; }
  }
  return true;
}
```

Both functions are small, testable in isolation, and have no framework dependencies. Implement and unit-test them in Phase 0 before any block renderer work begins.


### 2. GridLayoutRenderer extension is a core change

Extending `GridLayoutRenderer.jsx` to handle containers touches the core layout path used by all existing grids.

**Mitigation: do not modify GridLayoutRenderer. Instead, reuse its placement algorithm in a separate dashboard grid.**

`GridLayoutRenderer.jsx` has two separable concerns:
- **Placement**: `placeItems()` (line 14-72) is a pure function that takes objects with `columnSpan`/`rowSpan` and returns grid positions. It does not care whether inputs are items or containers.
- **Rendering**: the JSX loop (line 149-198) is item-specific — it uses `ControlRenderer`, label cells, and item-level event handlers.

Extract `placeItems()` and `buildContainerStyle()` into a shared module, then build a `DashboardGridRenderer` that reuses placement but renders `<Container>` elements:

```js
// src/components/dashboard/DashboardGridRenderer.jsx
import { placeItems, buildContainerStyle } from '../grid/gridPlacement.js';
import Container from '../Container.jsx';

export default function DashboardGridRenderer({ containers, layout, context, isActive }) {
  const columns = layout?.columns || 12;
  const { placements, rowCount } = useMemo(() => placeItems(containers, columns), [containers, columns]);
  const gridStyle = useMemo(() => buildContainerStyle(layout, rowCount), [layout, rowCount]);

  return (
    <div style={gridStyle}>
      {placements.map(({ item: subContainer, r, c, w, h }) => {
        const cellStyle = {
          gridColumn: `${c} / span ${w}`,
          gridRow: `${r} / span ${h}`,
          minHeight: 0,
          minWidth: 0,
        };
        const dsRef = subContainer.dataSourceRef || context.identity.dataSourceRef;
        return (
          <div key={subContainer.id} style={cellStyle}>
            <Container
              container={subContainer}
              context={context.Context(dsRef)}
              isActive={isActive}
            />
          </div>
        );
      })}
    </div>
  );
}
```

This approach:
- **Zero risk to existing grids.** `GridLayoutRenderer.jsx` is not modified.
- **Reuses the proven placement algorithm** without reimplementing auto-placement.
- **Uses `labels.mode: "none"` implicitly** — dashboard blocks are containers, not labeled form items, so the label-cell logic is irrelevant.
- The extraction of `placeItems()` and `buildContainerStyle()` into `src/components/grid/gridPlacement.js` is a safe refactor (move two pure functions, update one import in `GridLayoutRenderer.jsx`).

Phase 0 validation: after extracting the placement functions, run the existing app and verify all current grid layouts render identically.


### 3. Inline SVG capture needs a concrete mechanism

The export requirement specifies charts as inline SVG, but the capture path is not defined.

**Mitigation: use the existing `chartRef` in `Chart.jsx` to capture SVG at export time.**

`Chart.jsx` already maintains a `ref` on the chart wrapper div (line 107: `const [chartRef, chartSize] = useMeasuredContainer()`; line 352: `ref={chartRef}`). The Recharts `<ResponsiveContainer>` renders an `<svg>` element inside this div.

Capture utility:

```js
// src/core/ui/captureChartSvg.js
export function captureChartSvg(chartContainerElement) {
  if (!chartContainerElement) return null;
  const svg = chartContainerElement.querySelector('svg');
  if (!svg) return null;

  // Clone to avoid mutating the live DOM
  const clone = svg.cloneNode(true);

  // Inline all computed styles so the SVG is self-contained
  inlineComputedStyles(clone);

  // Remove Recharts-specific class names that depend on app CSS
  clone.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'));

  // Set explicit dimensions so it renders correctly standalone
  clone.setAttribute('width', svg.clientWidth);
  clone.setAttribute('height', svg.clientHeight);

  return new XMLSerializer().serializeToString(clone);
}

function inlineComputedStyles(node) {
  if (node.nodeType !== 1) return; // element nodes only
  const computed = window.getComputedStyle(node);
  // Only inline the properties Recharts actually uses
  const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray',
                 'font-size', 'font-family', 'font-weight', 'text-anchor',
                 'dominant-baseline', 'opacity'];
  for (const prop of props) {
    const val = computed.getPropertyValue(prop);
    if (val) node.style.setProperty(prop, val);
  }
  for (const child of node.children) inlineComputedStyles(child);
}
```

Integration with export:

- The dashboard export function iterates over rendered dashboard blocks.
- For each chart block, it calls `captureChartSvg(chartRef.current)` to get a self-contained SVG string.
- The SVG string is inserted directly into the exported HTML in place of the `<div ref={chartRef}>` wrapper.

Phase 0 validation: build the capture utility, call it on an existing `Chart.jsx` instance, paste the output SVG into a blank HTML file, and verify it renders correctly without any Forge/Recharts/Blueprint CSS or JS.


## Recommended Files to Add or Change

Go model changes:

- `backend/types/model.go` -- add `Kind`, `Role`, `ColumnSpan`, `RowSpan` to `Container`; add `Gap`, `RowGap`, `ColumnGap` to `Layout`; add dashboard-specific types

Frontend model/layout changes:

- `src/components/Container.jsx` -- add `container.kind` dispatch for `dashboard.*` blocks with `dashboardContext` and `visibleWhen`
- `src/components/grid/gridPlacement.js` -- extracted `placeItems()` and `buildContainerStyle()` (safe refactor from `GridLayoutRenderer.jsx`)
- `src/components/GridLayoutRenderer.jsx` -- update import to use extracted placement module (no logic changes)

New dashboard components:

- `src/components/dashboard/DashboardBlock.jsx` -- kind-to-renderer switch
- `src/components/dashboard/DashboardGridRenderer.jsx` -- container grid layout using extracted placement
- `src/components/dashboard/evaluateCondition.js` -- `evaluateDashboardCondition()` pure function
- `src/components/dashboard/DashboardSummary.jsx`
- `src/components/dashboard/DashboardTimeline.jsx`
- `src/components/dashboard/DashboardDimensions.jsx`
- `src/components/dashboard/DashboardMessages.jsx`
- `src/components/dashboard/DashboardStatus.jsx`
- `src/components/dashboard/DashboardFeed.jsx`
- `src/components/dashboard/index.js`

Export support:

- `src/core/ui/dashboardExport.js` -- HTML export orchestration
- `src/core/ui/captureChartSvg.js` -- SVG snapshot capture from rendered Recharts charts


## Final Recommendation

Implement dashboard support as **data-driven block containers on top of the existing Forge layout engine**.

That means:

- extend Go and JS container models with `kind`, `role`, `columnSpan`, `rowSpan`
- extend `GridLayoutRenderer` to handle containers in the grid (not just items)
- reuse `layout.kind: "grid"` and nested containers
- extract agently's Recharts rendering (bar, area) into Forge's `Chart.jsx` -- keep `container.chart` as the single chart schema
- keep block types small and semantic
- make downloadable HTML an explicit output path

The initial performance analytics case should be the first example dashboard instance, but not the definition of the dashboard system itself.
