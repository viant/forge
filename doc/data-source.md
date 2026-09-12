# Forge DataSource lifecycle & component interaction

This document summarises the **canonical data-flow** around a `DataSource` in
Forge UI, the reactive signals it owns, how widgets are expected to interact
with those signals, and how the new _Chat_ component fits into the same model.


## 1. Signals created for every DataSource

```
collection   signal<Array<Record>>   // full record set rendered by tables
selection    signal<{selected,rowIndex}|{selection:[]}|{nodePath,…}> // user selection
form         signal<Record>          // single record currently edited / shown
input        signal<{filter,page,…}> // command parameters sent to DataSource.jsx
control      signal<{loading,error,inactive}>
message      signal<Array<Message>>  // messagebus queue (internal)
```

`Context` wires these signals when `Context(dataSourceRef)` is requested and
exposes a rich set of **handlers** in `useDataSourceHandlers` so that widgets
can interact without touching the signals directly.


## 2. Nominal sequence diagram

```text
┌──────────┐            (user edits field / clicks row / hits submit …)
│  Widget  │──────────────────┐
└──────────┘                  │ calls one of:
   ▲                          │   • setFormField / setFormData
   │                          │   • toggleSelection / setSelection
   │                          │   • setFilter / fetchCollection …
   │                          ▼
   │               DataSource Handlers (useDataSourceHandlers)
   │               ┌───────────────────────────────────────────┐
   │               │ • mutate `form` or `selection` signal      │
   │               │ • push dependency parameters downstream    │
   │               └───────────────────────────────────────────┘
   │                           │ reactive
   ▼                           ▼
Other widgets receive     (optionally) a fetch cycle:
updated form/selection    input.fetch=true  →  DataSource.jsx
immediately.                                   connector.get()
                                              collection.value = rows
```

**Key design points**

1. `form` is the *optimistic, immediate* local state.  Components that edit
   data **must** update it through the handlers so sibling controls can react
   instantly.
2. `collection` is authoritative only after a successful `connector.get`.
3. Widgets never mutate `collection` directly – they either edit `form` or
   invoke a handler that ultimately triggers a refresh.


## 3. Chat component alignment

The Chat panel now adheres to the same principle:

* **Submit**
  1. Build `userMessage` & call `handlers.dataSource.setFormData(userMessage)` –
     pushes the message into `form` optimistically.
  2. If `chat.onSubmit` executions are defined in metadata, they are executed
     (`{message, adapter}`) and Chat stops; otherwise it falls back to the
     default `connector.post + fetchCollection` flow.

* **Upload**
  1. Build `fileMessage`; update `form` via handler.
  2. Run `chat.onUpload` executions if present, else default upload logic.

Both flows respect the *single-path* rule: DataSource remains the only code
that mutates `collection`.


## 4. Metadata reference (excerpt)

```yaml
chat:
  dataSourceRef: conversationDs
  tools: ["translate","code"]         # optional toolbar buttons
  showTools: true                      # default true
  showUpload: false                    # default true

  adapter:            # map payloads w/out changing Chat.jsx
    toOutbound:  "chat.buildPayload"   # handler name
    fromInbound: "chat.parseResponse"  # handler name

  on:                 # declare event executions
    - event: submit
      handler: chat.customSubmit
    - event: upload
      handler: chat.customUpload
```

Handlers above are resolved via `Context.lookupHandler` so they can live in
`window.actions` Go templates or be injected dynamically.

---

### TL;DR for component authors

* Update/inspect data **only via handlers** – never mutate signals yourself.
* Use `setFormData` / `setFormField` for instant UI sync.
* Trigger a refresh with `fetchCollection`, `refreshSelected` or similar
  helpers when you need server confirmation.

## Parameterized inline fixtures (Agently host)

When an Agently datasource uses `backend.kind: inline`, `backend.inlineFilters`
can opt into filtering before projection, paging, and caching. This is a host
backend feature; it is not JavaScript executed by the Forge renderer.

```yaml
id: example_delivery
cardinality: collection
selectors: {data: data}
backend:
  kind: inline
  rows:
    - {orderId: 710001, day: '2026-09-09', spend: 300}
    - {orderId: 710002, day: '2026-09-09', spend: 600}
  inlineFilters:
    - {field: orderId, input: filters.orderId, operator: eq, type: number}
    - {field: day, input: filters.From, operator: gte, type: date}
    - {field: day, input: filters.To, operator: lte, type: date}
```

Filters accept `eq`, `gte`, and `lte`, with number or date comparison. Equality
accepts a scalar or a list (membership); range filters need one value. Nested and
flat input paths are supported. Dates compare inclusive day boundaries. Missing
filter values do not restrict rows. Existing inline sources without the optional
mapping retain their previous behavior.

For an inline backend's root-array response, `selectors.data: data` supports the
root-array fallback; `selectors.data: rows` would try to project a missing field.
Verify both the public fetch result and the rendered report for the same request.
A static fixture is test data, not proof that a production backend filters or
aggregates correctly.
