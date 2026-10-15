# forgeActiveWindowList

List active Forge windows in the selected connected UI client. Returns only
window IDs, keys, titles, presentation flags, and selection state. It does not
return window forms, parameters, data-source values, or collection rows.

If `clientId` is omitted, the server uses the default client in the current MCP
namespace. A disconnected client returns `connected: false` and an empty list.

## Input

```json
{"clientId":"optional-ui-client-id"}
```

## Output

```json
{"clientId":"client-1","connected":true,"windows":[{"windowId":"W1","windowKey":"report","windowTitle":"Report","inTab":true,"isModal":false,"isMinimized":false,"selected":true}]}
```
