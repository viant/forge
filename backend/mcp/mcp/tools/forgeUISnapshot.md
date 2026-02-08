# forgeUISnapshot

Returns the latest semantic UI snapshot sent by the Forge frontend UI bridge.

If `clientId` is omitted, the server uses the first connected UI client.

## Input

```json
{ "clientId": "optional-ui-client-id" }
```

## Output

Returns `{ clientId, connected, clients, snapshot }`.

