# forgeUIWait

Block until the Forge UI snapshot changes or a predicate matches.

This tool consumes snapshot updates that the frontend pushes over the Forge UI WS bridge.

## Input

```json
{
  "clientId": "optional-ui-client-id",
  "timeoutMs": 15000,
  "waitForChange": true,
  "includeSnapshot": true,
  "predicate": {
    "all": [
      { "path": "selected.windowId", "exists": true }
    ],
    "any": [
      { "path": "windows.#.windowKey", "contains": "files" }
    ]
  }
}
```

### Predicate fields

- `path`: a `gjson` path into the snapshot JSON.
- `exists`: when true/false, requires presence/absence.
- `equals`: JSON literal to compare (typed where possible).
- `contains`: substring match on the resolved value’s string form.
- `regex`: regex match on the resolved value’s string form.

## Output

Returns `{ matched, changed, reason, snapshot? }`.

