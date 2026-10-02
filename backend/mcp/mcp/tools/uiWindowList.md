# window-list

List saved Forge window definitions visible to the caller. No browser connection
is required. The host owns the catalog and authorization provider.

Input: `{ "query": "optional search", "limit": 25, "offset": 0 }`.
Limit is bounded to 100. Output: `{ "windows": [{ "windowId": "forecasting",
"title": "Forecasting", "namespace": "inventory" }], "hasMore": false }`.

Use the exact returned `windowId` with `window-get`. This tool returns summary
metadata, not the definition, filesystem paths, datasource values, or live rows.
