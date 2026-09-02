# Permission metadata

Forge defines the declarative metadata used to describe a protected view and evaluate
a normalized authorization snapshot. Forge does not configure adapters, know their
transport, or invoke authorization services.

## Optional declaration

Permission filtering is opt-in. A window without `authorization` is rendered through
the normal Forge path and requires no permission service.

```yaml
id: document
view:
  content:
    id: documentRoot
```

Add `authorization` only when the authored tree contains capability-dependent nodes:

```yaml
id: document
authorization:
  dataSourceRef: resource_authorization
  scope: resource
  resource:
    type: document
    id:
      source: resource
      selector: DocumentId.0
  requestedCapabilities:
    - read
    - write
    - manageSettings
  requestedGlobalCapabilities:
    - create
  behavior:
    failClosed: true
    authorizeBeforeDatasourceInit: true
    clearProtectedStateOnChange: true
view:
  content:
    id: documentRoot
```

## Authorization fields

| Field | Meaning |
|---|---|
| `dataSourceRef` | Opaque logical adapter identifier; Forge does not resolve its backend |
| `scope` | `resource` for one resource-specific tree or `principal` for global controls |
| `resource.type` | Stable resource type supplied to the authorization compiler |
| `resource.id.source` | Context containing the ID; currently `resource` or `windowForm` |
| `resource.id.selector` | Dot-path selecting the positive resource ID |
| `requestedCapabilities` | Resource capability names needed by the authored tree |
| `requestedGlobalCapabilities` | Principal/account capability names needed by global controls |
| `behavior.failClosed` | Deny protected metadata when authorization is invalid or missing |
| `behavior.authorizeBeforeDatasourceInit` | Compile before optional datasource contexts are created |
| `behavior.clearProtectedStateOnChange` | Clear state owned by nodes removed after recompilation |

## Normalized snapshot

Forge receives a normalized snapshot alongside the authored declaration:

```json
{
  "authorizationVersion": "revision-123",
  "expiresAt": "2026-09-02T12:00:00Z",
  "globalCapabilities": {
    "create": true
  },
  "resources": {
    "42": {
      "type": "document",
      "id": 42,
      "capabilities": {
        "read": true,
        "write": false,
        "manageSettings": false
      }
    }
  }
}
```

Forge consumes this shape; it does not create it.

## Conditions

Use the `authorization` source with the same condition grammar supported by other
Forge condition sources:

```yaml
- id: settings
  title: Settings
  visibleWhen:
    source: authorization
    field: resource.capabilities.manageSettings
    equals: true
```

```yaml
- id: editName
  type: text
  readOnlyWhen:
    source: authorization
    field: resource.capabilities.write
    equals: false
```

```yaml
- id: create
  title: Create
  visibleWhen:
    source: authorization
    field: globalCapabilities.create
    equals: true
```

Authorization conditions may be placed on:

- containers and controls;
- table columns;
- options and menu items;
- events and actions.

The permission-aware properties are:

- `visibleWhen`
- `hiddenWhen`
- `disabledWhen`
- `readOnlyWhen`

The authorization evaluator supports equality plus `contains` and `exists`. Missing
fields, missing snapshots, and unknown operators are never truthy for protected
conditions.

## Compilation result

The permitted-view compiler:

1. validates the normalized snapshot and selected resource;
2. requires `resource.capabilities.read=true` for resource-scoped views;
3. evaluates authorization conditions recursively;
4. removes denied nodes;
5. reduces compound conditions;
6. repairs selected/default navigation targets;
7. removes datasource declarations no longer reachable from the permitted tree.

The compiler returns metadata only. It does not authorize backend data access.

## Runtime rule

A host may load complete authored metadata before a resource is known, but it must not
publish a protected document to a Forge renderer until permission application returns
the permitted tree. An unprotected document bypasses this step completely.

## Authoring checklist

- Omit `authorization` when the view has no permission-sensitive presentation.
- Use stable, domain-neutral capability names.
- Request only capabilities referenced by the tree.
- Put resource identity in metadata rather than renderer-specific code.
- Gate the smallest meaningful node.
- Keep backend authorization independent from presentation filtering.
- Test owner, viewer, missing snapshot, denied read, and unprotected-view cases.
