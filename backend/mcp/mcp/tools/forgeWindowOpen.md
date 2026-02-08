# forgeWindowOpen

Open a Forge window (tab or floating) via the UI bridge.

Maps to UI command: `ui.window.open`.

## Input
```json
{
  "clientId": "optional-ui-client-id",
  "windowKey": "files",
  "windowTitle": "Files",
  "windowData": "",
  "inTab": true,
  "parentKey": "optional-parent-windowId",
  "parameters": {},
  "options": { "modal": false, "newInstance": false },
  "timeoutMs": 15000
}
```

## Output
Returns `{ "windowId": "..." }`.

