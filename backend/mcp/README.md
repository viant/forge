# Forge MCP

This package adds an MCP server that bridges to the Forge frontend UI bridge (`startUIBridge`).

## Saved window definitions

`window-list` and `window-get` expose saved Forge definitions without a browser.
Configure an explicit host-owned catalog:

```yaml
# windows.yaml; relative baseURL is relative to this catalog file.
baseURL: ./window
windows:
  - windowId: forecasting
    title: Forecasting
    namespace: inventory
    key: forecasting
```

```bash
go run ./backend/mcp/cmd/forge-mcp \
  --addr 127.0.0.1:5025 --window-catalog ./windows.yaml
```

This catalog-only mode serves MCP at `/mcp` and leaves the browser bridge
disabled unless a UI token is supplied. The explicitly configured entries are
public in the standalone local server. Do not place secrets in window files.
An executable neutral example is `backend/mcp/examples/catalog.yaml`.

- `window-list({query?, limit?, offset?})` returns visible saved IDs, titles,
  and namespaces, sorted by ID. Limit defaults to 25 and is bounded to 100.
- `window-get({windowId})` resolves the configured key through Forge's normal
  metadata loader and returns `{windowId, definition}`. The full definition
  includes imported `dataSource` configuration, schemas, resource models,
  layout/controls, and sibling action code where present. It never runs the
  datasource services or returns query rows. Caller-supplied file paths/URLs
  are not accepted.

Definitions are loaded on each get; catalog ID changes require a server restart.
Embedding applications may instead supply `service.WindowDefinitionCatalog`
from their own registry. Configure `roles` on each saved window in the app
catalog. Omitted or empty roles make that definition open. Configured roles
require an exact match to at least one caller role, for both list and get.
Denied definitions are filtered from lists and are not loaded by get.

```yaml
windows:
  - {windowId: public-summary, title: Summary, key: summary}
  - {windowId: restricted, title: Restricted, key: restricted, roles: [report-reader]}
```

The embedding application's OAuth adapter implements
`service.WindowPermissionProvider`: `Authenticate` validates the current caller
and returns the verified issuer, subject and tenant; `Permissions` obtains user
permission info from the provider on the server. No role grants come from MCP
arguments, browser state, or unverified token claims. Successful permission
lookups are cached for five minutes per issuer/subject/tenant. Authentication
still runs on every request; failed permission lookups are not cached. Permission
changes can take up to five minutes to become visible. This definition gate does
not authorize execution of the definition's data sources.

```go
roles := service.NewCachedWindowRoleResolver(oauthAdapter)
catalog, err := service.LoadWindowCatalog("windows.yaml",
    service.WithWindowRoleResolver(roles))
if err != nil { return err }
svc := service.NewService(&service.Config{WindowDefinitions: catalog})
// Compose mcp.NewHandler(svc) into the application's MCP server.
```

The standalone CLI has no OAuth adapter; its catalog mode supports open
windows. It rejects role-protected catalogs at startup rather than silently
publishing them. An embedding app must supply its trusted provider adapter.

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
- `forgeActiveWindowList`: lists active windows for one connected UI client without
  returning window data.
- `forgeActiveWindowGet`: returns one active window's semantic snapshot by exact
  `windowId` in that same client and MCP namespace. Treat it as sensitive when
  windows contain business data; the embedding host must authorize discovery
  and retrieval before exposing these tools to an MCP caller.
- `forgeUICommand`: sends `{method, params}` to the UI and returns `{ok,result,error}`.
- `forgeUIWait`: blocks until snapshot changes or predicate matches.
- Typed convenience tools (wrappers over `forgeUICommand`):
  - `forgeWindowOpen`, `forgeWindowOpenDynamic`, `forgeWindowClose`, `forgeWindowActivate`, `forgeWindowSelectTab`
  - `forgeFocusSet`, `forgeFocusGet`, `forgeControlSetValue`
  - `forgeControlsList`, `forgeControlsSearch`
  - `forgeFilterSet`, `forgeDataFetch`
  - `forgeTableSelectRow`, `forgeTableSelectByKey`
  - `forgeFileBrowserOpenFolder`, `forgeFileBrowserSelectUri`
  - `forgeDialogOpen`, `forgeDialogClose`, `forgeDialogCommit`
  - `forgeKeyPress`, `forgeKeySequence`
