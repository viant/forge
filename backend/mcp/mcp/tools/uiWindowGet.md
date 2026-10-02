# window-get

Retrieve a saved Forge window definition by stable `windowId`, without a running
browser. The host resolves the ID through its configured catalog and checks read
permission before loading the YAML. Forge resolves imports and validates the
result using its standard window loader.

Input: `{ "windowId": "forecasting" }`.
Output: `{ "windowId": "forecasting", "definition": { ... } }`. The full
definition includes resolved `dataSource` configuration, schemas, resource
models, view/layout/controls, and authored action code where present. Retrieval
does not execute datasource queries or return rows.

Only configured window IDs are accepted. Request-supplied paths or URLs are not
supported. The definition may include datasource configuration and authored code;
the embedding host must govern its exposure.
