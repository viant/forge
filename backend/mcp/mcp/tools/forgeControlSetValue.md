# forgeControlSetValue

Set a control value using semantic ids (writes to form or filter store).

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

