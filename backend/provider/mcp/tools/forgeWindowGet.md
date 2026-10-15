# forgeActiveWindowGet

Return the existing semantic snapshot for exactly one active Forge window by
`windowId`. The window ID must appear in the selected connected UI client's
latest snapshot; no other client or MCP namespace is searched. The returned
window may contain form, parameter, metadata, and data-source state, so expose
this tool only behind the host application's authorization policy.

## Input

```json
{"clientId":"optional-ui-client-id","windowId":"W1"}
```

## Output

Returns `{clientId, window}` with the matched window's semantic snapshot.
