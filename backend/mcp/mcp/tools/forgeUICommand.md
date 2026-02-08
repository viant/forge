# forgeUICommand

Sends a UI command to the Forge frontend UI bridge and waits for a response.

This is a generic escape hatch over the `runUICommand` surface in the frontend.

## Input

```json
{
  "clientId": "optional-ui-client-id",
  "method": "ui.window.open",
  "params": { "windowKey": "files" },
  "timeoutMs": 15000
}
```

## Output

Returns `{ ok, result, error }` plus correlation fields.

