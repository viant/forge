# Table layout, navigation, and preferences

This guide describes the web `table` renderer. Native support is documented
separately; a shared metadata field is not evidence of identical platform behavior.
For cell and row formatting, see [Table formatting](table-formatting.md).

## Stable row slots and column widths

```yaml
table:
  density: compact
  minRows: 10
  rowHeight: 32
  fillRemainingWidth: true
  pagination: {pageSize: 10, pageSizeOptions: [10]}
  columns:
    - {id: ID, name: ID, width: 100, sticky: left}
    - {id: Name, name: Name, width: 260, sticky: left}
    - {id: Status, name: Status, width: 140}
```

`minRows` reserves visual slots; it does not add records or change counts,
selection, sorting, or export. Unused slots are blank rather than striped fake
records. `rowHeight` fixes row height; use detail views for expanded content.
`minRows` is clamped to 0–100; fixed row heights to 24–96px (32px by default).

`fillRemainingWidth: true` keeps the table full width while a non-data trailing
column absorbs unused width. Real column widths are retained. Without that flag,
`fullWidth: true` forces full width; otherwise a naturally narrow table stays
compact, while a table needing at least half the available width expands.
An explicit `table.width` takes precedence.

Column `sticky: left` freezes columns during horizontal overflow. The renderer
limits the frozen region to half the viewport so scrolling data remains reachable.
Headers remain in the table's scroll context. Horizontal-scroll affordances are
separate from page navigation.

## One toolbar

Navigation is placed in the toolbar center by the Basic table renderer. Put
business actions on the left and Customize/Refresh/Filter on the right. The Last
page action cannot be enabled without a known last page. Do not manufacture a
total from the current page's row count.

```yaml
table:
  toolbar:
    density: compact
    layout: responsive
    items:
      - id: exportCsv
        type: tableExport
        label: Export CSV
        icon: export
        hideLabel: true
        tooltip: Export visible rows as CSV
        align: left
        properties: {formats: [csv], filename: delivery, scope: page}
      - id: nameSearch
        type: quickSearch
        align: center
        properties: {field: Name, label: Name contains, requestTrigger: blur}
      - {id: settings, label: Customize, icon: settings, hideLabel: true, align: right}
      - {id: refresh, label: Refresh, icon: refresh, hideLabel: true, align: right}
      - {id: filterList, label: Filter, icon: filter, hideLabel: true, align: right}
```

Reuse toolbar definitions through parameterized `$import(...)` rather than
copying subtly different actions across tabs. Imports are resolved by the host's
metadata loader, not by CSS.

`tableExport` exports actual loaded, filtered/sorted rows and visible columns.
`properties.scope: page` limits it to the rendered page. It is not an automatic
server-side export of unloaded pages. Refresh without an explicit event handler
uses the table datasource refresh behavior.

## Search request timing

`quickSearch.properties.requestTrigger` accepts `blur` (default) or `change`.
Enter commits immediately. Escape, or the magnifying-glass close action, clears
and closes search. Committing resets pagination to page 1. `field` identifies the
datasource filter key; the backend determines matching semantics such as contains.

This is distinct from the older `quickFilter`/`quickFilterInputs` filter-set
control, which debounces changes by 350ms and flushes pending edits on blur.
Do not assume the two controls share request-timing configuration.

Typed text lookups use `item.lookup.requestTrigger: blur | change`, defaulting to
blur. Resolution also requires `lookup.dataSource` and `lookup.resolveInput`.
Opening a lookup picker is a separate action. Stale asynchronous resolutions are
ignored when the input changes.

## Preference adapter

Browser storage is the default. A host may inject an asynchronous adapter through
`services.tablePreferences`:

```js
const tablePreferences = {
  async get(key) { /* return version-1 preferences or null */ },
  async set(key, preferences) { /* persist validated preferences */ },
  async reset(key) { /* remove this table's preferences */ },
};
```

A version-1 payload contains `columns` (stable IDs, visibility, width, displayName,
tooltip, alignment), optional `sort: {columnId, direction: 'asc' | 'desc'}`,
`density: 'compact' | 'normal'`, and `frozenColumnIds`. Column order follows the
saved `columns` order. Unknown columns are ignored; newly added columns remain
available; `nonExcludable` columns stay visible. Payloads are limited to 64KiB.

`connectorConfig.tablePreferences.namespace` scopes the browser adapter.
The table key comes from `context.tableSettingKey(container.id)` when supplied,
otherwise from window/datasource/container identity. Hosts should provide stable,
workspace-scoped keys. Writes are serialized and stale hydration must not replace
newer edits. Storage errors are surfaced instead of silently pretending to save.

An external MCP preference service is a host integration: agently-core defines
its contract/configuration; Forge does not ship that server. When a non-browser
adapter is configured but unavailable, Forge reports an error rather than silently
switching storage providers.

Implementation references: [sizing](../src/components/table/tableSizing.js),
[toolbar](../src/components/table/basic/Toolbar.jsx),
[quick search](../src/components/table/basic/QuickSearch.jsx),
[preferences](../src/core/preferences/tablePreferences.js).
