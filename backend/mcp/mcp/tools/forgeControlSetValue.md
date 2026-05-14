# forgeControlSetValue

Set a control value using semantic ids (writes to form, filter, or windowForm state).

Maps to UI command: `ui.control.setValue`.

## Input (examples)

Form field:
```json
{ "windowId":"W1", "dataSourceRef":"main", "controlId":"name", "scope":"form", "value":"Alice" }
```

Filter field:
```json
{ "windowId":"W1", "dataSourceRef":"main", "controlId":"status", "scope":"filter", "value":"open" }
```

Window-level state:
```json
{ "windowId":"W1", "controlId":"granularity", "scope":"windowForm", "value":"hour" }
```
