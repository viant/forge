# forgeControlsList

List registered UI controls from the frontend control registry.

Maps to UI command: `ui.controls.list`.

## Input

```json
{
  "clientId": "optional-ui-client-id",
  "windowId": "optional-windowId",
  "dataSourceRef": "optional-datasource-ref",
  "timeoutMs": 15000
}
```

## Output

Returns `{ controls: [{windowId,dataSourceRef,controlId,label,type,scope,ts,key}] }`.

