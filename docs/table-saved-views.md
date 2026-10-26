# Named table views

`table.savedViews: {key: shared-grid-key}` adds named grid presets to the existing
Table Settings dialog (`table.openSetting`). Tables without this configuration
retain the existing column settings. Matching keys can share a producer's
personal preference collection across related grids.

The host supplies an actor-scoped `services.tableViews` adapter:

```js
{
  list: async key => [{id, name, preferences}],
  save: async (key, {id, name, preferences}) => { /* omit id to create */ },
  remove: async (key, id) => {},
}
```

`preferences` uses the version-1 table-preference DTO from `forge/core`. The host
maps producer field IDs and wire formats. Actor identity and credentials remain
host-owned; replace the adapter when the signed-in actor changes. This is personal
grid presentation, not authorization for writes to the displayed business entity.
The producer still enforces access to the preference record.

Views load when settings open. The UI supports default/all columns, selecting a
custom preset, saving current columns as a new preset, updating its name and
columns, and deletion. Applying a preset edits the dialog's column draft; its
existing Save button applies that draft to the table. Explicit preset operations
persist immediately and are not undone by cancelling the column draft.

Missing adapters produce an explicit error. The component does not silently
substitute browser storage for a configured server collection. Read-only adapters
may omit `save` and `remove`; corresponding operations remain disabled. Loading
and producer failures are visible and retryable. Session reads and writes are
serialized, stale results cannot replace newer state, and adapter/key changes
discard the previous session's view list.

This primitive does not install a producer transport, persist the active view ID,
or synchronize open table instances. Hosts needing those behaviors must bind
their existing table-preference service and shared collection lifecycle. The
adapter must not imply full producer parity from these controls alone.

Settings layout uses `forge-table-settings__*` classes. Theme overrides use
`--forge-table-settings-*` tokens and the existing `--forge-border-color`.
