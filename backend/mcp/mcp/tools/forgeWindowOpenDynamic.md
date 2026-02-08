# forgeWindowOpenDynamic

Open a dynamic Forge window from inline metadata (no backend YAML fetch).

Maps to UI command: `ui.window.openDynamic`.

## Input

```json
{
  "clientId": "optional-ui-client-id",
  "windowTitle": "Ad-hoc window",
  "inTab": false,
  "metadata": {
    "ns": ["dyn"],
    "dataSource": {
      "main": { "selectionMode": "single" }
    },
    "view": {
      "dataSourceRef": "main",
      "content": {
        "id": "root",
        "layout": { "kind": "grid", "columns": 2 },
        "containers": [
          { "id": "left", "controls": [ { "id": "name", "type": "text", "label": "Name" } ] }
        ]
      }
    }
  },
  "timeoutMs": 15000
}
```

## Output

Returns `{ "windowId": "...", "windowKey": "..." }`.

