# Forge MCP (UI bridge)

This package adds an MCP server that bridges to the Forge frontend UI bridge (`startUIBridge`).

## Run

```bash
go run ./backend/mcp/cmd/forge-mcp -a 127.0.0.1:5025 --ui-token "dev-secret"
```

- MCP endpoint: `http://127.0.0.1:5025/mcp`
- UI WebSocket endpoint (frontend connects here): `ws://127.0.0.1:5025/forge/ui`
- UI HTTP JSON-RPC endpoint (streamable): `http://127.0.0.1:5025/forge/ui/rpc`

## Frontend connect

In your app bootstrap:

```js
import { startUIBridge } from 'forge/core';
startUIBridge({ url: 'ws://127.0.0.1:5025/forge/ui', token: 'dev-secret' });
```

HTTP/JSON-RPC (streamable) bridge:

```js
import { startUIBridgeHTTP } from 'forge/core';
startUIBridgeHTTP({ url: 'http://127.0.0.1:5025/forge/ui/rpc', token: 'dev-secret' });
// Uses a resumable SSE stream with Mcp-Session-Id.
```

## Frontend auto-connect (opt-in)

If your app uses `SettingProvider`, Forge can auto-connect when you provide a URL via Vite env:

```bash
export VITE_FORGE_UI_BRIDGE_URL="ws://127.0.0.1:5025/forge/ui"
export VITE_FORGE_UI_BRIDGE_TOKEN="dev-secret"
export VITE_FORGE_UI_BRIDGE_ENABLED=true
```

## Tools

- `forgeUISnapshot`: returns latest UI snapshot.
- `forgeUICommand`: sends `{method, params}` to the UI and returns `{ok,result,error}`.
- `forgeUIWait`: blocks until snapshot changes or predicate matches.
- Typed convenience tools (wrappers over `forgeUICommand`):
  - `forgeWindowOpen`, `forgeWindowOpenDynamic`, `forgeWindowClose`, `forgeWindowActivate`
  - `forgeFocusSet`, `forgeFocusGet`, `forgeControlSetValue`
  - `forgeControlsList`, `forgeControlsSearch`
  - `forgeFilterSet`, `forgeDataFetch`
  - `forgeTableSelectRow`, `forgeTableSelectByKey`
  - `forgeFileBrowserOpenFolder`, `forgeFileBrowserSelectUri`
  - `forgeDialogOpen`, `forgeDialogClose`, `forgeDialogCommit`
  - `forgeKeyPress`, `forgeKeySequence`
